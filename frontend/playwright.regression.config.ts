import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3101';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/billing-ai-regressions.spec.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: '../artifacts/regression-report', open: 'never' }]],
  outputDir: '../artifacts/regression-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3101',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
