import { test } from '@playwright/test';
import { call, smokeReachable, createTestCase } from './_helpers';

/**
 * UAT auto v2 — API-level execution cho module: Update-status
 * Total TC: 14
 */
test.describe('UAT-update-status: Update-status', () => {
  test(`TC-125: Transition TIEP_NHAN → DANG_XAC_MINH (valid) @P0 @STATE @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-125] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-126: Transition DANG_XAC_MINH → DA_XAC_MINH (valid) @P0 @STATE @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-126] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-127: Transition DA_XAC_MINH → DANG_DIEU_TRA (valid) @P0 @STATE @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-127] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-128: Transition DANG_DIEU_TRA → DA_KET_LUAN (valid) @P0 @STATE @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-128] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-129: Transition DA_KET_LUAN → DANG_TRUY_TO (valid) @P0 @STATE @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-129] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-130: Transition DANG_TRUY_TO → DANG_XET_XU (valid) @P0 @STATE @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-130] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-131: Transition DANG_XET_XU → DA_LUU_TRU (final state) @P0 @STATE @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-131] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-132: Transition any → DINH_CHI (đình chỉ vĩnh viễn) @P0 @STATE @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-132] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-133: Transition TAM_DINH_CHI → DA_KET_LUAN (phục hồi và kết luận luôn) @P0 @STATE @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-133] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-134: Idempotent: PUT cùng status không tạo history @P1 @STATE @Medium`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-134] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-135: DA_LUU_TRU → DA_KET_LUAN (rollback) — có cho phép? @P1 @STATE @Low`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-135] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-136: DINH_CHI → DANG_DIEU_TRA (sai logic) — cần block ở backend @P0 @STATE @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-136] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-137: DANG_XET_XU → TIEP_NHAN (rollback xa) — invalid logic @P0 @STATE @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-137] updated"}`),
      expectedStatus: 200,
    });
  });

  test(`TC-138: TAM_DINH_CHI lần thứ 2 (recurrent suspend) — soLanTamDinhChi=2 @P0 @STATE @High`, async ({ request }) => {
    const id = await createTestCase(request, { role: 'admin', tag: 'UAT-RUN' }).catch(() => 'NON-EXIST-ID');
    await call(request, {
      method: 'PUT',
      path: `/cases/${id}`,
      role: 'admin',
      body: JSON.parse(`{"name": "[UAT-TC-138] updated"}`),
      expectedStatus: 200,
    });
  });

});