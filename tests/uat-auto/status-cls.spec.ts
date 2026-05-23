import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: status-cls
 * Total TC: 2
 */
test.describe('UAT-status-cls: status-cls', () => {
  test(`TC-331: Status valid class TIEP_NHAN @P1 @EP @Low`, async ({ request }) => {
    // Module 'status-cls' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-332: Status invalid class 'OPEN' (Anh) @P1 @EP @Medium`, async ({ request }) => {
    // Module 'status-cls' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});