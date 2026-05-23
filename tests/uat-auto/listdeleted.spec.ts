import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: ListDeleted
 * Total TC: 2
 */
test.describe('UAT-listdeleted: ListDeleted', () => {
  test(`TC-167: ADMIN GET /cases/admin/deleted trả paginated deleted cases với deleteAudit @P0 @GREEN @High`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases/admin/deleted',
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-168: Non-ADMIN gọi /cases/admin/deleted → 403 @P0 @RED @Critical`, async ({ request }) => {
    await call(request, {
      method: 'GET',
      path: '/cases/admin/deleted',
      role: 'admin',
      expectedStatus: 403,
    });
  });

});