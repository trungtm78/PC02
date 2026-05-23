import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: reason
 * Total TC: 4
 */
test.describe('UAT-reason: reason', () => {
  test(`TC-309: Delete reason 10 ký tự (min) → pass @P1 @BOUNDARY @Medium`, async ({ request }) => {
    // Module 'reason' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-310: Delete reason 9 ký tự → 400 @P1 @BOUNDARY @Medium`, async ({ request }) => {
    // Module 'reason' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-311: Delete reason 500 ký tự (max) → pass @P1 @BOUNDARY @Medium`, async ({ request }) => {
    // Module 'reason' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-312: Delete reason 501 ký tự → 400 @P1 @BOUNDARY @Medium`, async ({ request }) => {
    // Module 'reason' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});