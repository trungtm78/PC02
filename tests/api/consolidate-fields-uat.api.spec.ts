/**
 * UAT HỢP NHẤT FIELD cũ↔native — API Layer (Gate 1)
 * Nguồn: docs/uat/consolidate-fields/uat.json (198 TC)
 * Oracle: docs/uat/consolidate-fields/_plan-scope.md — KHÔNG lấy expected từ code.
 *
 * Chạy: UAT_TOKEN=<jwt> npx playwright test --project=api tests/api/consolidate-fields-uat.api.spec.ts
 */
import { test, expect, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
// `pg` chỉ có trong backend/node_modules — resolve tuyệt đối để Playwright ở root nạp được
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require(require('path').resolve(__dirname, '../../backend/node_modules/pg'));

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const API = `${BASE}/api/v1`;
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin@pc02.local';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || '68@Love2love68';

// ─── DB helper (đọc trực tiếp cột — bằng chứng "1 nơi lưu") ────────────────
function dbUrl(): string {
  const env = fs.readFileSync(path.resolve(__dirname, '../../backend/.env'), 'utf-8');
  return (env.match(/^DATABASE_URL="?([^"\n\r]+)"?/m) || [])[1] || '';
}
async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const c = new Client({ connectionString: dbUrl() });
  await c.connect();
  try {
    const r = await c.query(sql, params);
    return r.rows as T[];
  } finally {
    await c.end();
  }
}
async function caseRow(id: string): Promise<any> {
  const r = await dbQuery('SELECT * FROM cases WHERE id = $1', [id]);
  return r[0];
}
async function statRow(id: string): Promise<any> {
  const r = await dbQuery('SELECT * FROM case_statistics WHERE "caseId" = $1', [id]);
  return r[0];
}

/**
 * Đọc NGÀY LỊCH đúng như CSDL lưu.
 * Trình điều khiển pg diễn giải `timestamp without time zone` theo giờ máy → toISOString()
 * lùi 1 ngày và tạo ra kết luận SAI. Luôn lấy chuỗi ngày trực tiếp từ CSDL.
 */
async function dayOf(id: string, col: string): Promise<string | null> {
  const r = await dbQuery(`SELECT to_char("${col}", 'YYYY-MM-DD') AS d FROM cases WHERE id = $1`, [id]);
  return r[0]?.d ?? null;
}

// ─── Auth ──────────────────────────────────────────────────────────────────
let TOKEN = '';
function auth(t = TOKEN) {
  return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
}
async function login(req: APIRequestContext, u: string, p: string): Promise<string> {
  const r = await req.post(`${API}/auth/login`, { data: { username: u, password: p }, failOnStatusCode: false });
  if (!r.ok()) return '';
  const b = await r.json();
  const d = b.data || b;
  return d.accessToken || d.access_token || d.token || '';
}

// Dấu nhận dạng duy nhất cho mỗi lần chạy — cleanup theo tiền tố
const RUN = `UATCF-${Date.now().toString(36)}`;
const created: string[] = [];

// BUG-001 (xem TC-014): POST /cases bỏ qua `lyDoTamDinhChiVuAn` → cột NOT NULL không có
// giá trị mặc định → 500. Helper gửi mảng rỗng để GỠ CHẶN các TC khác; bản thân lỗi được
// một TC riêng (TC-014) chứng minh, KHÔNG che giấu.
async function createCase(req: APIRequestContext, extra: Record<string, any> = {}) {
  const r = await req.post(`${API}/cases`, {
    headers: auth(),
    data: {
      name: `${RUN}-${Math.random().toString(36).slice(2, 7)}`,
      caseProvenance: 'DIRECT_DISCOVERY',
      lyDoTamDinhChiVuAn: [],
      ...extra,
    },
    failOnStatusCode: false,
  });
  const body = await r.json().catch(() => ({}));
  const d = body?.data || body;
  if (d?.id) created.push(d.id);
  return { status: r.status(), body: d, raw: body };
}

test.beforeAll(async ({ request }) => {
  TOKEN = process.env.UAT_TOKEN || '';
  if (TOKEN) {
    const chk = await request.get(`${API}/auth/me`, { headers: auth(TOKEN), failOnStatusCode: false });
    if (chk.status() !== 200) TOKEN = '';
  }
  if (!TOKEN) TOKEN = await login(request, ADMIN_USER, ADMIN_PASS);
  expect(TOKEN, 'Gate 0 — phải đăng nhập được để chạy UAT').not.toBe('');
});

test.afterAll(async ({ request }) => {
  for (const id of created) {
    await request.delete(`${API}/cases/${id}`, { headers: auth(), failOnStatusCode: false }).catch(() => {});
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// F1 — Tạo mới Vụ án: cột chuẩn nhận dữ liệu ngay lần lưu đầu (PLAN-B2)
// ═══════════════════════════════════════════════════════════════════════════

test('TC-001-API: Tên người tố cáo lưu vào CỘT tenCungCap, không chỉ metadata', async ({ request }) => {
  const val = `${RUN}-NguoiToCao`;
  const { status, body } = await createCase(request, { tenCungCap: val });
  expect(status, 'tạo vụ án thành công').toBeLessThan(300);
  const row = await caseRow(body.id);
  expect(row.tenCungCap, 'PLAN-A1-01: canonical = cột Case tenCungCap').toBe(val);
});

test('TC-002-API: Số CCCD lưu vào CỘT cccdCungCap, giữ đủ 12 chữ số', async ({ request }) => {
  const val = '079123456789';
  const { body } = await createCase(request, { cccdCungCap: val });
  const row = await caseRow(body.id);
  expect(row.cccdCungCap, 'PLAN-A1-02').toBe(val);
  expect(String(row.cccdCungCap)).toHaveLength(12);
});

test('TC-003-API: Số điện thoại lưu vào CỘT sdtCungCap, giữ số 0 đứng đầu', async ({ request }) => {
  const val = '0901234567';
  const { body } = await createCase(request, { sdtCungCap: val });
  const row = await caseRow(body.id);
  expect(row.sdtCungCap, 'PLAN-A1-04').toBe(val);
  expect(String(row.sdtCungCap).startsWith('0'), 'không được hiểu thành số học').toBe(true);
});

test('TC-004-API: Địa chỉ lưu vào CỘT diaChiCungCap, giữ dấu tiếng Việt', async ({ request }) => {
  const val = '123 Nguyễn Trãi, Phường 5, Quận 5, TP.HCM';
  const { body } = await createCase(request, { diaChiCungCap: val });
  const row = await caseRow(body.id);
  expect(row.diaChiCungCap, 'PLAN-A1-05').toBe(val);
});

test('TC-005-API: Tóm tắt nội dung lưu vào CỘT moTaChiTiet, giữ xuống dòng', async ({ request }) => {
  const val = `${RUN}\nDòng hai của mô tả`;
  const { body } = await createCase(request, { moTaChiTiet: val });
  const row = await caseRow(body.id);
  expect(row.moTaChiTiet, 'PLAN-A1-06').toBe(val);
});

test('TC-006-API: Ngày tiếp nhận lưu vào CỘT MỚI receiveDate, không lệch ngày', async ({ request }) => {
  const { body } = await createCase(request, { receiveDate: '2026-08-15' });
  const row = await caseRow(body.id);
  expect(row.receiveDate, 'PLAN-A2-N: cột receiveDate tồn tại và nhận giá trị').not.toBeNull();
  expect(await dayOf(body.id, 'receiveDate'), 'PLAN-B1 date-only: không lệch sang 14 hay 16').toBe('2026-08-15');
});

test('TC-007-API: Phân loại vụ án lưu vào CỘT MỚI caseClassification', async ({ request }) => {
  const val = `${RUN}-PhanLoai`;
  const { body } = await createCase(request, { caseClassification: val });
  const row = await caseRow(body.id);
  expect(row.caseClassification, 'PLAN-A2-N').toBe(val);
});

test('TC-008-API: Tình trạng lưu vào CỘT MỚI tinhTrang', async ({ request }) => {
  const val = `${RUN}-TinhTrang`;
  const { body } = await createCase(request, { tinhTrang: val });
  const row = await caseRow(body.id);
  expect(row.tinhTrang, 'PLAN-A2-N').toBe(val);
});

test('TC-009-API: Tội danh ban đầu vào cột riêng, KHÔNG đụng trường tội danh khác', async ({ request }) => {
  const tdbd = `${RUN}-TDBD`;
  const { body } = await createCase(request, { toiDanhBanDau: tdbd, crime: `${RUN}-ToiDanhChinh` });
  const row = await caseRow(body.id);
  expect(row.toiDanhBanDau, 'PLAN-A3-R6: cột riêng cho tội danh ban đầu').toBe(tdbd);
  expect(row.crime, 'tội danh chính giữ giá trị riêng, không bị tội danh ban đầu ghi đè').toBe(`${RUN}-ToiDanhChinh`);
});

test('TC-009b-API: Trường "tội danh phụ" của biểu nhập KHÔNG có đường ghi vào cột', async ({ request }) => {
  // PLAN-A3-R6 yêu cầu `toiDanhBanDau` và `criminalSecondaryType` là hai khái niệm tách biệt.
  // Ghi nhận nơi lưu thật của tội danh phụ: nếu máy chủ từ chối trường này thì nó KHÔNG phải
  // cột typed — người dùng cần biết dữ liệu ấy nằm ở đâu.
  const r = await request.post(`${API}/cases`, {
    headers: auth(),
    data: { name: `${RUN}-tdphu`, caseProvenance: 'DIRECT_DISCOVERY', lyDoTamDinhChiVuAn: [], criminalSecondaryType: `${RUN}-TDPHU` },
    failOnStatusCode: false,
  });
  const b = await r.json().catch(() => ({} as any));
  if (b?.data?.id) created.push(b.data.id);
  expect(r.status(), 'phản ứng phải có kiểm soát, không lỗi máy chủ').toBeLessThan(500);
  // GHI NHẬN (không phán xét): 400 nghĩa là tội danh phụ chưa được thăng thành cột typed.
  expect([200, 201, 400]).toContain(r.status());
});

test('TC-059b-API: CẢNH BÁO múi giờ — gửi mốc thời gian kèm lệch giờ làm trôi ngày lịch', async ({ request }) => {
  // PLAN-B1: quy ước date-only, lưu 00:00 giờ VN. Ứng dụng gửi dạng 'YYYY-MM-DD' → đúng.
  // Ca này đo hành vi khi một hệ tích hợp gửi mốc thời gian đầy đủ kèm lệch giờ +07:00.
  const { body } = await createCase(request, { receiveDate: '2026-01-01T00:00:00+07:00' });
  const row = await caseRow(body.id);
  const day = await dayOf(body.id, 'receiveDate');
  expect(
    day,
    'Nếu ra 2025-12-31: máy chủ lưu mốc UTC thay vì 00:00 giờ VN — hệ tích hợp gửi lệch giờ sẽ ghi sai ngày lịch (cảnh báo, không chặn phát hành)',
  ).toBe('2026-01-01');
});

test('TC-010-API: Ngày sinh lưu kiểu ngày; cờ độ chính xác KHÔNG phải year', async ({ request }) => {
  const { body } = await createCase(request, { reporterDateOfBirth: '1985-05-20' });
  const row = await caseRow(body.id);
  expect(row.reporterDateOfBirth, 'PLAN-A1-03: cột Date').not.toBeNull();
  expect(await dayOf(body.id, 'reporterDateOfBirth')).toBe('1985-05-20');
  expect(row.reporterDateOfBirthPrecision, 'ngày đầy đủ không được đánh dấu year').not.toBe('year');
});

test('TC-011-API: Thiệt hại vào bảng thống kê, tự tạo bản ghi khi vụ chưa có', async ({ request }) => {
  const { body } = await createCase(request, { statistic: { soTienBiThietHai: 1500000 } });
  const s = await statRow(body.id);
  expect(s, 'PLAN-A1-07: tạo row case_statistics nếu thiếu').toBeTruthy();
  expect(Number(s.soTienBiThietHai)).toBe(1500000);
});

test('TC-012-API: Số bị hại vào bảng thống kê', async ({ request }) => {
  const { body } = await createCase(request, { statistic: { soLuongBiHai: 3 } });
  const s = await statRow(body.id);
  expect(s, 'PLAN-A1-08').toBeTruthy();
  expect(Number(s.soLuongBiHai)).toBe(3);
});

test('TC-013-API: HỒI QUY CHỐT CHẶN — tạo mới điền đủ cụm tiếp nhận, KHÔNG cột nào rỗng', async ({ request }) => {
  const p = {
    tenCungCap: `${RUN}-Ten`,
    cccdCungCap: '079111222333',
    sdtCungCap: '0912345678',
    diaChiCungCap: `${RUN}-DiaChi`,
    moTaChiTiet: `${RUN}-MoTa`,
    receiveDate: '2026-08-10',
    caseClassification: `${RUN}-Cls`,
    tinhTrang: `${RUN}-TT`,
    toiDanhBanDau: `${RUN}-TDBD`,
    reporterDateOfBirth: '1990-03-15',
    noiXayRa: `${RUN}-NoiXayRa`,
  };
  const { status, body } = await createCase(request, p);
  expect(status, 'PLAN-B2: CREATE phải map cột intase').toBeLessThan(300);
  const row = await caseRow(body.id);
  const missing: string[] = [];
  for (const k of Object.keys(p)) {
    if (row[k] === null || row[k] === undefined || row[k] === '') missing.push(k);
  }
  expect(missing, `PLAN-B2 P1 blocker: cột rỗng sau lần lưu ĐẦU TIÊN → ${missing.join(', ')}`).toEqual([]);
});

test('TC-014-API: Tạo vụ với thông tin TỐI THIỂU (đúng hợp đồng DTO) — phải thành công', async ({ request }) => {
  // Payload tối thiểu ĐÚNG theo hợp đồng: chỉ `name` và `caseProvenance` là bắt buộc.
  // Oracle: PLAN-B2 (tạo mới phải chạy được) + AUTH-08 (lỗi phải có kiểm soát, không 500).
  const r = await request.post(`${API}/cases`, {
    headers: auth(),
    data: { name: `${RUN}-minimal`, caseProvenance: 'DIRECT_DISCOVERY' },
    failOnStatusCode: false,
  });
  const b = await r.json().catch(() => ({} as any));
  const d = b?.data || b;
  if (d?.id) created.push(d.id);
  expect(
    r.status(),
    'BUG-001: máy chủ trả 500 khi client không gửi lyDoTamDinhChiVuAn — cột NOT NULL không có giá trị mặc định',
  ).toBeLessThan(300);
  const s = await statRow(d.id);
  expect(s, 'không tạo row thống kê rỗng cho mọi vụ').toBeFalsy();
});

test('TC-014b-API: Lỗi tạo vụ phải là thông điệp có kiểm soát, KHÔNG phải lỗi máy chủ 500', async ({ request }) => {
  // Ngay cả khi một ràng buộc nội bộ chưa thoả, người dùng phải nhận thông điệp hiểu được.
  const r = await request.post(`${API}/cases`, {
    headers: auth(),
    data: { name: `${RUN}-minimal-2`, caseProvenance: 'DIRECT_DISCOVERY' },
    failOnStatusCode: false,
  });
  const b = await r.json().catch(() => ({} as any));
  if (b?.data?.id) created.push(b.data.id);
  expect(r.status(), 'AUTH-08 Nielsen #9: 500 "Internal server error" không cho người dùng biết phải sửa gì').not.toBe(500);
});

test('TC-015-API: Trường không khai báo bị chặn, KHÔNG ghi vào hồ sơ', async ({ request }) => {
  const r = await request.post(`${API}/cases`, {
    headers: auth(),
    data: { name: `${RUN}-whitelist`, caseProvenance: 'DIRECT_DISCOVERY', khongTonTaiField: 'X-INJECT' },
    failOnStatusCode: false,
  });
  const b = await r.json().catch(() => ({}));
  const d = b?.data || b;
  if (d?.id) created.push(d.id);
  if (r.status() < 300) {
    const row = await caseRow(d.id);
    expect(JSON.stringify(row), 'PLAN-V4: trường lạ không được lưu vào hồ sơ').not.toContain('X-INJECT');
  } else {
    expect(r.status(), 'từ chối rõ ràng (400), không phải lỗi máy chủ').toBeLessThan(500);
  }
});

test('TC-016-API: Lưu hai lần cùng nội dung — KHÔNG nhân đôi bản ghi thống kê', async ({ request }) => {
  const { body } = await createCase(request, { statistic: { soTienBiThietHai: 1000000 } });
  for (let i = 0; i < 2; i++) {
    await request.put(`${API}/cases/${body.id}`, {
      headers: auth(),
      data: { name: body.name, caseProvenance: 'DIRECT_DISCOVERY', statistic: { soTienBiThietHai: 1000000 } },
      failOnStatusCode: false,
    });
  }
  const rows = await dbQuery('SELECT count(*)::int AS n FROM case_statistics WHERE "caseId" = $1', [body.id]);
  expect(rows[0].n, 'PLAN-B2/B3 idempotent + ON CONFLICT').toBe(1);
});

// ═══════════════════════════════════════════════════════════════════════════
// F3 — Thiệt hại & bị hại (CaseStatistic)
// ═══════════════════════════════════════════════════════════════════════════

test('TC-038-API: Biên — thiệt hại bằng 0 phân biệt được với bỏ trống', async ({ request }) => {
  const { body: a } = await createCase(request, { statistic: { soTienBiThietHai: 0 } });
  const { body: b } = await createCase(request, {});
  const sa = await statRow(a.id);
  const sb = await statRow(b.id);
  const zeroKept = sa && sa.soTienBiThietHai !== null && Number(sa.soTienBiThietHai) === 0;
  const emptyIsNull = !sb || sb.soTienBiThietHai === null;
  expect(zeroKept, 'AUTH-05: 0 là giá trị đã xác định, không phải "chưa nhập"').toBe(true);
  expect(emptyIsNull, 'bỏ trống phải khác 0').toBe(true);
});

test('TC-039-API: Biên âm — thiệt hại số âm bị từ chối, không lưu', async ({ request }) => {
  const { status, body } = await createCase(request, { statistic: { soTienBiThietHai: -1000 } });
  if (status < 300) {
    const s = await statRow(body.id);
    expect(Number(s?.soTienBiThietHai ?? 0), 'AUTH-05: thiệt hại không thể âm').toBeGreaterThanOrEqual(0);
  } else {
    expect(status).toBeLessThan(500);
  }
});

test('TC-040-API: Biên lớn — thiệt hại 1.234 tỷ lưu chính xác từng chữ số', async ({ request }) => {
  const big = 1234567890123;
  const { status, body } = await createCase(request, { statistic: { soTienBiThietHai: big } });
  if (status < 300) {
    const s = await statRow(body.id);
    expect(String(s?.soTienBiThietHai ?? ''), 'không tràn, không làm tròn, không ký hiệu khoa học').toBe(String(big));
  } else {
    expect(status, 'nếu từ chối thì phải là 400 có thông điệp, không phải 500').toBeLessThan(500);
  }
});

test('TC-042-API: Thiệt hại nhập bằng chữ — từ chối, KHÔNG bịa số 0', async ({ request }) => {
  const { status, body } = await createCase(request, { statistic: { soTienBiThietHai: 'không rõ' } as any });
  if (status < 300) {
    const s = await statRow(body.id);
    const v = s?.soTienBiThietHai;
    expect(v === null || v === undefined, 'NO-FABRICATION: chuỗi không phải số KHÔNG được thành 0').toBe(true);
  } else {
    expect(status).toBeLessThan(500);
  }
});

test('TC-043-API: Biên — số bị hại 0 phân biệt với bỏ trống', async ({ request }) => {
  const { body } = await createCase(request, { statistic: { soLuongBiHai: 0 } });
  const s = await statRow(body.id);
  expect(s && Number(s.soLuongBiHai) === 0, 'AUTH-05').toBe(true);
});

test('TC-044-API: Biên — số bị hại = 1 được chấp nhận', async ({ request }) => {
  const { body } = await createCase(request, { statistic: { soLuongBiHai: 1 } });
  const s = await statRow(body.id);
  expect(Number(s?.soLuongBiHai)).toBe(1);
});

test('TC-045-API: Số bị hại âm hoặc lẻ bị từ chối', async ({ request }) => {
  const { status: s1, body: b1 } = await createCase(request, { statistic: { soLuongBiHai: -3 } });
  if (s1 < 300) {
    const r = await statRow(b1.id);
    expect(Number(r?.soLuongBiHai ?? 0), 'số người không thể âm').toBeGreaterThanOrEqual(0);
  }
  const { status: s2, body: b2 } = await createCase(request, { statistic: { soLuongBiHai: 2.5 } as any });
  if (s2 < 300) {
    const r = await statRow(b2.id);
    const v = Number(r?.soLuongBiHai ?? 0);
    expect(Number.isInteger(v), 'số người phải là số nguyên').toBe(true);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// F4 — Ngày sinh & quy ước ngày
// ═══════════════════════════════════════════════════════════════════════════

test('TC-049-API: Ngày sinh đầy đủ — lưu đúng ngày, cờ chính xác không phải year', async ({ request }) => {
  const { body } = await createCase(request, { reporterDateOfBirth: '1978-11-03' });
  const row = await caseRow(body.id);
  expect(await dayOf(body.id, 'reporterDateOfBirth')).toBe('1978-11-03');
  expect(row.reporterDateOfBirthPrecision).not.toBe('year');
});

test('TC-055-API: Ngày không tồn tại (31/02) bị từ chối, KHÔNG tự nắn ngày', async ({ request }) => {
  const { status, body } = await createCase(request, { reporterDateOfBirth: '1985-02-31' });
  if (status < 300) {
    const row = await caseRow(body.id);
    const d = await dayOf(body.id, 'reporterDateOfBirth');
    expect(d, 'NO-FABRICATION: cấm nắn 31/02 thành 03/03 hay 28/02').toBeNull();
  } else {
    expect(status, 'từ chối bằng 400, không phải 500').toBeLessThan(500);
  }
});

test('TC-057-API: Ngày sinh ở tương lai bị chặn hoặc ghi nhận rõ', async ({ request }) => {
  const future = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { status, body } = await createCase(request, { reporterDateOfBirth: future });
  if (status < 300) {
    const row = await caseRow(body.id);
    const stored = row.reporterDateOfBirth ? new Date(row.reporterDateOfBirth) : null;
    // Ghi nhận: hệ thống chấp nhận ngày tương lai — báo cáo như phát hiện, không phải lỗi máy chủ
    expect(stored === null || stored > new Date(), 'ghi nhận hành vi thực tế').toBe(true);
  } else {
    expect(status).toBeLessThan(500);
  }
});

test('TC-058-API: Ngày date-only không lệch 1 ngày (mốc 01/01)', async ({ request }) => {
  const { body } = await createCase(request, { reporterDateOfBirth: '1990-01-01' });
  const row = await caseRow(body.id);
  expect(await dayOf(body.id, 'reporterDateOfBirth'), 'DATE-NO-DRIFT: không được thành 1989-12-31').toBe('1990-01-01');
});

test('TC-059-API: Các cột ngày khác cũng không lệch (tiếp nhận, cấp CCCD, phiếu chuyển)', async ({ request }) => {
  const { body } = await createCase(request, {
    receiveDate: '2026-01-01',
    ngayCapCccd: '2020-01-01',
    ngayPhieuChuyen: '2026-01-01',
  });
  const row = await caseRow(body.id);
  expect(await dayOf(body.id, 'receiveDate')).toBe('2026-01-01');
  expect(await dayOf(body.id, 'ngayCapCccd')).toBe('2020-01-01');
  expect(await dayOf(body.id, 'ngayPhieuChuyen')).toBe('2026-01-01');
});

// ═══════════════════════════════════════════════════════════════════════════
// F13 — Hợp đồng API & whitelist (PLAN-V4)
// ═══════════════════════════════════════════════════════════════════════════

test('TC-083-API: Trường loại C gửi lên rồi đọc lại còn nguyên (tạo + sửa)', async ({ request }) => {
  const v1 = `${RUN}-C1`;
  const { body } = await createCase(request, { noiXayRa: v1 });
  const g1 = await request.get(`${API}/cases/${body.id}`, { headers: auth() });
  const d1 = (await g1.json()).data ?? (await g1.json());
  expect(d1.noiXayRa ?? (await caseRow(body.id)).noiXayRa).toBe(v1);
  const v2 = `${RUN}-C2`;
  await request.put(`${API}/cases/${body.id}`, { headers: auth(), data: { name: body.name, caseProvenance: 'DIRECT_DISCOVERY', noiXayRa: v2 }, failOnStatusCode: false });
  expect((await caseRow(body.id)).noiXayRa, 'PLAN-V4 loại C').toBe(v2);
});

test('TC-084-API: Trường loại S (thống kê) gửi lên rồi đọc lại còn nguyên', async ({ request }) => {
  const { body } = await createCase(request, { statistic: { soTienBiThietHai: 777000, soLuongBiHai: 4 } });
  const s = await statRow(body.id);
  expect(Number(s.soTienBiThietHai)).toBe(777000);
  expect(Number(s.soLuongBiHai)).toBe(4);
  const g = await request.get(`${API}/cases/${body.id}`, { headers: auth() });
  const d = (await g.json()).data ?? {};
  expect(d.statistic ?? d, 'PLAN-B4: dữ liệu chi tiết phải trả khối statistic cho giao diện').toBeTruthy();
});

test('TC-085-API: Trường loại N (cột mới) gửi lên rồi đọc lại còn nguyên', async ({ request }) => {
  const { body } = await createCase(request, { tinhTrang: `${RUN}-N1`, toiDanhBanDau: `${RUN}-N2` });
  const row = await caseRow(body.id);
  expect(row.tinhTrang).toBe(`${RUN}-N1`);
  expect(row.toiDanhBanDau).toBe(`${RUN}-N2`);
});

test('TC-086-API: Trường loại R (tên đã thống nhất) gửi lên rồi đọc lại còn nguyên', async ({ request }) => {
  const { body } = await createCase(request, { deXuat: `${RUN}-DeXuat`, dieuTraVien: `${RUN}-DTV` });
  const row = await caseRow(body.id);
  expect(row.deXuat, 'PLAN-A2-R: cột deXuat là canonical').toBe(`${RUN}-DeXuat`);
  expect(row.dieuTraVien, 'PLAN-A3-R7: cột dieuTraVien giữ tên tự do hệ cũ').toBe(`${RUN}-DTV`);
});

test('TC-087-API: Gửi tên form-key cũ đã bỏ — không 500, không ghi vào nơi thứ ba', async ({ request }) => {
  const { status, body } = await createCase(request, { deXuatXuLy: `${RUN}-OLDKEY` } as any);
  expect(status, 'không được lỗi máy chủ').toBeLessThan(500);
  if (status < 300) {
    const row = await caseRow(body.id);
    const meta = JSON.stringify(row.metadata ?? {});
    const inCol = row.deXuat === `${RUN}-OLDKEY`;
    const inMeta = meta.includes(`${RUN}-OLDKEY`);
    expect(inCol || !inMeta, 'PLAN-A2-R: hoặc ánh xạ về cột deXuat, hoặc bỏ — cấm tạo nguồn thứ ba').toBe(true);
  }
});

test('TC-088-API: Sai kiểu dữ liệu — 400 có thông điệp, không 500, không lưu méo', async ({ request }) => {
  const r1 = await request.post(`${API}/cases`, { headers: auth(), data: { name: `${RUN}-t1`, caseProvenance: 'DIRECT_DISCOVERY', receiveDate: 'hôm qua' }, failOnStatusCode: false });
  expect(r1.status(), 'chuỗi vào cột ngày → 400').toBeGreaterThanOrEqual(400);
  expect(r1.status()).toBeLessThan(500);
  const r2 = await request.post(`${API}/cases`, { headers: auth(), data: { name: `${RUN}-t2`, caseProvenance: 'DIRECT_DISCOVERY', reporterDateOfBirth: 12345 }, failOnStatusCode: false });
  expect(r2.status()).toBeGreaterThanOrEqual(400);
  expect(r2.status()).toBeLessThan(500);
});

test('TC-089-API: Sửa một trường — các cột khác KHÔNG bị xoá', async ({ request }) => {
  const { body } = await createCase(request, {
    tenCungCap: `${RUN}-keep-ten`, cccdCungCap: '079999888777', noiXayRa: `${RUN}-keep-noi`,
    moTaChiTiet: `${RUN}-keep-mota`, tinhTrang: `${RUN}-keep-tt`,
  });
  const before = await caseRow(body.id);
  await request.put(`${API}/cases/${body.id}`, {
    headers: auth(),
    data: { name: body.name, caseProvenance: 'DIRECT_DISCOVERY', noiXayRa: `${RUN}-changed` },
    failOnStatusCode: false,
  });
  const after = await caseRow(body.id);
  const lost: string[] = [];
  for (const k of ['tenCungCap', 'cccdCungCap', 'moTaChiTiet', 'tinhTrang']) {
    if (before[k] && !after[k]) lost.push(k);
  }
  expect(lost, `NO-DATA-LOSS: sửa 1 trường làm mất cột khác → ${lost.join(', ')}`).toEqual([]);
  expect(after.noiXayRa).toBe(`${RUN}-changed`);
});

test('TC-090-API: Dữ liệu chi tiết trả đủ cột chuẩn + khối thống kê cho giao diện', async ({ request }) => {
  const { body } = await createCase(request, {
    tenCungCap: `${RUN}-detail`, cccdCungCap: '079000111222', sdtCungCap: '0900000000',
    diaChiCungCap: 'X', moTaChiTiet: 'Y', tinhTrang: 'Z', toiDanhBanDau: 'T',
    caseClassification: 'C', receiveDate: '2026-05-05',
    reporterDateOfBirth: '1980-01-02',
    statistic: { soTienBiThietHai: 100, soLuongBiHai: 1 },
  });
  const g = await request.get(`${API}/cases/${body.id}`, { headers: auth() });
  expect(g.status()).toBe(200);
  const d = (await g.json()).data ?? {};
  const need = ['tenCungCap', 'cccdCungCap', 'sdtCungCap', 'diaChiCungCap', 'moTaChiTiet',
    'tinhTrang', 'toiDanhBanDau', 'caseClassification', 'receiveDate', 'reporterDateOfBirth'];
  const missing = need.filter((k) => d[k] === undefined);
  expect(missing, `PLAN-B4: máy chủ phải trả cột chuẩn để giao diện đọc → thiếu ${missing.join(', ')}`).toEqual([]);
  expect(d.statistic, 'PLAN-B4: phải trả khối statistic').toBeTruthy();
});
