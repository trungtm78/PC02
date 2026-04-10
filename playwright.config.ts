import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5179',
    trace: 'on-first-retry',
    screenshot: 'on',              // R1-09: must be 'on', NOT 'only-on-failure'
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // webServer: servers already running externally — reuse existing
  webServer: [
    {
      command: 'npm run start:dev',
      url: 'http://localhost:3000/api/v1/health',
      cwd: './backend',
      reuseExistingServer: true,   // always reuse — avoids DB cold start
      timeout: 60000,
    },
    {
      command: 'npx vite --port 5179 --strictPort',
      url: 'http://localhost:5179',
      cwd: './frontend',
      reuseExistingServer: true,   // always reuse
      timeout: 30000,
    },
  ],
});
