import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 240_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: process.env.SN_BASE_URL ?? 'https://dev216365.service-now.com',
    headless: true,
    // Set TFT Details stores ship_by via UTC, which shifts the date by a day
    // east of UTC; a fixed zone keeps the expected value deterministic.
    timezoneId: 'UTC',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
