import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-perm
 * Total TC: 1
 */
test.describe('UAT-create-perm: Create-perm', () => {
  test(`TC-053: User KHÔNG có permission write/Case (role VIEWER) → 403 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      body: JSON.parse(`{"name": "[UAT-TC-053] User KHÔNG có permission write/Case (role VIEWER) → 403", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 401,
    });
  });

});