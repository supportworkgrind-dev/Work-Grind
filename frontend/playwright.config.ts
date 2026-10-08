import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [
    ['html', { outputFolder: '../artifacts/playwright-report', open: 'never' }],
    ['json', { outputFile: '../artifacts/playwright-results.json' }],
  ],
  outputDir: '../artifacts/test-results',
  use: {
    baseURL: process.env.WORKGRIND_BASE_URL || 'https://workgrind.vercel.app',
    ...devices['Desktop Chrome'],
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
