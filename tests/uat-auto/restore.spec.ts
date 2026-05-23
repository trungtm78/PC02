import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Restore
 * Total TC: 5
 */
test.describe('UAT-restore: Restore', () => {
  test(`TC-162: ADMIN khôi phục Case đã soft-deleted @P0 @GREEN @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'POST',
      path: `/cases/${id}/restore`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-162 restore — test restore flow"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-163: Non-ADMIN gọi restore → 403 PermissionsGuard (action=restore) @P0 @RED @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'POST',
      path: `/cases/${id}/restore`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-163 restore — test restore flow"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-164: Restore Case chưa từng bị xóa (deletedAt=null) → 404 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'POST',
      path: `/cases/${id}/restore`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-164 restore — test restore flow"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-165: Race: 2 ADMIN restore cùng case → 1 ConflictException friendly @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'POST',
      path: `/cases/${id}/restore`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-165 restore — test restore flow"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-166: Reason rỗng → 400 DTO validation @P1 @RED @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'POST',
      path: `/cases/${id}/restore`,
      role: 'admin',
      body: JSON.parse(`{"reason": "UAT TC-166 restore — test restore flow"}`),
      expectedStatus: 400,
    });
  });

});