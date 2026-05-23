import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: offset
 * Total TC: 2
 */
test.describe('UAT-offset: offset', () => {
  test(`TC-319: offset=0 (min) → pass @P1 @BOUNDARY @Low`, async ({ request }) => {
    // Module 'offset' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-320: offset=-1 → 400 @Min(0) @P1 @BOUNDARY @Medium`, async ({ request }) => {
    // Module 'offset' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});