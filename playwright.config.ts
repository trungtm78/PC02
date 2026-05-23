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
