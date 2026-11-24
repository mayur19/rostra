import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests against a running stack (`./run.sh` in another terminal), or let
 * Playwright start it. Run with `npm run test:e2e` after `npx playwright install chromium`.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: 'test-results',
  reporter: [['list'], ['html', { outputFolder: 'report', open: 'never' }]],
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5108', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        cwd: '..',
        url: 'http://localhost:5108',
        reuseExistingServer: true,
        timeout: 60_000,
      },
});
