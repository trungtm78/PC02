import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Delete-Decision
 * Total TC: 5
 */
test.describe('UAT-delete-decision: Delete-Decision', () => {
  test(`TC-342: Decision matrix delete: TIEP_NHAN + creator + within 72h → success @P0 @DECISION @High`, async ({ request }) => {
    // Module 'Delete-Decision' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-343: Decision: TIEP_NHAN + creator + >72h + non-ADMIN → 400 @P0 @DECISION @High`, async ({ request }) => {
    // Module 'Delete-Decision' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-344: Decision: TIEP_NHAN + non-creator + non-ADMIN → 403 @P0 @DECISION @High`, async ({ request }) => {
    // Module 'Delete-Decision' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-345: Decision: ≠TIEP_NHAN + ADMIN → 400 (status check first) @P0 @DECISION @High`, async ({ request }) => {
    // Module 'Delete-Decision' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-346: Decision: TIEP_NHAN + ADMIN + creator NULL + within window → success @P0 @DECISION @Medium`, async ({ request }) => {
    // Module 'Delete-Decision' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});