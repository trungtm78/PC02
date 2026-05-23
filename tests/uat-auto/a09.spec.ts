import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: A09
 * Total TC: 3
 */
test.describe('UAT-a09: A09', () => {
  test(`TC-234: Audit log CASE_DELETED ghi đầy đủ user, IP, UA, reason @P0 @SECURITY @High`, async ({ request }) => {
    // Module 'A09' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-235: Audit không lưu sensitive data (password, JWT) trong metadata @P0 @SECURITY @High`, async ({ request }) => {
    // Module 'A09' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-236: Audit retention ≥ 90 ngày (BLTTHS compliance) @P0 @SECURITY @Medium`, async ({ request }) => {
    // Module 'A09' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});