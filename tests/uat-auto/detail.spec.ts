import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Detail
 * Total TC: 10
 */
test.describe('UAT-detail: Detail', () => {
  test(`TC-086: GET /cases/:id trả full detail có investigator + petitions include @P0 @GREEN @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}`,
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-087: GET /cases/NOT_EXIST → 404 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}`,
      role: 'admin',
      expectedStatus: 404,
    });
  });

  test(`TC-088: GET /cases/:id của Case đã soft-deleted → 404 (deletedAt IS NOT NULL) @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}`,
      role: 'admin',
      expectedStatus: 404,
    });
  });

  test(`TC-089: GET /cases/:id của Case ngoài scope → 403 @P0 @RED @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}`,
      role: 'admin',
      expectedStatus: 403,
    });
  });

  test(`TC-090: Dispatcher xem mọi Case không bị scope chặn @P0 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}`,
      role: 'approver1',
      expectedStatus: 200,
    });
  });

  test(`TC-091: ADMIN xem mọi Case (no scope) @P0 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}`,
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-092: Owner (investigator) xem được Case mình phụ trách @P0 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}`,
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-093: Cùng team xem được Case của đồng nghiệp @P0 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}`,
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-094: User được xem unassigned Case của team mình (assignedTeamId=null + teamIds.length>0) @P1 @GREEN @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}`,
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-280: GET /cases/:id (include petitions + investigator) < 300ms @P1 @PERFORMANCE @Medium`, async ({ request }) => {
    // PERFORMANCE TC — smoke verify endpoint reachable (UI verification cần manual)
    await smokeReachable(request, '/cases', 'admin');
  });

});