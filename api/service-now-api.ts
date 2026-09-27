import { APIRequestContext, Browser, BrowserContext, BrowserContextOptions, expect } from '@playwright/test';

export interface FieldValue {
  value: string;
  display_value: string;
}

export type TableRow = Record<string, FieldValue>;

// Basic auth is disabled for the test user, so REST reuses the stored UI
// session and its CSRF token (g_ck).
export class ServiceNowApi {
  private constructor(
    private readonly context: BrowserContext,
    private readonly userToken: string,
  ) {}

  static async fromSession(
    browser: Browser,
    baseURL: string,
    storageState: BrowserContextOptions['storageState'],
  ): Promise<ServiceNowApi> {
    const context = await browser.newContext({ baseURL, storageState });
    const page = await context.newPage();
    await page.goto('/sc_request_list.do?sysparm_query=sys_idISEMPTY');
    const userToken = await page.evaluate(() => (window as unknown as { g_ck?: string }).g_ck);
    expect(userToken, 'Stored session must expose g_ck').toBeTruthy();
    await page.close();
    return new ServiceNowApi(context, userToken!);
  }

  private get request(): APIRequestContext {
    return this.context.request;
  }

  private get headers() {
    return { Accept: 'application/json', 'X-UserToken': this.userToken };
  }

  async query(table: string, query: string, fields: string[]): Promise<TableRow[]> {
    const response = await this.request.get(`/api/now/table/${table}`, {
      headers: this.headers,
      params: {
        sysparm_query: query,
        sysparm_fields: fields.join(','),
        sysparm_display_value: 'all',
        sysparm_limit: 10,
      },
    });
    await expect(response, `GET /api/now/table/${table}?${query}`).toBeOK();
    return (await response.json()).result;
  }

  async delete(table: string, sysId: string): Promise<number> {
    const response = await this.request.delete(`/api/now/table/${table}/${sysId}`, {
      headers: this.headers,
    });
    return response.status();
  }

  async dispose(): Promise<void> {
    await this.context.close();
  }
}
