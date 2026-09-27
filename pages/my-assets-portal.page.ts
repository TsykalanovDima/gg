import { expect, Page } from '@playwright/test';
import { waitForFrame } from '../utils/frames';
import { OrderDeviceForm } from './order-device.form';

export class MyAssetsPortalPage {
  constructor(readonly page: Page) {}

  get heading() {
    return this.page.getByRole('heading', { name: 'My Devices & Services', exact: true, level: 3 });
  }

  async expectLoaded(): Promise<void> {
    await expect(this.page).toHaveURL(/\/sp\/?\?id=mc_services/);
    await expect(this.heading).toBeVisible();
  }

  async openOrderNewDevice(): Promise<OrderDeviceForm> {
    await this.page.getByText('Order New Device', { exact: true }).click();
    const frame = await waitForFrame(
      this.page,
      (candidate) => candidate.url().includes('id=sc_cat_item'),
      'Order New Device',
    );
    return new OrderDeviceForm(this.page, frame);
  }

  async close(): Promise<void> {
    await this.page.close();
  }
}
