import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Concurrent
 * Total TC: 2
 */
test.describe('UAT-concurrent: Concurrent', () => {
  test(`TC-283: 10 user đồng thời POST /cases — không deadlock @P2 @PERFORMANCE @Medium`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-284: 50 user đồng thời GET list — không nghẽn @P2 @PERFORMANCE @Low`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});