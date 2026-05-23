import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-crime
 * Total TC: 1
 */
test.describe('UAT-create-crime: Create-crime', () => {
  test(`TC-042: crime > 255 ký tự → 400 MaxLength @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-042] crime > 255 ký tự → 400 MaxLength", "caseProvenance": "DIRECT_DISCOVERY", "crime": "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"}`),
      expectedStatus: 400,
    });
  });

});