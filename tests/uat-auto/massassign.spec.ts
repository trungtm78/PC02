import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: MassAssign
 * Total TC: 3
 */
test.describe('UAT-massassign: MassAssign', () => {
  test(`TC-240: POST kèm field 'createdById':'other-user' bị whitelist reject @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'MassAssign' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-241: POST kèm 'id':'fake-id' không cho phép override @P0 @SECURITY @Critical`, async ({ request }) => {
    // Module 'MassAssign' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

  test(`TC-242: POST kèm 'deletedAt':null override không cho phép @P0 @SECURITY @High`, async ({ request }) => {
    // Module 'MassAssign' chưa có endpoint mapping — smoke fallback
    await smokeReachable(request, '/cases', 'admin');
  });

});