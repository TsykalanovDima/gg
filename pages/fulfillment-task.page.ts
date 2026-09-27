import { expect, Page } from '@playwright/test';
import { waitForFrame } from '../utils/frames';
import { Tables } from '../utils/tables';
import { OrderTestData } from '../utils/test-data';
import { ClassicFormPage } from './classic-form.page';

export const TaskState = {
  inProgress: { value: '2', label: 'In Progress' },
  withCarrier: { value: '-5', label: 'With Carrier' },
  completed: { value: '3', label: 'Completed' },
} as const;

export type TaskStateOption = (typeof TaskState)[keyof typeof TaskState];

const TFT_DETAILS_FRAME = 'id=show_tft_details';

export class FulfillmentTaskPage extends ClassicFormPage {
  constructor(page: Page) {
    super(page, Tables.fulfillmentTask);
  }

  get state() {
    return this.field('state');
  }

  get stateLabel() {
    return this.selectedOption('state');
  }

  get summary() {
    return this.readonlyField('request_summary');
  }

  get processData() {
    return this.field('process_data_json');
  }

  async setStateAndSave(state: TaskStateOption): Promise<URLSearchParams> {
    await this.state.selectOption(state.value);
    return this.saveViaHeaderContextMenu();
  }

  get setTftDetailsButton() {
    return this.page.locator('#x_mobi_c_tft_add_device_info');
  }

  // Writes into the unsaved form only: save afterwards without reloading.
  async fillTftDetails(data: OrderTestData): Promise<void> {
    await this.setTftDetailsButton.click();
    const details = await waitForFrame(
      this.page,
      (frame) => frame.url().includes(TFT_DETAILS_FRAME),
      'Set TFT Details',
    );

    await details.locator('#orderNumber').fill(data.orderNumber);
    await details.locator('#imei').fill(data.imei);
    await details.locator('#ship_by').fill(data.shipmentDate);
    await details.getByText('Other', { exact: true }).click();
    await details.getByText(data.carrier, { exact: true }).click();
    await details.locator('#tracking_number').fill(data.trackingNumber);

    const purchasePrice = details.locator('#purchase_price');
    await purchasePrice.clear();
    await purchasePrice.pressSequentially(data.priceDigits);
    await expect(purchasePrice).toHaveValue(data.expectedPrice);

    await details.locator('button[type="submit"]').click();
    await expect
      .poll(() => this.page.frames().some((frame) => frame.url().includes(TFT_DETAILS_FRAME)))
      .toBe(false);
  }
}
