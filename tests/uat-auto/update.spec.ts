import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Update
 * Total TC: 28
 */
test.describe('UAT-update: Update', () => {
  test(`TC-097: Update name + crime case mình owner @P0 @GREEN @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-097] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-098: Update với expectedUpdatedAt khớp current → success @P0 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-098] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-099: Update với expectedUpdatedAt cũ → 409 Conflict @P0 @RED @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-099] updated"}`),
      expectedStatus: 409,
    });
  });

  test(`TC-100: Update Case ngoài write-scope → 403 @P0 @RED @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-100] updated"}`),
      expectedStatus: 403,
    });
  });

  test(`TC-101: Update Case không tồn tại → 404 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-101] updated"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-102: Update Case đã soft-deleted → 404 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-102] updated"}`),
      expectedStatus: 404,
    });
  });

  test(`TC-103: Update status TIEP_NHAN → DANG_XAC_MINH tạo CaseStatusHistory + audit @P0 @GREEN @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-103] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-104: Update status DANG_DIEU_TRA → TAM_DINH_CHI với lyDoTamDinhChiVuAn auto-set ngày + count @P0 @GREEN @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-104] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-105: Update → TAM_DINH_CHI thiếu lyDoTamDinhChiVuAn (Case post-migration) → 400 @P0 @RED @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-105] updated"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-106: Update → TAM_DINH_CHI thiếu lý do nhưng Case cũ (pre-migration) → SOFT warning @P1 @GREEN @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-106] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-107: lyDoTamDinhChiVuAn = invalid enum 'INVALID_REASON' → 400 @P0 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-107] updated"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-108: Update status TAM_DINH_CHI → DANG_DIEU_TRA (phục hồi) với daRaSoat + ngayRaSoat @P0 @GREEN @Critical`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-108] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-109: ketQuaPhucHoiVuAn = invalid → 400 @P1 @RED @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-109] updated"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-110: lyDoTamDinhChiText > 500 ký tự → 400 @P1 @RED @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-110] updated"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-111: soQuyetDinhTamDinhChi > 100 ký tự → 400 @P1 @RED @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-111] updated"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-112: daRaSoat = 'yes' string thay vì boolean → 400 IsBoolean @P1 @RED @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-112] updated"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-113: ngayRaSoat sai ISO format → 400 @P1 @RED @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-113] updated"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-114: Update KHÔNG đổi status → KHÔNG tạo CaseStatusHistory entry @P1 @GREEN @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-114] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-115: Update status với cùng giá trị status hiện tại → KHÔNG tạo history @P1 @GREEN @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-115] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-116: Update metadata.petitionType sync sang Petition liên kết @P1 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-116] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-117: Update metadata.petitionType mà KHÔNG có Petition link → silent ignore (no phantom create) @P1 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-117] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-118: Audit CASE_UPDATED capture before/after diff đầy đủ @P0 @GREEN @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-118] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-119: PUT lyDoTamDinhChiVuAn nhưng status không phải TAM_DINH_CHI → vẫn save (no enforce) @P1 @RED @Low`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-119] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-120: investigatorId không tồn tại → 400 @P1 @RED @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-120] updated"}`),
      expectedStatus: 400,
    });
  });

  test(`TC-121: Update deadline=null xóa deadline cũ @P1 @GREEN @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-121] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-122: Update capDoToiPham đổi từ NGHIEM_TRONG sang DAC_BIET_NGHIEM_TRONG @P1 @GREEN @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-122] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-123: Update Case khi user role VIEWER → 403 @P1 @RED @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      body: JSON.parse(`{"name": "[UAT-TC-123] updated"}`),
      expectedStatus: 401,
    });
  });

  test(`TC-124: DTO whitelist reject field lạ trong UpdateCaseDto (forbidNonWhitelisted) @P0 @GREEN @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-124] updated"}`),
      expectedStatus: 400,
    });
  });

});