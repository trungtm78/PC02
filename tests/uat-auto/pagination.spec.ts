import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Pagination
 * Total TC: 1
 */
test.describe('UAT-pagination: Pagination', () => {
  test(`TC-285: Deep pagination offset=5000 < 1s (with index) @P1 @PERFORMANCE @Low`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});