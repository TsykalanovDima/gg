import { expect, Frame, Locator, Page } from '@playwright/test';

const ORDER_API = /\/api\/sn_sc\/v\d+\/servicecatalog\/(items\/[^/]+\/(order_now|submit_producer)|cart\/submit_order)/;

export interface SubmittedOrder {
  requestNumber: string;
}

// Catalog variables render as "sp_formfield_<variable>"; Select2 v3 exposes no
// ARIA roles, so its generated "s2id_" wrapper is the only reliable handle.
export class OrderDeviceForm {
  constructor(
    private readonly page: Page,
    readonly frame: Frame,
  ) {}

  get content(): Locator {
    return this.frame.locator('body');
  }

  selectedChoice(variable: string): Locator {
    return this.frame.locator(`#s2id_sp_formfield_${variable} .select2-chosen`);
  }

  async selectProvider(provider: string): Promise<void> {
    await this.selectFromSelect2('provider', provider);
  }

  async selectDevice(device: string): Promise<void> {
    await this.frame.getByText(device, { exact: true }).click();
  }

  async selectAccessory(accessory: string): Promise<void> {
    await this.frame.getByRole('button', { name: accessory }).click();
  }

  async selectLocation(location: string): Promise<void> {
    await this.selectFromSelect2('shipping_location', location);
  }

  async fillShipping(attentionTo: string, phone: string, additionalInfo: string): Promise<void> {
    await this.frame.locator('#sp_formfield_shipping_attention_to').fill(attentionTo);
    const contactNumber = this.frame.locator('#sp_formfield_shipping_attention_to_contact_number');
    await contactNumber.fill(phone);
    await contactNumber.press('Tab');
    await this.frame.locator('#sp_formfield_additional_info').fill(additionalInfo);
  }

  // The REQ number comes from this submit's API response, not from page text.
  async submit(): Promise<SubmittedOrder> {
    const orderResponse = this.page.waitForResponse(
      (response) => response.request().method() === 'POST' && ORDER_API.test(response.url()),
      { timeout: 60_000 },
    );
    await this.frame.locator('#submit-btn').click();

    const response = await orderResponse;
    expect(response.ok(), `Catalog order API ${response.status()} ${response.url()}`).toBe(true);
    const { result } = await response.json();
    const requestNumber: string = result.request_number ?? result.number;
    expect(requestNumber, 'Order API returns the REQ number').toMatch(/^REQ\d+$/);

    await expect.poll(() => this.frame.url()).toContain('id=sc_request');
    await expect(this.content).toContainText(requestNumber);
    return { requestNumber };
  }

  private async selectFromSelect2(variable: string, optionText: string): Promise<void> {
    await this.frame.locator(`#s2id_sp_formfield_${variable} .select2-choice`).click();
    await this.frame.locator('.select2-result-label').filter({ hasText: optionText }).click();
  }
}
