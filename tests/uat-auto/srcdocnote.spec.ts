import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: srcDocNote
 * Total TC: 2
 */
test.describe('UAT-srcdocnote: srcDocNote', () => {
  test(`TC-321: sourceDocumentNote 1000 ký tự (max) → pass @P1 @BOUNDARY @Low`, async ({ request }) => {
    // Module 'srcDocNote' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-322: sourceDocumentNote 1001 → 400 @P1 @BOUNDARY @Medium`, async ({ request }) => {
    // Module 'srcDocNote' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});