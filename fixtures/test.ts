import { test as base, BrowserContext, expect, Response } from '@playwright/test';
import { RecordCleanup } from '../api/record-cleanup';
import { ServiceNowApi } from '../api/service-now-api';
import { FulfillmentTaskPage } from '../pages/fulfillment-task.page';
import { MobileDevicePage } from '../pages/mobile-device.page';
import { RequestPage } from '../pages/request.page';
import { RequestedItemPage } from '../pages/requested-item.page';
import { ShellPage } from '../pages/shell.page';
import { requireEnv } from '../utils/env';
import { Tables } from '../utils/tables';
import { createOrderTestData, OrderTestData } from '../utils/test-data';

export interface CurrentUser {
  sysId: string;
  name: string;
}

type SessionState = Awaited<ReturnType<BrowserContext['storageState']>>;

interface WorkerFixtures {
  sessionState: SessionState;
}

interface Fixtures {
  testData: OrderTestData;
  api: ServiceNowApi;
  currentUser: CurrentUser;
  cleanup: RecordCleanup;
  serverErrorGuard: void;
  shell: ShellPage;
  requestPage: RequestPage;
  requestedItemPage: RequestedItemPage;
  fulfillmentTaskPage: FulfillmentTaskPage;
  mobileDevicePage: MobileDevicePage;
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  // One login per worker, kept in memory and injected into every test context.
  sessionState: [
    async ({ browser }, use, workerInfo) => {
      const context = await browser.newContext({ baseURL: workerInfo.project.use.baseURL });
      await new ShellPage(await context.newPage()).login(
        requireEnv('SN_USERNAME'),
        requireEnv('SN_PASSWORD'),
      );
      const state = await context.storageState();
      await context.close();
      await use(state);
    },
    { scope: 'worker' },
  ],

  storageState: async ({ sessionState }, use) => {
    await use(sessionState);
  },

  testData: async ({}, use) => {
    await use(createOrderTestData());
  },

  api: async ({ browser, baseURL, sessionState }, use) => {
    const api = await ServiceNowApi.fromSession(browser, baseURL!, sessionState);
    await use(api);
    await api.dispose();
  },

  currentUser: async ({ api }, use) => {
    const [user] = await api.query(Tables.user, 'sys_id=javascript:gs.getUserID()', ['sys_id', 'name']);
    expect(user, 'The stored session must belong to a sys_user').toBeDefined();
    await use({ sysId: user.sys_id.value, name: user.name.value });
  },

  // Runs even when the test fails; SN_CLEANUP=false keeps records for review.
  cleanup: async ({ api }, use, testInfo) => {
    const cleanup = new RecordCleanup(api);
    await use(cleanup);

    if (process.env.SN_CLEANUP === 'false') {
      testInfo.annotations.push({ type: 'cleanup', description: 'skipped (SN_CLEANUP=false)' });
      return;
    }
    const { deleted, problems } = await cleanup.deleteTracked();
    testInfo.annotations.push({ type: 'cleanup', description: deleted.join(', ') || 'nothing' });
    for (const problem of problems) {
      console.warn(`[cleanup] ${problem}`);
      testInfo.annotations.push({ type: 'cleanup-warning', description: problem });
    }
  },

  serverErrorGuard: [
    async ({ context, baseURL }, use) => {
      const host = new URL(baseURL!).host;
      const errors: string[] = [];
      const onResponse = (response: Response) => {
        if (response.status() >= 500 && new URL(response.url()).host === host) {
          errors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
        }
      };
      context.on('response', onResponse);
      await use();
      context.off('response', onResponse);
      expect.soft(errors, 'ServiceNow must not answer with 5xx during the run').toEqual([]);
    },
    { auto: true },
  ],

  shell: async ({ page }, use) => use(new ShellPage(page)),
  requestPage: async ({ page }, use) => use(new RequestPage(page)),
  requestedItemPage: async ({ page }, use) => use(new RequestedItemPage(page)),
  fulfillmentTaskPage: async ({ page }, use) => use(new FulfillmentTaskPage(page)),
  mobileDevicePage: async ({ page }, use) => use(new MobileDevicePage(page)),
});

export { expect };
