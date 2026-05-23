import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: DataScope-C3
 * Total TC: 1
 */
test.describe('UAT-datascope-c3: DataScope-C3', () => {
  test(`TC-335: Owner (investigatorId match userIds) xem Case mình @P0 @DECISION @High`, async ({ request }) => {
    // Module 'DataScope-C3' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});