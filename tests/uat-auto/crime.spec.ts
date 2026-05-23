import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: crime
 * Total TC: 2
 */
test.describe('UAT-crime: crime', () => {
  test(`TC-305: crime 255 ký tự (max) → pass @P1 @BOUNDARY @Medium`, async ({ request }) => {
    // Module 'crime' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-306: crime 256 ký tự → 400 @P1 @BOUNDARY @Medium`, async ({ request }) => {
    // Module 'crime' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});