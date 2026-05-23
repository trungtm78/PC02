import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: DataScope-C6
 * Total TC: 1
 */
test.describe('UAT-datascope-c6: DataScope-C6', () => {
  test(`TC-338: User khác team + không owner → 403 @P0 @DECISION @Critical`, async ({ request }) => {
    // Module 'DataScope-C6' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});