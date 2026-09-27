import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './qa/petition-search',
  outputDir: 'test-results/petition-search-artifacts',
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [['list'], ['json', { outputFile: 'test-results/petition-local/uat-results.json' }]],
  use: {
    baseURL: 'http://localhost:5179',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'petition-api', testMatch: '**/petition-search-uat.api.spec.ts' },
    { name: 'petition-ui', testMatch: '**/petition-search-uat.e2e.spec.ts', dependencies: ['petition-api'], use: { ...devices['Desktop Chrome'] } },
  ],
});
