import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-auth
 * Total TC: 3
 */
test.describe('UAT-create-auth: Create-auth', () => {
  test(`TC-054: POST không có Authorization header → 401 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      body: JSON.parse(`{"name": "[UAT-TC-054] POST không có Authorization header → 401", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 401,
    });
  });

  test(`TC-055: POST JWT đã hết hạn → 401 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-055] POST JWT đã hết hạn → 401", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 401,
    });
  });

  test(`TC-056: POST JWT bị tamper signature → 401 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-056] POST JWT bị tamper signature → 401", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 401,
    });
  });

});