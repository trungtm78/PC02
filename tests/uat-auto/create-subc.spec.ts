import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-subC
 * Total TC: 3
 */
test.describe('UAT-create-subc: Create-subC', () => {
  test(`TC-039: subjectsCount = -1 → 400 @Min(0) @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-039] subjectsCount = -1 → 400 @Min(0)", "caseProvenance": "DIRECT_DISCOVERY", "subjectsCount": -1}`),
      expectedStatus: 400,
    });
  });

  test(`TC-040: subjectsCount = 1.5 (float) → 400 IsInt @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-040] subjectsCount = 1.5 (float) → 400 IsInt", "caseProvenance": "DIRECT_DISCOVERY", "subjectsCount": 1.5}`),
      expectedStatus: 400,
    });
  });

  test(`TC-041: subjectsCount = 'abc' string → 400 IsInt @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-041] subjectsCount = 'abc' string → 400 IsInt", "caseProvenance": "DIRECT_DISCOVERY", "subjectsCount": "abc"}`),
      expectedStatus: 400,
    });
  });

});