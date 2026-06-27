/**
 * UAT API smoke — Popup Xuất chứng từ Đơn thư (feature petition-export).
 * Layer 1: verify backend contract POST /petitions/:id/export-documents.
 * Chạy với backend THROTTLE_DISABLE=true (tránh 429 khi smoke).
 * Nguồn TC: docs/uat/petition-export/uat.json (module M3-M6, các case máy kiểm được).
 */
import { test, expect, APIRequestContext } from '@playwright/test';
import JSZip from 'jszip';

const BASE = process.env.UAT_BASE_URL || 'http://localhost:3000/api/v1';
const USER = process.env.UAT_USERNAME || 'admin@pc02.local';
const PASS = process.env.UAT_PASSWORD || ''; // BẮT BUỘC set qua env khi chạy (không hardcode mật khẩu)
const DOC7 = [
  'BIEN_NHAN', 'PHIEU_DE_XUAT', 'PHIEU_CHUYEN_NGUON_TIN', 'PHIEU_CHUYEN_DON',
  'THONG_BAO_CHUYEN', 'THONG_BAO_HUONG_DAN', 'THONG_BAO_TRA_LAI',
];

let token = '';
let crimeId = '';
let pFull = '';        // đơn đủ trường cho cả 7 mẫu
let pNoDeXuat = '';    // thiếu deXuat (PHIEU_DE_XUAT fail)
let pNoTraLai = '';    // thiếu lyDoTraDon (THONG_BAO_TRA_LAI fail)

async function login(req: APIRequestContext): Promise<string> {
  const r = await req.post(`${BASE}/auth/login`, { data: { username: USER, password: PASS } });
  expect(r.status(), 'login phải 200/201').toBeLessThan(300);
  const b = await r.json();
  return b.accessToken || b.data?.accessToken;
}
function auth() { return { Authorization: `Bearer ${token}` }; }
async function createPetition(req: APIRequestContext, extra: Record<string, unknown>): Promise<string> {
  const r = await req.post(`${BASE}/petitions`, {
    headers: auth(),
    data: {
      receivedDate: '2026-06-27', senderName: 'UAT Người Gửi', senderPhone: '0900000009',
      senderAddress: '1 Đường UAT', petitionType: 'TO_CAO', crimeChinhId: crimeId,
      summary: 'Nội dung UAT', detailContent: 'Chi tiết UAT', ...extra,
    },
  });
  const b = await r.json();
  return (b.data || b).id;
}
async function exportDocs(req: APIRequestContext, id: string, docTypes: unknown, mode?: string) {
  const data: Record<string, unknown> = { docTypes };
  if (mode !== undefined) data.mode = mode;
  return req.post(`${BASE}/petitions/${id}/export-documents`, { headers: auth(), data });
}

test.beforeAll(async ({ playwright }) => {
  const req = await playwright.request.newContext();
  token = await login(req);
  const cr = await req.get(`${BASE}/crimes?limit=1`, { headers: auth() });
  const cb = await cr.json();
  const items = cb.data?.data || cb.data || cb.items || cb;
  crimeId = (Array.isArray(items) ? items[0] : items.items?.[0]).id;
  pFull = await createPetition(req, {
    nhanThay: 'Nhận thấy vi phạm', deXuat: 'Đề xuất xác minh',
    lyDoChuyen: 'Không thẩm quyền', canCuPhapLy: 'Điều 145 BLTTHS',
    huongDanKhoiKien: 'Khởi kiện TAND', lyDoTraDon: 'Thiếu tài liệu',
  });
  pNoDeXuat = await createPetition(req, { lyDoChuyen: 'x', canCuPhapLy: 'y', huongDanKhoiKien: 'z', lyDoTraDon: 'w' });
  pNoTraLai = await createPetition(req, {
    nhanThay: 'a', deXuat: 'b', lyDoChuyen: 'c', canCuPhapLy: 'd', huongDanKhoiKien: 'e',
  });
  await req.dispose();
});

// ───────────────────── M3: Merged ─────────────────────
for (const dt of DOC7) {
  test(`TC-EXP-M3-merged-${dt}-API: merged mẫu ${dt} → 201 docx`, async ({ request }) => {
    const r = await exportDocs(request, pFull, [dt], 'merged');
    expect(r.status()).toBe(201);
    const buf = await r.body();
    expect(buf.length).toBeGreaterThan(2000);
    expect(buf.slice(0, 2).toString()).toBe('PK'); // docx = zip
  });
}
test('TC-EXP-M3-all7-API: merged 7 mẫu → 1 docx, đúng 6 ngắt trang, 1 sectPr', async ({ request }) => {
  const r = await exportDocs(request, pFull, DOC7, 'merged');
  expect(r.status()).toBe(201);
  const zip = await JSZip.loadAsync(await r.body());
  const doc = await zip.file('word/document.xml')!.async('string');
  expect((doc.match(/<w:br w:type="page"\/>/g) || []).length).toBe(6);
  expect((doc.match(/<w:sectPr/g) || []).length).toBe(1);
});
test('TC-EXP-M3-2mau-API: merged 2 mẫu → 1 ngắt trang', async ({ request }) => {
  const r = await exportDocs(request, pFull, ['BIEN_NHAN', 'PHIEU_DE_XUAT'], 'merged');
  expect(r.status()).toBe(201);
  const zip = await JSZip.loadAsync(await r.body());
  const doc = await zip.file('word/document.xml')!.async('string');
  expect((doc.match(/<w:br w:type="page"\/>/g) || []).length).toBe(1);
});
test('TC-EXP-M3-1mau-API: merged 1 mẫu → 0 ngắt trang', async ({ request }) => {
  const r = await exportDocs(request, pFull, ['BIEN_NHAN'], 'merged');
  expect(r.status()).toBe(201);
  const zip = await JSZip.loadAsync(await r.body());
  const doc = await zip.file('word/document.xml')!.async('string');
  expect((doc.match(/<w:br w:type="page"\/>/g) || []).length).toBe(0);
});
test('TC-EXP-M3-default-API: bỏ mode → mặc định merged (.docx)', async ({ request }) => {
  const r = await exportDocs(request, pFull, ['BIEN_NHAN', 'BIEN_NHAN']);
  expect(r.status()).toBe(201);
  expect((await r.body()).slice(0, 2).toString()).toBe('PK');
});

// ───────────────────── M4: Zip ─────────────────────
test('TC-EXP-M4-zip7-API: zip 7 mẫu → 7 entry .docx có số văn bản', async ({ request }) => {
  const r = await exportDocs(request, pFull, DOC7, 'zip');
  expect(r.status()).toBe(201);
  const zip = await JSZip.loadAsync(await r.body());
  const names = Object.keys(zip.files);
  expect(names.length).toBe(7);
  expect(names.every((n) => n.endsWith('.docx'))).toBeTruthy();
  expect(names.some((n) => /\d+BN/.test(n))).toBeTruthy();
});
test('TC-EXP-M4-zip1-API: zip 1 mẫu → 1 entry', async ({ request }) => {
  const r = await exportDocs(request, pFull, ['BIEN_NHAN'], 'zip');
  expect(r.status()).toBe(201);
  const zip = await JSZip.loadAsync(await r.body());
  expect(Object.keys(zip.files).length).toBe(1);
});
test('TC-EXP-M4-dedupe-API: zip docType trùng → 1 entry unique', async ({ request }) => {
  const r = await exportDocs(request, pFull, ['BIEN_NHAN', 'BIEN_NHAN'], 'zip');
  expect(r.status()).toBe(201);
  const zip = await JSZip.loadAsync(await r.body());
  expect(Object.keys(zip.files).length).toBe(1);
});

// ───────────────────── M5: Validation (RED → 400/404) ─────────────────────
const RED400: [string, unknown, string | undefined][] = [
  ['docTypes rỗng []', [], 'merged'],
  ['docType ngoài allowlist', ['HACKED'], 'merged'],
  ['mode sai pdf', ['BIEN_NHAN'], 'pdf'],
  ['mode ZIP viết hoa', ['BIEN_NHAN'], 'ZIP'],
  ['docTypes không phải mảng', 'BIEN_NHAN' as unknown, 'merged'],
  ['phần tử docTypes là số', [123], 'merged'],
  ['docType chuỗi rỗng', [''], 'merged'],
  ['docType sai hoa-thường', ['bien_nhan'], 'merged'],
  ['trộn hợp lệ + sai', ['BIEN_NHAN', 'XXX'], 'merged'],
];
for (const [name, docTypes, mode] of RED400) {
  test(`TC-EXP-M5-400 [${name}] → 400`, async ({ request }) => {
    const r = await exportDocs(request, pFull, docTypes, mode);
    expect(r.status(), `case: ${name}`).toBe(400);
  });
}
test('TC-EXP-M5-missing-docTypes-API: thiếu hẳn docTypes → 400', async ({ request }) => {
  const r = await request.post(`${BASE}/petitions/${pFull}/export-documents`, { headers: auth(), data: { mode: 'merged' } });
  expect(r.status()).toBe(400);
});
test('TC-EXP-M5-emptybody-API: body rỗng {} → 400', async ({ request }) => {
  const r = await request.post(`${BASE}/petitions/${pFull}/export-documents`, { headers: auth(), data: {} });
  expect(r.status()).toBe(400);
});
test('TC-EXP-M5-404-API: id không tồn tại → 404', async ({ request }) => {
  const r = await exportDocs(request, 'khong-ton-tai-xyz', ['BIEN_NHAN'], 'merged');
  expect(r.status()).toBe(404);
});

// ───────────────────── M5: Atomic / số văn bản ─────────────────────
test('TC-EXP-M5-atomic-missing-API: thiếu deXuat + PHIEU_DE_XUAT → 400', async ({ request }) => {
  const r = await exportDocs(request, pNoDeXuat, ['BIEN_NHAN', 'PHIEU_DE_XUAT'], 'merged');
  expect(r.status()).toBe(400);
});
test('TC-EXP-M5-atomic-last-API: mẫu cuối (THONG_BAO_TRA_LAI) thiếu → 400 toàn request', async ({ request }) => {
  const r = await exportDocs(request, pNoTraLai, DOC7, 'merged');
  expect(r.status()).toBe(400);
});
test('TC-EXP-M5-nogap-API: export fail KHÔNG tiêu số văn bản (no gap)', async ({ request }) => {
  const num = async () => {
    const r = await exportDocs(request, pFull, ['BIEN_NHAN'], 'zip');
    const zip = await JSZip.loadAsync(await r.body());
    const n = Object.keys(zip.files)[0].match(/(\d+)BN/);
    return parseInt(n![1], 10);
  };
  const n1 = await num();
  const fail = await exportDocs(request, pNoDeXuat, ['BIEN_NHAN', 'PHIEU_DE_XUAT'], 'merged');
  expect(fail.status()).toBe(400);
  const n2 = await num();
  expect(n2 - n1, 'số BN chỉ tăng 1 (export fail không tiêu số)').toBe(1);
});

// ───────────────────── M6: Security ─────────────────────
test('TC-EXP-M6-noauth-API: không token → 401', async ({ request }) => {
  const r = await request.post(`${BASE}/petitions/${pFull}/export-documents`, { data: { docTypes: ['BIEN_NHAN'], mode: 'merged' } });
  expect(r.status()).toBe(401);
});
test('TC-EXP-M6-badtoken-API: token sai → 401', async ({ request }) => {
  const r = await request.post(`${BASE}/petitions/${pFull}/export-documents`, {
    headers: { Authorization: 'Bearer sai.token.xyz' }, data: { docTypes: ['BIEN_NHAN'], mode: 'merged' },
  });
  expect(r.status()).toBe(401);
});
test('TC-EXP-M6-noBearer-API: thiếu prefix Bearer → 401', async ({ request }) => {
  const r = await request.post(`${BASE}/petitions/${pFull}/export-documents`, {
    headers: { Authorization: token }, data: { docTypes: ['BIEN_NHAN'], mode: 'merged' },
  });
  expect(r.status()).toBe(401);
});
test('TC-EXP-M6-sqli-API: SQLi trong id → không 500 (404/400)', async ({ request }) => {
  const r = await exportDocs(request, "1' OR '1'='1", ['BIEN_NHAN'], 'merged');
  expect([400, 404]).toContain(r.status());
});
test('TC-EXP-M6-xss-API: XSS trong docTypes → 400', async ({ request }) => {
  const r = await exportDocs(request, pFull, ['<script>alert(1)</script>'], 'merged');
  expect(r.status()).toBe(400);
});
test('TC-EXP-M6-traversal-API: path traversal docType → 400', async ({ request }) => {
  const r = await exportDocs(request, pFull, ['../../etc/passwd'], 'merged');
  expect(r.status()).toBe(400);
});
test('TC-EXP-M6-getmethod-API: GET thay POST → 404/405', async ({ request }) => {
  const r = await request.get(`${BASE}/petitions/${pFull}/export-documents`, { headers: auth() });
  expect([404, 405]).toContain(r.status());
});
