import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-deadline
 * Total TC: 2
 */
test.describe('UAT-create-deadline: Create-deadline', () => {
  test(`TC-044: deadline sai format 'không-phải-ngày' → 400 IsDateString @P0 @RED @High`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-044] deadline sai format 'không-phải-ngày' → 400 IsDateString", "caseProvenance": "DIRECT_DISCOVERY", "deadline": "abc-xyz"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-045: deadline format DD/MM/YYYY → 400 IsDateString chỉ accept ISO @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-045] deadline format DD/MM/YYYY → 400 IsDateString chỉ accept ISO", "caseProvenance": "DIRECT_DISCOVERY", "deadline": "15/08/2026"}`),
      expectedStatus: 400,
    });
  });

});