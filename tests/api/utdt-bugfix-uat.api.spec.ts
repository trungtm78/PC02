/**
 * UAT API Layer 1 — UTDT Bug Fix Verification
 *
 * Tập trung verify 3 bug fixes (v0.67.x):
 *   Bug 1: Bulk selection thiếu (UI-only, verify qua E2E)
 *   Bug 2: trangThaiPhanHoi không trả về từ API (verify tại đây)
 *   Bug 3: donViGiao validation chỉ frontend — backend phải reject khi thiếu
 *
 * TC mapping: docs/uat/utdt/uat_uy_thac_dieu_tra.md
 *
 * Chạy:
 *   UAT_PROD=1 npx playwright test tests/api/utdt-bugfix-uat.api.spec.ts --project=api
 *   # Local (app phải đang chạy):
 *   npx playwright test tests/api/utdt-bugfix-uat.api.spec.ts --project=api
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(role = ''): string {
  const suffix = role ? `-${role}` : '';
  const p = path.resolve(__dirname, `../../test-results/.auth-token${suffix}.txt`);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf-8').trim();
  return process.env.UAT_TOKEN || '';
}

function authHeader(role = ''): Record<string, string> {
  const t = getToken(role);
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

function apiUrl(baseURL: string | undefined, endpoint: string): string {
  const base = (baseURL ?? process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  const ep = endpoint.startsWith('/api') ? endpoint : `/api/v1${endpoint}`;
  return `${base}${ep}`;
}

const TEST_PREFIX = `[UAT-BUG-${Date.now()}]`;

const UTDT_PAYLOAD = {
  name: `${TEST_PREFIX} Ủy thác điều tra test`,
  crime: 'Trộm cắp tài sản — điều 173 BLHS',
  caseType: 'UY_THAC_DIEU_TRA',
  caseProvenance: 'UY_THAC_DIEU_TRA', // bắt buộc theo BLTTHS Đ.143
  donViGiao: 'PC01 - Công an TP. Hà Nội',
  loaiUyThac: 'UY_THAC_DIEU_TRA',
  ngayTiepNhan: new Date().toISOString().slice(0, 10),
};

// ID được set trong beforeAll và dùng trong toàn bộ describe
let sharedCaseId = '';

// ─── Bug 2: trangThaiPhanHoi phải có trong API response ───────────────────────

test.describe('Bug 2 Fix — trangThaiPhanHoi trong API response @bug2 @p0', () => {

  test.beforeAll(async ({ request }, testInfo) => {
    const res = await request.post(apiUrl(testInfo.config.projects[0]?.use?.baseURL as string, '/cases'), {
      data: { ...UTDT_PAYLOAD, name: `${TEST_PREFIX} BUG2 Setup` },
      headers: authHeader(),
      failOnStatusCode: false,
    });
    if (res.ok()) {
      const b = await res.json();
      sharedCaseId = (b.data ?? b).id ?? '';
    }
  });

  test.afterAll(async ({ request }, testInfo) => {
    if (!sharedCaseId) return;
    await request.delete(apiUrl(testInfo.config.projects[0]?.use?.baseURL as string, `/cases/${sharedCaseId}`), {
      data: { reason: 'Cleanup sau UAT Bug2 test suite' },
      headers: authHeader(),
      failOnStatusCode: false,
    });
  });

  test('TC-001: GET /cases?caseType=UY_THAC_DIEU_TRA → mỗi item có trangThaiPhanHoi @green @p0', async ({ request, baseURL }) => {
    const res = await request.get(apiUrl(baseURL, '/cases'), {
      params: { caseType: 'UY_THAC_DIEU_TRA', limit: 5, offset: 0 },
      headers: authHeader(),
      failOnStatusCode: false,
    });

    expect(res.status(), `API trả về ${res.status()} thay vì 200`).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data), 'data phải là array').toBe(true);
    expect(typeof body.total, 'total phải là number').toBe('number');

    // Bug 2 fix: mỗi UTDT item phải có trangThaiPhanHoi
    const items: Array<Record<string, unknown>> = body.data ?? [];
    for (const item of items) {
      expect(item, `Item ${item.id} thiếu trangThaiPhanHoi`).toHaveProperty('trangThaiPhanHoi');
      expect(
        ['DA_PHAN_HOI', 'CHUA_PHAN_HOI', 'KHONG_THUC_HIEN_DUOC', 'QUA_HAN'],
        `trangThaiPhanHoi="${item.trangThaiPhanHoi}" không hợp lệ`,
      ).toContain(item.trangThaiPhanHoi);
    }
  });

  test('TC-003: POST /cases tạo UTDT → response có trangThaiPhanHoi=CHUA_PHAN_HOI @green @p0', async ({ request, baseURL }) => {
    const res = await request.post(apiUrl(baseURL, '/cases'), {
      data: { ...UTDT_PAYLOAD, name: `${TEST_PREFIX} TC-003 trangThai` },
      headers: authHeader(),
      failOnStatusCode: false,
    });

    // Bug 2 fix: POST response phải có trangThaiPhanHoi computed
    expect(res.status(), `POST trả về ${res.status()}`).toBe(201);
    const full = await res.json();
    // API trả { success, data: {...}, message } — unwrap data
    const body = full.data ?? full;
    expect(body, 'Thiếu id').toHaveProperty('id');
    expect(body, 'Thiếu caseType').toHaveProperty('caseType', 'UY_THAC_DIEU_TRA');
    expect(body, 'Bug 2: trangThaiPhanHoi phải có trong response').toHaveProperty('trangThaiPhanHoi');
    expect(body.trangThaiPhanHoi, 'Mới tạo phải là CHUA_PHAN_HOI').toBe('CHUA_PHAN_HOI');

    // Cleanup
    if (body.id) {
      await request.delete(apiUrl(baseURL, `/cases/${body.id}`), {
        data: { reason: 'Cleanup TC-003 trangThai test' },
        headers: authHeader(),
        failOnStatusCode: false,
      });
    }
  });

  test('TC-004: PATCH cập nhật ketQua+ngayTraKetQua → trangThaiPhanHoi=DA_PHAN_HOI @green @p0', async ({ request, baseURL }) => {
    if (!sharedCaseId) {
      test.skip(true, 'beforeAll không tạo được case');
      return;
    }
    const res = await request.patch(apiUrl(baseURL, `/cases/${sharedCaseId}`), {
      data: {
        ketQuaUyThac: 'Đã xác minh xong — TC-004 test',
        ngayTraKetQua: new Date().toISOString().slice(0, 10),
      },
      headers: authHeader(),
      failOnStatusCode: false,
    });

    expect(res.status(), `PATCH trả về ${res.status()}`).toBe(200);
    const full = await res.json();
    const body = full.data ?? full;
    // Sau khi có cả hai trường → DA_PHAN_HOI
    expect(body, 'trangThaiPhanHoi phải có trong PATCH response').toHaveProperty('trangThaiPhanHoi');
    expect(body.trangThaiPhanHoi, 'Phải chuyển sang DA_PHAN_HOI').toBe('DA_PHAN_HOI');
  });

  test('TC-002: GET /cases/utdt-stats → 200 + đủ 4 byTrangThai keys @green @p0', async ({ request, baseURL }) => {
    const res = await request.get(apiUrl(baseURL, '/cases/utdt-stats'), {
      headers: authHeader(),
      failOnStatusCode: false,
    });

    expect(res.status(), `utdt-stats trả về ${res.status()}`).toBe(200);
    const body = await res.json();
    expect(body, 'Thiếu total').toHaveProperty('total');
    expect(body, 'Thiếu byTrangThai').toHaveProperty('byTrangThai');
    const keys = Object.keys(body.byTrangThai ?? {});
    expect(keys).toEqual(
      expect.arrayContaining(['DA_PHAN_HOI', 'CHUA_PHAN_HOI', 'KHONG_THUC_HIEN_DUOC', 'QUA_HAN']),
    );
    // Mỗi giá trị phải là number >= 0
    for (const [k, v] of Object.entries(body.byTrangThai)) {
      expect(typeof v, `byTrangThai.${k} phải là number`).toBe('number');
    }
  });

  test('TC-018: UTDT không có thoiHanUyThac → CHUA_PHAN_HOI (không phải QUA_HAN) @edge @p0', async ({ request, baseURL }) => {
    const res = await request.post(apiUrl(baseURL, '/cases'), {
      data: {
        name: `${TEST_PREFIX} TC-018 no-deadline`,
        crime: 'Test edge case',
        caseType: 'UY_THAC_DIEU_TRA',
        caseProvenance: 'UY_THAC_DIEU_TRA',
        donViGiao: 'PC01',
        // thoiHanUyThac không gửi → null
      },
      headers: authHeader(),
      failOnStatusCode: false,
    });
    if (!res.ok()) {
      test.skip(true, `Không tạo được case: ${res.status()}`);
      return;
    }
    const raw = await res.json();
    const body = raw.data ?? raw;

    // Không có deadline → không vào QUA_HAN
    expect(body.trangThaiPhanHoi, 'Không có thời hạn phải là CHUA_PHAN_HOI').toBe('CHUA_PHAN_HOI');

    // Cleanup
    await request.delete(apiUrl(baseURL, `/cases/${body.id}`), {
      data: { reason: 'Cleanup TC-018 edge case' },
      headers: authHeader(),
      failOnStatusCode: false,
    });
  });

  test('TC-020: ketQuaUyThac có nhưng thiếu ngayTraKetQua → CHUA_PHAN_HOI @edge @p0', async ({ request, baseURL }) => {
    const res = await request.post(apiUrl(baseURL, '/cases'), {
      data: {
        ...UTDT_PAYLOAD,
        name: `${TEST_PREFIX} TC-020 partial-ketqua`,
        ketQuaUyThac: 'Ghi chú nhưng chưa có ngày',
        // ngayTraKetQua bỏ trống
      },
      headers: authHeader(),
      failOnStatusCode: false,
    });
    if (!res.ok()) {
      test.skip(true, `Không tạo được case: ${res.status()}`);
      return;
    }
    const raw = await res.json();
    const body = raw.data ?? raw;

    // Cần CẢ HAI trường mới là DA_PHAN_HOI
    expect(body.trangThaiPhanHoi, 'Thiếu ngayTraKetQua phải là CHUA_PHAN_HOI').toBe('CHUA_PHAN_HOI');

    // Cleanup
    await request.delete(apiUrl(baseURL, `/cases/${body.id}`), {
      data: { reason: 'Cleanup TC-020 edge case' },
      headers: authHeader(),
      failOnStatusCode: false,
    });
  });
});

// ─── Bug 3: donViGiao validation ở backend ─────────────────────────────────────

test.describe('Bug 3 Fix — donViGiao backend validation @bug3 @p0', () => {

  test('TC-014: POST UTDT không có donViGiao → 400 validation error @red @p0', async ({ request, baseURL }) => {
    const res = await request.post(apiUrl(baseURL, '/cases'), {
      data: {
        name: `${TEST_PREFIX} TC-014 no-donViGiao`,
        crime: 'Trộm cắp',
        caseType: 'UY_THAC_DIEU_TRA',
        caseProvenance: 'UY_THAC_DIEU_TRA',
        // donViGiao cố ý bỏ để test Bug 3 validation
      },
      headers: authHeader(),
      failOnStatusCode: false,
    });

    // Bug 3 fix: backend phải reject (400) khi caseType=UTDT không có donViGiao
    expect(res.status(), `Thiếu donViGiao phải bị reject (400), nhận ${res.status()}`).toBe(400);
    const body = await res.json();
    const msgStr = JSON.stringify(body).toLowerCase();
    // Message phải đề cập donViGiao
    expect(
      msgStr.includes('don vi giao') || msgStr.includes('donvigia') || msgStr.includes('ủy thác'),
      `Message validation phải đề cập donViGiao: ${JSON.stringify(body)}`,
    ).toBe(true);
  });

  test('TC-014b: POST UTDT với donViGiao là spaces → trim rồi reject @red @p0', async ({ request, baseURL }) => {
    const res = await request.post(apiUrl(baseURL, '/cases'), {
      data: {
        name: `${TEST_PREFIX} TC-014b whitespace-donViGiao`,
        crime: 'Test',
        caseType: 'UY_THAC_DIEU_TRA',
        caseProvenance: 'UY_THAC_DIEU_TRA',
        donViGiao: '   ', // chỉ khoảng trắng — sau @Transform trim → empty → @IsNotEmpty fail
      },
      headers: authHeader(),
      failOnStatusCode: false,
    });

    // Bug 3 fix: @Transform trim → empty string → @IsNotEmpty fail → 400
    expect(res.status(), `Spaces-only donViGiao phải bị reject (400), nhận ${res.status()}`).toBe(400);
  });

  test('TC-003-with-donViGiao: POST UTDT có donViGiao hợp lệ → 201 @green @p0', async ({ request, baseURL }) => {
    const res = await request.post(apiUrl(baseURL, '/cases'), {
      data: UTDT_PAYLOAD,
      headers: authHeader(),
      failOnStatusCode: false,
    });

    expect(res.status(), `POST hợp lệ phải trả 201, nhận ${res.status()}`).toBe(201);
    const raw = await res.json();
    const body = raw.data ?? raw;
    expect(body.donViGiao, 'donViGiao phải được lưu đúng').toBe(UTDT_PAYLOAD.donViGiao);

    // Cleanup
    if (body.id) {
      await request.delete(apiUrl(baseURL, `/cases/${body.id}`), {
        data: { reason: 'Cleanup TC-003-with-donViGiao' },
        headers: authHeader(),
        failOnStatusCode: false,
      });
    }
  });
});

// ─── TC-005: Delete validation (liên quan đến cả 3 bugs) ─────────────────────

test.describe('Delete UTDT validation @p0', () => {
  let deleteTestId = '';

  test.beforeAll(async ({ request }, testInfo) => {
    const res = await request.post(apiUrl(testInfo.config.projects[0]?.use?.baseURL as string, '/cases'), {
      data: { ...UTDT_PAYLOAD, name: `${TEST_PREFIX} Delete-Test-Setup` },
      headers: authHeader(),
      failOnStatusCode: false,
    });
    if (res.ok()) {
      const b = await res.json();
      deleteTestId = (b.data ?? b).id ?? '';
    }
  });

  test('TC-021: DELETE với reason=9 ký tự → 400 @boundary @p0', async ({ request, baseURL }) => {
    if (!deleteTestId) {
      test.skip(true, 'Không tạo được case để test');
      return;
    }
    const res = await request.delete(apiUrl(baseURL, `/cases/${deleteTestId}`), {
      data: { reason: '123456789' }, // 9 ký tự — dưới ngưỡng 10
      headers: authHeader(),
      failOnStatusCode: false,
    });

    expect(res.status(), `9 ký tự phải bị từ chối (400), nhận ${res.status()}`).toBe(400);
  });

  test('TC-022: DELETE với reason=10 ký tự → 200/204 @boundary @p0', async ({ request, baseURL }) => {
    if (!deleteTestId) {
      test.skip(true, 'Không tạo được case để test');
      return;
    }
    const res = await request.delete(apiUrl(baseURL, `/cases/${deleteTestId}`), {
      data: { reason: '1234567890' }, // đúng 10 ký tự — ngưỡng tối thiểu
      headers: authHeader(),
      failOnStatusCode: false,
    });

    expect([200, 204], `10 ký tự phải được chấp nhận, nhận ${res.status()}`).toContain(res.status());
  });
});

// ─── Security P0 ──────────────────────────────────────────────────────────────

test.describe('Security — IDOR & Injection @security @p0', () => {

  test('TC-028: SQL injection trong search → 200 (Prisma parameterized, không crash) @p0', async ({ request, baseURL }) => {
    const payloads = ["' OR 1=1 --", '"; DROP TABLE cases; --', "1' AND SLEEP(5) --"];
    for (const q of payloads) {
      const res = await request.get(apiUrl(baseURL, '/cases'), {
        params: { caseType: 'UY_THAC_DIEU_TRA', search: q, limit: 5 },
        headers: authHeader(),
        failOnStatusCode: false,
      });
      expect(res.status(), `SQL injection '${q}' gây crash ${res.status()}`).toBe(200);
    }
  });

  test('TC-029: XSS trong donViGiao → lưu thành công, React escape khi render @p0', async ({ request, baseURL }) => {
    const xss = "<script>alert('xss')</script>";
    const res = await request.post(apiUrl(baseURL, '/cases'), {
      data: { ...UTDT_PAYLOAD, caseProvenance: 'UY_THAC_DIEU_TRA', name: `${TEST_PREFIX} TC-029 XSS`, donViGiao: xss },
      headers: authHeader(),
      failOnStatusCode: false,
    });
    if (!res.ok()) {
      test.skip(true, `Không tạo được case: ${res.status()}`);
      return;
    }
    const raw = await res.json();
    const body = raw.data ?? raw;
    // Server lưu string gốc (không strip — React escape khi render)
    expect(body.donViGiao, 'donViGiao phải lưu đúng giá trị gốc').toBe(xss);

    // Cleanup
    await request.delete(apiUrl(baseURL, `/cases/${body.id}`), {
      data: { reason: 'Cleanup TC-029 XSS test' },
      headers: authHeader(),
      failOnStatusCode: false,
    });
  });

  test('TC-026: IDOR — officer1 GET case của admin → 403/404 @p0', async ({ request, baseURL }) => {
    const officerToken = getToken('officer1');
    if (!officerToken) {
      test.skip(true, 'officer1 token không có — chạy với UAT_PROD=1');
      return;
    }

    // Admin tạo case
    const createRes = await request.post(apiUrl(baseURL, '/cases'), {
      data: { ...UTDT_PAYLOAD, caseProvenance: 'UY_THAC_DIEU_TRA', name: `${TEST_PREFIX} TC-026 IDOR target` },
      headers: authHeader(),
      failOnStatusCode: false,
    });
    if (!createRes.ok()) {
      test.skip(true, 'Không tạo được case để test IDOR');
      return;
    }
    const createBody = await createRes.json();
    const targetId = (createBody.data ?? createBody).id;

    // Officer1 GET case đó → bị từ chối
    const idorRes = await request.get(apiUrl(baseURL, `/cases/${targetId}`), {
      headers: { Authorization: `Bearer ${officerToken}` },
      failOnStatusCode: false,
    });
    expect([403, 404], `IDOR phải bị chặn, nhận ${idorRes.status()}`).toContain(idorRes.status());

    // Cleanup (admin)
    await request.delete(apiUrl(baseURL, `/cases/${targetId}`), {
      data: { reason: 'Cleanup TC-026 IDOR test' },
      headers: authHeader(),
      failOnStatusCode: false,
    });
  });
});

// ─── Performance P1 ───────────────────────────────────────────────────────────

test.describe('Performance @performance @p1', () => {

  test('TC-034: GET /cases?caseType=UY_THAC_DIEU_TRA < 2000ms', async ({ request, baseURL }) => {
    const t0 = Date.now();
    const res = await request.get(apiUrl(baseURL, '/cases'), {
      params: { caseType: 'UY_THAC_DIEU_TRA', limit: 20, offset: 0 },
      headers: authHeader(),
      failOnStatusCode: false,
    });
    const elapsed = Date.now() - t0;
    expect(res.status()).toBe(200);
    expect(elapsed, `API chậm: ${elapsed}ms > 2000ms`).toBeLessThan(2000);
  });

  test('TC-035: GET /cases/utdt-stats < 3000ms', async ({ request, baseURL }) => {
    const t0 = Date.now();
    const res = await request.get(apiUrl(baseURL, '/cases/utdt-stats'), {
      headers: authHeader(),
      failOnStatusCode: false,
    });
    const elapsed = Date.now() - t0;
    expect(res.status()).toBe(200);
    expect(elapsed, `utdt-stats chậm: ${elapsed}ms > 3000ms`).toBeLessThan(3000);
  });
});
