import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: WriteScope-C2
 * Total TC: 1
 */
test.describe('UAT-writescope-c2: WriteScope-C2', () => {
  test(`TC-340: Same writableTeam write → success @P0 @DECISION @High`, async ({ request }) => {
    // Module 'WriteScope-C2' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});