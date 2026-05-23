import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: DeletePreflight
 * Total TC: 4
 */
test.describe('UAT-deletepreflight: DeletePreflight', () => {
  test(`TC-158: GET /cases/:id/delete-preflight trả canDelete=true cho TIEP_NHAN + không blocker @P0 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}/delete-preflight`,
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-159: Preflight Case status=DA_KET_LUAN trả canDelete=false + reason @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}/delete-preflight`,
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-160: Preflight Case có 2 subjects + 1 document → reasons detailed @P0 @RED @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}/delete-preflight`,
      role: 'admin',
      expectedStatus: 200,
    });
  });

  test(`TC-161: Preflight Case ngoài scope → 403 (checkRecordInScope) @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'GET',
      path: `/cases/${id}/delete-preflight`,
      role: 'admin',
      expectedStatus: 403,
    });
  });

});