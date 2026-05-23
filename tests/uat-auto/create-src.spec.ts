import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Create-src
 * Total TC: 1
 */
test.describe('UAT-create-src: Create-src', () => {
  test(`TC-047: sourceDocumentNote > 1000 ký tự → 400 @P1 @RED @Medium`, async ({ request }) => {
    await call(request, {
      method: 'POST',
      path: '/cases',
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-047] sourceDocumentNote > 1000 ký tự → 400", "caseProvenance": "DIRECT_DISCOVERY"}`),
      expectedStatus: 400,
    });
  });

});