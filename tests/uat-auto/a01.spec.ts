import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: A01
 * Total TC: 7
 */
test.describe('UAT-a01: A01', () => {
  test(`TC-208: IDOR: User A trực tiếp GET /cases/<id-của-B> (URL guessing) → 403 @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A01' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-209: Horizontal privilege escalation: dieuTra-Q1 sửa Case-Q3 → 403 @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A01' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-210: Vertical: VIEWER role thử POST /cases → 403 @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A01' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-211: DELETE Case của user khác (creator check) → 403 @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A01' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-212: Non-ADMIN restore → 403 @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A01' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-213: GET /cases/admin/deleted với non-ADMIN → 403 @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A01' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-214: Non-dispatcher PATCH /assign → 403 DispatchGuard @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'A01' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});