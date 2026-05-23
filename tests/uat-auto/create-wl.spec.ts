import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-wl
 * Total TC: 1
 */
test.describe('UAT-create-wl: Create-wl', () => {
  test(`TC-052: POST kèm field lạ 'evilField=hack' với whitelist=true → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-052] POST kèm field lạ 'evilField=hack' với whitelist=true → 400", "caseProvenance": "DIRECT_DISCOVERY", "evilField": "hack"}`),
      expectedStatus: 400,
    });
  });

});