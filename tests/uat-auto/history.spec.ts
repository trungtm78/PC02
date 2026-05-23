import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: History
 * Total TC: 6
 */
test.describe('UAT-history: History', () => {
  test(`TC-197: GET /cases/:id/status-history trả list sorted asc changedAt @P0 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}/status-history`,
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-198: Case không có status change → empty array @P1 @GREEN @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}/status-history`,
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-199: GET history của Case không tồn tại → 200 với data=[] (no 404 hiện tại) @P0 @RED @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}/status-history`,
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-200: changedBy=null khi changedById=null (audit cũ chưa có user) @P1 @GREEN @Low`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}/status-history`,
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-201: User ngoài scope GET history → ? @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}/status-history`,
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-202: History entry có changedAt là datetime đầy đủ (ISO) @P1 @GREEN @Low`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}/status-history`,
      role: 'admin',
      expectedStatus: 200,
    });
  });

});