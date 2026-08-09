import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

// UAT_PROD=1 → load tests/.env.test, target remote, skip webServer
const isUatProd = process.env.UAT_PROD === '1';
if (isUatProd) {
  dotenv.config({ path: path.resolve(__dirname, 'tests/.env.test') });
}

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: isUatProd ? 45_000 : 30_000,
  reporter: isUatProd
    ? ([
        ['line'],
        ['html', { open: 'never', outputFolder: 'test-results/uat-html' }],
        ['json', { outputFile: 'test-results/uat-results.json' }],
      ] as any)
    : 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5179',
    trace: isUatProd ? 'retain-on-failure' : 'on-first-retry',
    screenshot: isUatProd ? 'only-on-failure' : 'on',
    video: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    actionTimeout: isUatProd ? 15_000 : undefined,
  },
  projects: [
    {
      name: 'chromium',
      // Without a testMatch this project collected all 182 spec files, so the
      // api and e2e-chromium projects below re-ran everything they matched.
      testMatch: '**/tests/e2e/*.e2e.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    // Dual-layer UAT runner (v0.68 — uat-test-runner skill)
    // - api: smoke gate (request fixture, no browser)
    // - e2e-chromium: full DOM verify (Page Object Model)
    {
      name: 'api',
      testMatch: '**/tests/api/*-uat.api.spec.ts',
    },
    {
      name: 'e2e-chromium',
      testMatch: '**/tests/e2e/*-uat.e2e.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    // The only project CI gates on. Kept apart from the legacy suite, which
    // cannot be switched on as-is — see tests/e2e-new/README.md.
    {
      name: 'e2e-new',
      testMatch: '**/tests/e2e-new/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // webServer chi bat cho local dev — UAT_PROD=1 skip
  ...(isUatProd
    ? {}
    : {
        webServer: [
          {
            command: 'npm run start:dev',
            url: 'http://localhost:3000/api/v1/health',
            cwd: './backend',
            reuseExistingServer: true,
            timeout: 60000,
          },
          {
            command: 'npx vite --port 5179 --strictPort',
            url: 'http://localhost:5179',
            cwd: './frontend',
            reuseExistingServer: true,
            timeout: 30000,
          },
        ],
      }),
});
