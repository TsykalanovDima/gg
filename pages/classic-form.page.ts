import { expect, Locator, Page } from '@playwright/test';
import { escapeRegExp, exactText } from '../utils/text';

// Classic field ids ("<table>.<field>", "sys_display.", "sys_readonly.") come
// from the data model, so they survive label and layout changes.
export abstract class ClassicFormPage {
  protected constructor(
    readonly page: Page,
    readonly table: string,
  ) {}

  field(name: string): Locator {
    return this.page.locator(`[id="${this.table}.${name}"]`);
  }

  referenceField(name: string): Locator {
    return this.page.locator(`[id="sys_display.${this.table}.${name}"]`);
  }

  readonlyField(name: string): Locator {
    return this.page.locator(`[id="sys_readonly.${this.table}.${name}"]`);
  }

  selectedOption(name: string): Locator {
    return this.field(name).locator('option:checked');
  }

  tab(name: string | RegExp): Locator {
    return this.page.getByRole('tab', { name, exact: typeof name === 'string' });
  }

  recordLink(table: string, number: string | RegExp): Locator {
    return this.page
      .locator(`a.linked.formlink[href*="${table}.do?"]`)
      .filter({ hasText: typeof number === 'string' ? exactText(number) : number });
  }

  async openBySysId(sysId: string): Promise<void> {
    await this.page.goto(`/${this.table}.do?sys_id=${sysId}`);
    await this.expectLoaded();
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(`/${escapeRegExp(this.table)}\\.do`));
    await this.page.waitForFunction(
      (table) => (window as unknown as { g_form?: { getTableName(): string } }).g_form?.getTableName() === table,
      this.table,
    );
  }

  async sysId(): Promise<string> {
    const sysId = await this.page.evaluate(
      () => (window as unknown as { g_form: { getUniqueValue(): string } }).g_form.getUniqueValue(),
    );
    expect(sysId).toMatch(/^[0-9a-f]{32}$/);
    return sysId;
  }

  // Header menu "Save" posts the gsft_id of #sysverb_update_and_stay as
  // sys_action; "Update" posts another id and navigates away.
  async saveViaHeaderContextMenu(): Promise<URLSearchParams> {
    const saveActionId = await this.page.locator('#sysverb_update_and_stay').getAttribute('gsft_id');
    expect(saveActionId, 'Form must offer the Save action').toBeTruthy();

    const submitted = this.page.waitForRequest(
      (request) =>
        request.method() === 'POST' && new URL(request.url()).pathname === `/${this.table}.do`,
    );

    await this.page.locator('.navbar-header').first().click({ button: 'right' });
    await this.page.getByRole('menuitem', { name: 'Save', exact: true }).click();

    const request = await submitted;
    const form = new URLSearchParams(request.postData() ?? '');
    expect(form.get('sys_action'), 'Header context menu must post the Save action').toBe(
      saveActionId,
    );
    const response = await request.response();
    expect(response, `POST /${this.table}.do must get a response`).not.toBeNull();
    expect(response!.status(), `POST /${this.table}.do status`).toBeLessThan(400);

    await this.page.waitForLoadState('load');
    await this.expectLoaded();
    await expect(this.page.locator('.outputmsg_error').filter({ visible: true })).toHaveCount(0);
    return form;
  }
}
