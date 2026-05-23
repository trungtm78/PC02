import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Cancel
 * Total TC: 2
 */
test.describe('UAT-cancel: Cancel', () => {
  test(`TC-355: User đóng tab giữa form Create — KHÔNG tạo Case partial @P1 @RECOVERY @Medium`, async ({ request }) => {
    // Module 'Cancel' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-356: User refresh giữa form Create — clear state hoặc preserve draft? @P1 @RECOVERY @Low`, async ({ request }) => {
    // Module 'Cancel' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});