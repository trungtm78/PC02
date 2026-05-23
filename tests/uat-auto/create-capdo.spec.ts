import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-capDo
 * Total TC: 1
 */
test.describe('UAT-create-capdo: Create-capDo', () => {
  test(`TC-038: capDoToiPham là invalid enum 'INVALID' → 400 với message tiếng Việt @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-038] capDoToiPham là invalid enum 'INVALID' → 400 với message tiếng Việt", "caseProvenance": "DIRECT_DISCOVERY", "capDoToiPham": "INVALID"}`),
      expectedStatus: 400,
    });
  });

});