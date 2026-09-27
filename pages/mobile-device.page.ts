import { expect, Locator, Page } from '@playwright/test';
import { Tables } from '../utils/tables';
import { exactText } from '../utils/text';
import { ClassicFormPage } from './classic-form.page';

export const ORDERED_STATUS = 'Ordered';

export class MobileDevicePage extends ClassicFormPage {
  constructor(page: Page) {
    super(page, Tables.mobileDevice);
  }

  get name() {
    return this.field('name');
  }

  get assignedTo() {
    return this.referenceField('assigned_to');
  }

  get model() {
    return this.referenceField('model_id');
  }

  get operationalStatus() {
    return this.selectedOption('operational_status');
  }

  get imei() {
    return this.field('imei');
  }

  journalLinkTo(table: string, number: string): Locator {
    return this.page.locator(`a[href*="${table}.do?"]`).filter({ hasText: exactText(number) });
  }

  listRow(imei: string): Locator {
    return this.page.locator('tr.list_row').filter({ hasText: imei });
  }

  async waitForDeviceInList(imei: string): Promise<Locator> {
    const listUrl = `/${this.table}_list.do?sysparm_query=${encodeURIComponent(`imei=${imei}`)}`;
    const row = this.listRow(imei);
    await expect
      .poll(
        async () => {
          await this.page.goto(listUrl);
          return row.count();
        },
        {
          message: `Expected one mobile device with IMEI ${imei}`,
          timeout: 30_000,
          intervals: [1_000, 2_000, 5_000],
        },
      )
      .toBe(1);
    return row;
  }

  async openRow(row: Locator): Promise<void> {
    const link = row.locator(`a.formlink[href*="${this.table}.do?"]`);
    await expect(link).toHaveCount(1);
    await link.click();
    await this.expectLoaded();
  }
}
