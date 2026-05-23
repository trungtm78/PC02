import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-type
 * Total TC: 2
 */
test.describe('UAT-create-type: Create-type', () => {
  test(`TC-057: deadline là object → 400 IsDateString @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-057] deadline là object → 400 IsDateString", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-058: investigatorId là number 12345 → 400 IsString @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-058] investigatorId là number 12345 → 400 IsString", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 400,
    });
  });

});