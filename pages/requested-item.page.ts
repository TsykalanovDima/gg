import { expect, Page } from '@playwright/test';
import { Tables } from '../utils/tables';
import { ClassicFormPage } from './classic-form.page';

// Catalog variables have generated ids ("IO:<sys_id>"), so they are located by label.
export class RequestedItemPage extends ClassicFormPage {
  constructor(page: Page) {
    super(page, Tables.requestedItem);
  }

  get provider() {
    return this.page.getByRole('combobox', { name: 'Provider', exact: true }).locator('option:checked');
  }

  get device() {
    return this.page.getByRole('combobox', { name: /SubmitDevice$/ });
  }

  get contactNumber() {
    return this.page.getByRole('textbox', { name: 'Contact Number', exact: true });
  }

  get fulfillmentTaskLink() {
    return this.recordLink(Tables.fulfillmentTask, /^\s*TEL\d+\s*$/);
  }

  async waitForFulfillmentTask(): Promise<void> {
    await expect
      .poll(
        async () => {
          await this.page.reload();
          await this.tab(/Telecom Fulfillment Tasks/).click();
          return this.fulfillmentTaskLink.count();
        },
        {
          message: 'Expected one Telecom Fulfillment Task',
          timeout: 120_000,
          intervals: [1_000, 2_000, 5_000],
        },
      )
      .toBe(1);
  }
}
