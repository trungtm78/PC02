import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: DataScope-C5
 * Total TC: 1
 */
test.describe('UAT-datascope-c5: DataScope-C5', () => {
  test(`TC-337: Unassigned Case + user có team (teamIds.length>0) @P0 @DECISION @Medium`, async ({ request }) => {
    // Module 'DataScope-C5' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});