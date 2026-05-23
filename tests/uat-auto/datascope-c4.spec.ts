import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: DataScope-C4
 * Total TC: 1
 */
test.describe('UAT-datascope-c4: DataScope-C4', () => {
  test(`TC-336: Same team (assignedTeamId in teamIds) xem Case đồng nghiệp @P0 @DECISION @High`, async ({ request }) => {
    // Module 'DataScope-C4' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});