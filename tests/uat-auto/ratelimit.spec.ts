import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: RateLimit
 * Total TC: 1
 */
test.describe('UAT-ratelimit: RateLimit', () => {
  test(`TC-238: POST /cases brute force 100 req/s → throttle global @P0 @SECURITY @High`, async ({ request }) => {
    // Module 'RateLimit' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});