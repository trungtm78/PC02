import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-unit
 * Total TC: 1
 */
test.describe('UAT-create-unit: Create-unit', () => {
  test(`TC-043: unit > 255 ký tự → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-043] unit > 255 ký tự → 400", "caseProvenance": "DIRECT_DISCOVERY", "unit": "UUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU"}`),
      expectedStatus: 400,
    });
  });

});