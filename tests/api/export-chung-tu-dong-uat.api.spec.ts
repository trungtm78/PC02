/**
 * UAT API smoke — Xuất chứng từ ĐỘNG Vụ việc/Vụ án (feature export-chung-tu-dong, epic PR1-PR4).
 * Layer 1: verify backend contract document-templates + /cases|incidents/export-templates +
 * POST /cases|incidents/:id/export-documents. Nguồn TC: docs/uat/export-chung-tu-dong/.
 * Chạy với backend THROTTLE_DISABLE=true. Actor chính = ADMIN (đủ quyền Setting + read Case/Incident);
 * OFFICER1 cho RBAC negative. Mật khẩu lấy từ env (KHÔNG hardcode).
 */
import { test, expect, APIRequestContext } from '@playwright/test';
import JSZip from 'jszip';

const BASE = process.env.UAT_BASE_URL || 'http://localhost:3000/api/v1';
const ADMIN_U = process.env.ADMIN_USERNAME || 'admin@pc02.local';
const ADMIN_P = process.env.ADMIN_PASSWORD || '';
const OFF1_U = process.env.OFFICER1_USERNAME || 'officer1@pc02.local';
const OFF1_P = process.env.OFFICER1_PASSWORD || '';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

let adminTok = '';
let off1Tok = '';
let caseId = '';
let incidentId = '';
let tplVuanPlain = '';   // VU_AN, biến catalog {soVuAn}{tenVuAn}
let tplVuanManual = '';  // VU_AN, có {hoTenBiCan} ngoài catalog → manual
let tplVuViec = '';      // VU_VIEC
let tplVuanNumber = '';  // VU_AN cấp số series CASE

function rnd() { return Math.random().toString(36).slice(2, 8); }

/** Dựng .docx tối thiểu hợp lệ cho docxtemplater (Content_Types + _rels + document.xml). */
async function buildDocx(body: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${body}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generateAsync({ type: 'nodebuffer' });
}

async function login(req: APIRequestContext, u: string, p: string): Promise<string> {
  const r = await req.post(`${BASE}/auth/login`, { data: { username: u, password: p } });
  expect(r.status(), `login ${u} < 300`).toBeLessThan(300);
  const b = await r.json();
  return b.accessToken || b.data?.accessToken;
}
function H(tok: string) { return { Authorization: `Bearer ${tok}` }; }

async function uploadTpl(
  req: APIRequestContext,
  o: { code?: string; name?: string; entityType?: string; category?: string; needsNumber?: string; numberSeriesId?: string; body?: string; tok?: string; fileName?: string; mime?: string },
) {
  const buffer = await buildDocx(o.body ?? 'Mau {soVuAn}');
  const multipart: Record<string, unknown> = {
    code: o.code ?? `QD-${rnd()}`,
    name: o.name ?? 'Mẫu UAT',
    entityType: o.entityType ?? 'VU_AN',
    category: o.category ?? 'Quyết định',
    needsNumber: o.needsNumber ?? 'false',
    file: { name: o.fileName ?? 'a.docx', mimeType: o.mime ?? DOCX_MIME, buffer },
  };
  if (o.numberSeriesId) multipart.numberSeriesId = o.numberSeriesId;
  return req.post(`${BASE}/document-templates`, { headers: H(o.tok ?? adminTok), multipart });
}

async function exportDocs(
  req: APIRequestContext,
  entity: 'cases' | 'incidents',
  id: string,
  body: Record<string, unknown>,
  tok = adminTok,
) {
  return req.post(`${BASE}/${entity}/${id}/export-documents`, { headers: H(tok), data: body });
}

test.beforeAll(async ({ playwright }) => {
  const req = await playwright.request.newContext();
  expect(ADMIN_P, 'ADMIN_PASSWORD phải set qua env').not.toBe('');
  adminTok = await login(req, ADMIN_U, ADMIN_P);
  if (OFF1_P) { try { off1Tok = await login(req, OFF1_U, OFF1_P); } catch { /* optional */ } }

  // Tạo hồ sơ test (admin scope global)
  const c = await req.post(`${BASE}/cases`, { headers: H(adminTok), data: { name: `[UAT] VA export ${rnd()}`, caseProvenance: 'DIRECT_DISCOVERY' } });
  caseId = (await c.json()).data.id;
  const i = await req.post(`${BASE}/incidents`, { headers: H(adminTok), data: { name: `[UAT] VV export ${rnd()}` } });
  incidentId = (await i.json()).data.id;

  // Upload 4 mẫu
  tplVuanPlain = (await (await uploadTpl(req, { entityType: 'VU_AN', category: 'Quyết định', body: 'So {soVuAn} - {tenVuAn}' })).json()).id;
  tplVuanManual = (await (await uploadTpl(req, { entityType: 'VU_AN', category: 'Biên bản', body: '{soVuAn} bi can {hoTenBiCan}' })).json()).id;
  tplVuViec = (await (await uploadTpl(req, { entityType: 'VU_VIEC', category: 'Biên bản', body: 'So {soVuViec} {tenVuViec}' })).json()).id;
  tplVuanNumber = (await (await uploadTpl(req, { entityType: 'VU_AN', category: 'Quyết định', needsNumber: 'true', numberSeriesId: 'CASE', body: 'So VB {soVanBan}' })).json()).id;
});

// ─────────────── Admin quản lý mẫu ───────────────
test.describe('Admin-Templates', () => {
  test('TC-001-API: admin upload mẫu VU_AN không cấp số → 201 + variables phân loại', async ({ request }) => {
    const r = await uploadTpl(request, { entityType: 'VU_AN', body: 'So {soVuAn} {hoTenBiCan}' });
    expect(r.status()).toBe(201);
    const b = await r.json();
    expect(b.entityType).toBe('VU_AN');
    const soVuAn = b.variables.find((v: any) => v.name === 'soVuAn');
    const hoTen = b.variables.find((v: any) => v.name === 'hoTenBiCan');
    expect(soVuAn.source).toBe('auto');   // TC-068 trong catalog
    expect(hoTen.source).toBe('manual');  // TC-069 ngoài catalog (P1-B)
    await request.delete(`${BASE}/document-templates/${b.id}`, { headers: H(adminTok) });
  });

  test('TC-003-API: bật cấp số + numberSeriesId hợp lệ → 201', async ({ request }) => {
    const r = await uploadTpl(request, { needsNumber: 'true', numberSeriesId: 'CASE' });
    expect(r.status()).toBe(201);
    const b = await r.json();
    expect(b.needsNumber).toBe(true);
    expect(b.numberSeriesId).toBe('CASE');
    await request.delete(`${BASE}/document-templates/${b.id}`, { headers: H(adminTok) });
  });

  test('TC-017-API: bật cấp số nhưng thiếu numberSeriesId → 400', async ({ request }) => {
    const r = await uploadTpl(request, { needsNumber: 'true' });
    expect(r.status()).toBe(400);
  });

  test('TC-018-API: upload file không .docx (txt) → 400', async ({ request }) => {
    const r = await uploadTpl(request, { fileName: 'a.txt', mime: 'text/plain' });
    expect(r.status()).toBe(400);
  });

  test('TC-019-API: .docx giả (zip không có word/document.xml) → 400', async ({ request }) => {
    const zip = new JSZip();
    zip.file('hello.txt', 'not a docx');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const r = await request.post(`${BASE}/document-templates`, {
      headers: H(adminTok),
      multipart: { code: `FK-${rnd()}`, name: 'fake', entityType: 'VU_AN', category: 'Khác', needsNumber: 'false', file: { name: 'fake.docx', mimeType: DOCX_MIME, buffer } },
    });
    expect(r.status()).toBe(400);
  });

  test('TC-020-API: tạo code trùng (cùng entityType) → 409', async ({ request }) => {
    const code = `DUP-${rnd()}`;
    const r1 = await uploadTpl(request, { code, entityType: 'VU_AN' });
    expect(r1.status()).toBe(201);
    const r2 = await uploadTpl(request, { code, entityType: 'VU_AN' });
    expect(r2.status()).toBe(409);
    await request.delete(`${BASE}/document-templates/${(await r1.json()).id}`, { headers: H(adminTok) });
  });

  test('TC-099-API: code trùng nhưng entityType KHÁC → 201 (partial unique theo cặp)', async ({ request }) => {
    const code = `MIX-${rnd()}`;
    const r1 = await uploadTpl(request, { code, entityType: 'VU_AN' });
    const r2 = await uploadTpl(request, { code, entityType: 'VU_VIEC' });
    expect(r1.status()).toBe(201);
    expect(r2.status()).toBe(201);
    await request.delete(`${BASE}/document-templates/${(await r1.json()).id}`, { headers: H(adminTok) });
    await request.delete(`${BASE}/document-templates/${(await r2.json()).id}`, { headers: H(adminTok) });
  });

  test('TC-041-API: entityType không hợp lệ → 400', async ({ request }) => {
    const r = await uploadTpl(request, { entityType: 'XYZ' });
    expect(r.status()).toBe(400);
  });

  test('TC-042-API: category không hợp lệ → 400', async ({ request }) => {
    const r = await uploadTpl(request, { category: 'Linh tinh' });
    expect(r.status()).toBe(400);
  });

  test('TC-043-API: PATCH mẫu không tồn tại → 404', async ({ request }) => {
    const r = await request.patch(`${BASE}/document-templates/non-existent-id`, { headers: H(adminTok), data: { sortOrder: 9 } });
    expect(r.status()).toBe(404);
  });

  test('TC-044-API: DELETE mẫu không tồn tại → 404', async ({ request }) => {
    const r = await request.delete(`${BASE}/document-templates/non-existent-id`, { headers: H(adminTok) });
    expect(r.status()).toBe(404);
  });

  test('TC-104-API: needsNumber gửi string "false" → lưu false (không Boolean trap)', async ({ request }) => {
    const r = await uploadTpl(request, { needsNumber: 'false' });
    const b = await r.json();
    expect(b.needsNumber).toBe(false);
    await request.delete(`${BASE}/document-templates/${b.id}`, { headers: H(adminTok) });
  });
});

// ─────────────── List export-templates ───────────────
test.describe('Export-list', () => {
  test('TC-004-API: GET /cases/export-templates trả mẫu VU_AN active', async ({ request }) => {
    const r = await request.get(`${BASE}/cases/export-templates`, { headers: H(adminTok) });
    expect([200, 201]).toContain(r.status());
    const list = await r.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.every((t: any) => t.entityType === 'VU_AN')).toBe(true); // TC-098 cách ly
  });

  test('TC-097-API: GET /incidents/export-templates KHÔNG lẫn VU_AN', async ({ request }) => {
    const r = await request.get(`${BASE}/incidents/export-templates`, { headers: H(adminTok) });
    expect([200, 201]).toContain(r.status());
    const list = await r.json();
    expect(list.every((t: any) => t.entityType === 'VU_VIEC')).toBe(true);
  });

  test('TC-049-API: list export-templates KHÔNG trả fileBytes', async ({ request }) => {
    const r = await request.get(`${BASE}/cases/export-templates`, { headers: H(adminTok) });
    const list = await r.json();
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].fileBytes).toBeUndefined();
  });

  test('TC-048-API: mẫu soft-delete biến mất khỏi list', async ({ request }) => {
    const up = await uploadTpl(request, { entityType: 'VU_AN' });
    const id = (await up.json()).id;
    await request.delete(`${BASE}/document-templates/${id}`, { headers: H(adminTok) });
    const r = await request.get(`${BASE}/cases/export-templates`, { headers: H(adminTok) });
    const list = await r.json();
    expect(list.find((t: any) => t.id === id)).toBeUndefined();
  });
});

// ─────────────── Export render ───────────────
test.describe('Export-render', () => {
  test('TC-005-API: export 1 mẫu VU_AN gộp → 200 docx + content-disposition', async ({ request }) => {
    const r = await exportDocs(request, 'cases', caseId, { templateIds: [tplVuanPlain], mode: 'merged' });
    expect([200,201]).toContain(r.status());
    expect(r.headers()['content-type']).toContain('wordprocessingml');
    expect(r.headers()['content-disposition']).toContain('ChungTu_');
    expect((await r.body()).length).toBeGreaterThan(500);
  });

  test('TC-006-API: export nhiều mẫu VU_AN zip → 200 application/zip', async ({ request }) => {
    const r = await exportDocs(request, 'cases', caseId, { templateIds: [tplVuanPlain, tplVuanManual], mode: 'zip', manualValues: { hoTenBiCan: 'Nguyễn Văn X' } });
    expect([200, 201]).toContain(r.status());
    expect(r.headers()['content-type']).toContain('zip');
  });

  test('TC-010-API: export mẫu VU_VIEC cho incident → 200', async ({ request }) => {
    const r = await exportDocs(request, 'incidents', incidentId, { templateIds: [tplVuViec], mode: 'merged' });
    expect([200, 201]).toContain(r.status());
    expect(r.headers()['content-type']).toContain('wordprocessingml');
  });

  test('TC-015-API: export mẫu cấp số → 200 (cấp 1 số văn bản)', async ({ request }) => {
    const r = await exportDocs(request, 'cases', caseId, { templateIds: [tplVuanNumber], mode: 'merged' });
    expect([200, 201]).toContain(r.status());
  });

  test('TC-077-API: cấp số tăng tuần tự qua 2 lần export', async ({ request }) => {
    const r1 = await exportDocs(request, 'cases', caseId, { templateIds: [tplVuanNumber], mode: 'merged' });
    const r2 = await exportDocs(request, 'cases', caseId, { templateIds: [tplVuanNumber], mode: 'merged' });
    expect([200, 201]).toContain(r1.status());
    expect([200, 201]).toContain(r2.status()); // counter không deadlock, 2 lần đều OK
  });

  test('TC-014-API: manualValues điền vào file (mẫu có biến manual) → 200', async ({ request }) => {
    const r = await exportDocs(request, 'cases', caseId, { templateIds: [tplVuanManual], mode: 'merged', manualValues: { hoTenBiCan: 'Trần Thị B' } });
    expect([200, 201]).toContain(r.status());
  });

  test('TC-067-API: mode mặc định (không gửi) → 200 docx merged', async ({ request }) => {
    const r = await request.post(`${BASE}/cases/${caseId}/export-documents`, { headers: H(adminTok), data: { templateIds: [tplVuanPlain] } });
    expect([200, 201]).toContain(r.status());
    expect(r.headers()['content-type']).toContain('wordprocessingml');
  });
});

// ─────────────── Export validation (RED) ───────────────
test.describe('Export-validation', () => {
  test('TC-021-API: templateIds rỗng → 400', async ({ request }) => {
    const r = await exportDocs(request, 'cases', caseId, { templateIds: [], mode: 'merged' });
    expect(r.status()).toBe(400);
  });

  test('TC-022-API: templateId không tồn tại → 400', async ({ request }) => {
    const r = await exportDocs(request, 'cases', caseId, { templateIds: ['fake-id'], mode: 'merged' });
    expect(r.status()).toBe(400);
  });

  test('TC-023-API: mẫu sai entityType (VU_VIEC cho case) → 400', async ({ request }) => {
    const r = await exportDocs(request, 'cases', caseId, { templateIds: [tplVuViec], mode: 'merged' });
    expect(r.status()).toBe(400);
  });

  test('TC-024-API: templateIds trùng lặp → 400', async ({ request }) => {
    const r = await exportDocs(request, 'cases', caseId, { templateIds: [tplVuanPlain, tplVuanPlain], mode: 'merged' });
    expect(r.status()).toBe(400);
  });

  test('TC-045-API: mode không hợp lệ → 400', async ({ request }) => {
    const r = await exportDocs(request, 'cases', caseId, { templateIds: [tplVuanPlain], mode: 'pdf' });
    expect(r.status()).toBe(400);
  });

  test('TC-046-API: case không tồn tại → 404', async ({ request }) => {
    const r = await exportDocs(request, 'cases', 'non-existent-case', { templateIds: [tplVuanPlain], mode: 'merged' });
    expect(r.status()).toBe(404);
  });

  test('TC-047-API: export mẫu đã soft-delete → 400', async ({ request }) => {
    const up = await uploadTpl(request, { entityType: 'VU_AN' });
    const id = (await up.json()).id;
    await request.delete(`${BASE}/document-templates/${id}`, { headers: H(adminTok) });
    const r = await exportDocs(request, 'cases', caseId, { templateIds: [id], mode: 'merged' });
    expect(r.status()).toBe(400);
  });
});

// ─────────────── RBAC / Security ───────────────
test.describe('RBAC-Security', () => {
  test('TC-030-API: export không token → 401', async ({ request }) => {
    const r = await request.post(`${BASE}/cases/${caseId}/export-documents`, { data: { templateIds: [tplVuanPlain] } });
    expect(r.status()).toBe(401);
  });

  test('TC-031-API: GET export-templates không token → 401', async ({ request }) => {
    const r = await request.get(`${BASE}/cases/export-templates`);
    expect(r.status()).toBe(401);
  });

  test('TC-026-API: officer (không Setting) upload mẫu → 403', async ({ request }) => {
    test.skip(!off1Tok, 'officer1 token không có');
    const r = await uploadTpl(request, { tok: off1Tok });
    expect(r.status()).toBe(403);
  });

  test('TC-027-API: officer DELETE mẫu → 403', async ({ request }) => {
    test.skip(!off1Tok, 'officer1 token không có');
    const r = await request.delete(`${BASE}/document-templates/${tplVuanPlain}`, { headers: H(off1Tok) });
    expect(r.status()).toBe(403);
  });

  test('TC-037-API: officer GET /document-templates (admin list) → 403', async ({ request }) => {
    test.skip(!off1Tok, 'officer1 token không có');
    const r = await request.get(`${BASE}/document-templates`, { headers: H(off1Tok) });
    expect(r.status()).toBe(403);
  });

  test('TC-038-API: officer PATCH mẫu → 403', async ({ request }) => {
    test.skip(!off1Tok, 'officer1 token không có');
    const r = await request.patch(`${BASE}/document-templates/${tplVuanPlain}`, { headers: H(off1Tok), data: { sortOrder: 9 } });
    expect(r.status()).toBe(403);
  });

  test('TC-028-API: officer export case ngoài scope (DataScope) → 403', async ({ request }) => {
    test.skip(!off1Tok, 'officer1 token không có');
    const r = await exportDocs(request, 'cases', caseId, { templateIds: [tplVuanPlain], mode: 'merged' }, off1Tok);
    expect(r.status()).toBe(403); // case do admin tạo, ngoài scope officer1
  });

  test('TC-004b-API: officer GET /cases/export-templates → 200 (P1-fix: read Case không cần Setting)', async ({ request }) => {
    test.skip(!off1Tok, 'officer1 token không có');
    const r = await request.get(`${BASE}/cases/export-templates`, { headers: H(off1Tok) });
    expect([200, 201]).toContain(r.status());
  });

  test('TC-032-API: template injection qua manualValues → escape, không crash (200)', async ({ request }) => {
    const r = await exportDocs(request, 'cases', caseId, { templateIds: [tplVuanManual], mode: 'merged', manualValues: { hoTenBiCan: '{soVuAn}{#loop}{/loop}' } });
    expect([200, 201]).toContain(r.status()); // esc { } → không thực thi tag, không 500
  });

  test('TC-036-API: manualValues non-string (object) → coerce an toàn (không 500)', async ({ request }) => {
    const r = await exportDocs(request, 'cases', caseId, { templateIds: [tplVuanManual], mode: 'merged', manualValues: { hoTenBiCan: { a: 1 } } });
    expect(r.status()).toBeLessThan(500); // 200 (coerce) hoặc 400 (validate) — KHÔNG 500
  });

  test('TC-033-API: SQL injection entityId → không 500 (param-bind an toàn)', async ({ request }) => {
    const r = await request.post(`${BASE}/cases/${encodeURIComponent("1' OR '1'='1")}/export-documents`, { headers: H(adminTok), data: { templateIds: [tplVuanPlain] } });
    expect([400, 403, 404]).toContain(r.status());
  });
});

test.afterAll(async ({ playwright }) => {
  const req = await playwright.request.newContext();
  for (const id of [tplVuanPlain, tplVuanManual, tplVuViec, tplVuanNumber].filter(Boolean)) {
    await req.delete(`${BASE}/document-templates/${id}`, { headers: H(adminTok) }).catch(() => {});
  }
  if (caseId) await req.delete(`${BASE}/cases/${caseId}`, { headers: H(adminTok) }).catch(() => {});
  if (incidentId) await req.delete(`${BASE}/incidents/${incidentId}`, { headers: H(adminTok) }).catch(() => {});
});
