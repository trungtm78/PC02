import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-inv
 * Total TC: 1
 */
test.describe('UAT-create-inv: Create-inv', () => {
  test(`TC-037: investigatorId không tồn tại trong users table → 400 @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-037] investigatorId không tồn tại trong users table → 400", "caseProvenance": "DIRECT_DISCOVERY", "investigatorId": "NON_EXIST_USER_XXX"}`),
      expectedStatus: 400,
    });
  });

});