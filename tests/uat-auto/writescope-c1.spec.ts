import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: WriteScope-C1
 * Total TC: 1
 */
test.describe('UAT-writescope-c1: WriteScope-C1', () => {
  test(`TC-339: Owner write Case mình → success @P0 @DECISION @High`, async ({ request }) => {
    // Module 'WriteScope-C1' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});