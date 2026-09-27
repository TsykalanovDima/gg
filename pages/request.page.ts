import { expect, Page } from '@playwright/test';
import { Tables } from '../utils/tables';
import { ClassicFormPage } from './classic-form.page';

export class RequestPage extends ClassicFormPage {
  constructor(page: Page) {
    super(page, Tables.request);
  }

  get requestedFor() {
    return this.referenceField('requested_for');
  }

  get requestedItemLink() {
    return this.recordLink(Tables.requestedItem, /^\s*RITM\d+\s*$/);
  }

  async openFromList(requestNumber: string): Promise<void> {
    const query = encodeURIComponent(`number=${requestNumber}`);
    await this.page.goto(`/${this.table}_list.do?sysparm_query=${query}`);
    const link = this.recordLink(this.table, requestNumber);
    await expect(link).toHaveCount(1);
    await link.click();
    await this.expectLoaded();
    await expect(this.page.locator('body')).toContainText(requestNumber);
  }
}
