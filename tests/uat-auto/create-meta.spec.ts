import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-meta
 * Total TC: 2
 */
test.describe('UAT-create-meta: Create-meta', () => {
  test(`TC-049: metadata là array thay vì object → 400 IsObject @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-049] metadata là array thay vì object → 400 IsObject", "caseProvenance": "DIRECT_DISCOVERY", "metadata": [1, 2, 3]}`),
      expectedStatus: 400,
    });
  });

  test(`TC-050: metadata là string → 400 IsObject @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-050] metadata là string → 400 IsObject", "caseProvenance": "DIRECT_DISCOVERY", "metadata": "abc"}`),
      expectedStatus: 400,
    });
  });

});