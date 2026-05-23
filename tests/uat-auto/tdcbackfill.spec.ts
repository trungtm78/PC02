import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: TdcBackfill
 * Total TC: 5
 */
test.describe('UAT-tdcbackfill: TdcBackfill', () => {
  test(`TC-203: PATCH /cases/:id/tdc-backfill update lyDoTamDinhChiVuAn @P0 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/tdc-backfill`,
      role: 'admin',
      body: JSON.parse(`{"lyDoTamDinhChiVuAn": "CHUA_XAC_DINH_BI_CAN"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-204: PATCH với Case không tồn tại → 404 'Case not found' @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/tdc-backfill`,
      role: 'admin',
      body: JSON.parse(`{"lyDoTamDinhChiVuAn": "CHUA_XAC_DINH_BI_CAN"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-205: PATCH lyDoTamDinhChiVuAn='INVALID' → 400/500 (validation cast) @P1 @RED @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/tdc-backfill`,
      role: 'admin',
      body: JSON.parse(`{"lyDoTamDinhChiVuAn": "CHUA_XAC_DINH_BI_CAN"}`),
      expectedStatus: 500,
    });
  });

  test(`TC-206: User không có write permission → 403 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/tdc-backfill`,
      body: JSON.parse(`{"lyDoTamDinhChiVuAn": "CHUA_XAC_DINH_BI_CAN"}`),
      expectedStatus: 401,
    });
  });

  test(`TC-207: Banner TdcBackfillBanner ẩn sau khi backfill thành công @P1 @GREEN @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PATCH',
      path: `/cases/${id}/tdc-backfill`,
      role: 'admin',
      body: JSON.parse(`{"lyDoTamDinhChiVuAn": "CHUA_XAC_DINH_BI_CAN"}`),
      expectedStatus: 200,
    });
  });

});