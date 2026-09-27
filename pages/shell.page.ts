import { expect, Page } from '@playwright/test';
import { MyAssetsPortalPage } from './my-assets-portal.page';

export class ShellPage {
  constructor(private readonly page: Page) {}

  // ServiceNow appends position text to the accessible name, for example
  // "My Assets & Services 2 of 29 (opens in a new tab)".
  get myAssetsLink() {
    return this.page.getByRole('link', { name: /^My Assets & Services\b/ });
  }

  async login(username: string, password: string): Promise<void> {
    await this.page.goto('/');
    await this.page.locator('#user_name').fill(username);
    await this.page.locator('#user_password').fill(password);
    await this.page.locator('#sysverb_login').click();
    await expect(this.myAssetsLink).toBeVisible({ timeout: 30_000 });
  }

  get navigatorFilter() {
    return this.page.getByRole('textbox', { name: 'Enter search term to filter All menu' });
  }

  async open(): Promise<void> {
    await this.page.goto('/');
    await expect(this.myAssetsLink).toBeVisible({ timeout: 30_000 });
  }

  async openMyAssetsAndServices(): Promise<MyAssetsPortalPage> {
    await this.navigatorFilter.fill('My Assets & Services');
    const popup = this.page.waitForEvent('popup');
    await this.myAssetsLink.click();
    const portal = new MyAssetsPortalPage(await popup);
    await portal.expectLoaded();
    return portal;
  }
}
