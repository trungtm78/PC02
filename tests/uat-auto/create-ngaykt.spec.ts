import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-ngayKT
 * Total TC: 1
 */
test.describe('UAT-create-ngaykt: Create-ngayKT', () => {
  test(`TC-046: ngayKhoiTo='2026-13-45' (tháng 13, ngày 45) → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-046] ngayKhoiTo='2026-13-45' (tháng 13, ngày 45) → 400", "caseProvenance": "DIRECT_DISCOVERY", "ngayKhoiTo": "2026-13-45"}`),
      expectedStatus: 400,
    });
  });

});