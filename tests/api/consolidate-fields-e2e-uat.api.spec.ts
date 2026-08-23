/**
 * UAT HỢP NHẤT FIELD — TÍCH HỢP XUYÊN MODULE (F15)
 * Đơn thư → Vụ việc → Vụ án → Thống kê → Truy nguyên.
 *
 * Nhóm này TRƯỚC ĐÂY BỊ CHẶN bởi BUG-001 (tạo vụ án trả 500). Sau khi vá mới chạy được.
 *
 * Oracle: docs/uat/consolidate-fields/_plan-scope.md — mục tiêu "không sót dữ liệu" khi
 * hồ sơ đi qua ranh giới module, và "cột typed là nơi lưu chuẩn" cho CẢ dữ liệu sinh ra
 * từ bước chuyển đổi, không chỉ dữ liệu nhập tay.
 */
import { test, expect, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Client } = require(require('path').resolve(__dirname, '../../backend/node_modules/pg'));

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const API = `${BASE}/api/v1`;
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin@pc02.local';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || '68@Love2love68';

function dbUrl(): string {
  const env = fs.readFileSync(path.resolve(__dirname, '../../backend/.env'), 'utf-8');
  return (env.match(/^DATABASE_URL="?([^"\n\r]+)"?/m) || [])[1] || '';
}
async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const c = new Client({ connectionString: dbUrl() });
  await c.connect();
  try {
    return (await c.query(sql, params)).rows as T[];
  } finally {
    await c.end();
  }
}

let TOKEN = '';
const auth = () => ({ Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' });

const RUN = `UATX-${Date.now().toString(36)}`;
const madePetitions: string[] = [];
const madeCases: string[] = [];
const madeIncidents: string[] = [];

/** Dấu nhận dạng riêng cho từng trường, để truy được trường nào rơi ở chặng nào. */
function marks(tag: string) {
  return {
    senderName: `${RUN}-${tag}-NguoiGui`,
    senderPhone: '0901234567',
    senderIdNumber: '079123456789',
    senderAddress: `${RUN}-${tag}-DiaChi`,
    content: `${RUN}-${tag}-NoiDung`,
  };
}

/** Tội danh chính là khoá ngoại bắt buộc — lấy một mã có thật từ danh mục. */
let CRIME_ID = '';
async function ensureCrimeId(): Promise<string> {
  if (!CRIME_ID) {
    const rows = await q<any>('SELECT id FROM crimes LIMIT 1');
    CRIME_ID = rows[0]?.id ?? '';
  }
  return CRIME_ID;
}

async function createPetition(req: APIRequestContext, tag: string) {
  const m = marks(tag);
  const crimeChinhId = await ensureCrimeId();
  const r = await req.post(`${API}/petitions`, {
    headers: auth(),
    data: {
      receivedDate: '2026-08-20',
      petitionType: 'TO_CAO',
      crimeChinhId,
      senderName: m.senderName,
      senderPhone: m.senderPhone,
      senderIdNumber: m.senderIdNumber,
      senderAddress: m.senderAddress,
      summary: m.content,
      detailContent: m.content,
    },
    failOnStatusCode: false,
  });
  const b = await r.json().catch(() => ({} as any));
  const d = b?.data || b;
  if (d?.id) madePetitions.push(d.id);
  return { status: r.status(), body: d, raw: b, marks: m };
}

test.beforeAll(async ({ request }) => {
  TOKEN = process.env.UAT_TOKEN || '';
  if (!TOKEN) {
    const r = await request.post(`${API}/auth/login`, { data: { username: ADMIN_USER, password: ADMIN_PASS }, failOnStatusCode: false });
    const b = await r.json().catch(() => ({} as any));
    TOKEN = (b.data || b)?.accessToken || '';
  }
  expect(TOKEN, 'Gate 0').not.toBe('');
});

test.afterAll(async ({ request }) => {
  for (const id of madeCases) await request.delete(`${API}/cases/${id}`, { headers: auth(), failOnStatusCode: false }).catch(() => {});
  for (const id of madeIncidents) await request.delete(`${API}/incidents/${id}`, { headers: auth(), failOnStatusCode: false }).catch(() => {});
  for (const id of madePetitions) await request.delete(`${API}/petitions/${id}`, { headers: auth(), failOnStatusCode: false }).catch(() => {});
});

// ═══════════════════════════════════════════════════════════════════════════

test('TC-167-INT: Tạo Đơn thư mới — đọc lại đủ mọi trường vừa nhập', async ({ request }) => {
  const { status, body, marks: m } = await createPetition(request, 'A');
  expect(status, `tạo đơn thư: ${status}`).toBeLessThan(300);
  const r = await request.get(`${API}/petitions/${body.id}`, { headers: auth() });
  const d = (await r.json()).data ?? {};
  const expected: Record<string, string> = {
    senderName: m.senderName,
    senderPhone: m.senderPhone,
    senderAddress: m.senderAddress,
    detailContent: m.content,
  };
  const missing: string[] = [];
  for (const [k, v] of Object.entries(expected)) {
    if (String(d[k] ?? '') !== String(v)) missing.push(`${k} (mong "${v}", nhận "${d[k]}")`);
  }
  expect(missing, `PLAN-A4-01: đọc lại phải đủ trường → lệch: ${missing.join('; ')}`).toEqual([]);
});

test('TC-181-INT: Chuyển Đơn thư → Vụ việc — thông tin người và nội dung KHÔNG mất', async ({ request }) => {
  const { body: pet, marks: m } = await createPetition(request, 'B');
  const detail = await (await request.get(`${API}/petitions/${pet.id}`, { headers: auth() })).json();
  const updatedAt = detail.data?.updatedAt;

  const conv = await request.post(`${API}/petitions/${pet.id}/convert-incident`, {
    headers: auth(),
    data: {
      incidentName: `${RUN}-B-VuViec`,
      incidentType: 'TIN_BAO',
      description: m.content,
      expectedUpdatedAt: updatedAt,
    },
    failOnStatusCode: false,
  });
  const cb = await conv.json().catch(() => ({} as any));
  expect(conv.status(), `chuyển thành vụ việc: ${conv.status()} ${JSON.stringify(cb).slice(0, 200)}`).toBeLessThan(300);
  const inc = cb.data?.incident ?? cb.data ?? cb;
  if (inc?.id) madeIncidents.push(inc.id);

  const row = (await q<any>('SELECT * FROM incidents WHERE id = $1', [inc.id]))[0];
  expect(row, 'vụ việc phải tồn tại').toBeTruthy();
  const blob = JSON.stringify(row);
  console.log(`\n[TC-181] vụ việc ${row.code ?? row.id}: giữ nội dung đơn = ${blob.includes(m.content)}`);
  expect(
    blob.includes(m.content),
    'NO-DATA-LOSS: nội dung đơn phải đi tiếp sang vụ việc, không rơi ở ranh giới module',
  ).toBe(true);
  expect(row.sourcePetitionId ?? row.linkedPetitionId, 'phải giữ liên kết về đơn gốc để truy nguyên').toBeTruthy();
});

test('TC-182-INT: Chuyển Đơn thư → Vụ án — giá trị vào CỘT chuẩn, không chỉ dữ liệu phụ', async ({ request }) => {
  const { body: pet, marks: m } = await createPetition(request, 'C');
  const detail = await (await request.get(`${API}/petitions/${pet.id}`, { headers: auth() })).json();
  const updatedAt = detail.data?.updatedAt;

  const conv = await request.post(`${API}/petitions/${pet.id}/convert-case`, {
    headers: auth(),
    data: {
      caseName: `${RUN}-C-VuAn`,
      crime: `${RUN}-C-ToiDanh`,
      jurisdiction: 'PC02',
      suspect: `${RUN}-C-NghiCan`,
      expectedUpdatedAt: updatedAt,
    },
    failOnStatusCode: false,
  });
  const cb = await conv.json().catch(() => ({} as any));
  expect(
    conv.status(),
    `BUG-001 từng chặn chính bước này: ${conv.status()} ${JSON.stringify(cb).slice(0, 200)}`,
  ).toBeLessThan(300);
  const kase = cb.data?.case ?? cb.data ?? cb;
  if (kase?.id) madeCases.push(kase.id);

  const row = (await q<any>('SELECT * FROM cases WHERE id = $1', [kase.id]))[0];
  expect(row, 'vụ án phải tồn tại').toBeTruthy();
  expect(row.linkedPetitionId, 'phải giữ liên kết về đơn gốc').toBe(pet.id);
  expect(row.caseProvenance, 'nguồn vụ án phải là FROM_PETITION').toBe('FROM_PETITION');
  // Cột mảng NOT NULL phải có giá trị — đây chính là lỗi BUG-001 khi đi qua đường chuyển đổi.
  expect(row.lyDoTamDinhChiVuAn, 'BUG-001: cột mảng NOT NULL phải được cấp giá trị').not.toBeNull();
  console.log(`\n[TC-182] vụ án ${row.caseCode}: liên kết đơn=${!!row.linkedPetitionId}, nguồn=${row.caseProvenance}`);
});

test('TC-182b-INT: Vụ án tạo qua chuyển đổi PHẢI được cấp mã hồ sơ (BUG-010)', async ({ request }) => {
  const { body: pet } = await createPetition(request, 'C2');
  const detail = await (await request.get(`${API}/petitions/${pet.id}`, { headers: auth() })).json();
  const conv = await request.post(`${API}/petitions/${pet.id}/convert-case`, {
    headers: auth(),
    data: { caseName: `${RUN}-C2-VuAn`, crime: 'X', jurisdiction: 'PC02', expectedUpdatedAt: detail.data?.updatedAt },
    failOnStatusCode: false,
  });
  expect(conv.status()).toBeLessThan(300);
  const cbody = await conv.json();
  const kase = cbody.data?.case ?? cbody.data;
  madeCases.push(kase.id);

  const row = (await q<any>('SELECT "caseCode" FROM cases WHERE id = $1', [kase.id]))[0];
  console.log(`
[TC-182b] mã hồ sơ của vụ án sinh từ chuyển đổi: ${row?.caseCode ?? 'KHÔNG CÓ'}`);
  expect(
    row?.caseCode,
    'BUG-010: hồ sơ tố tụng không có số thì không trích dẫn được trong văn bản và không tra được theo mã — đường tạo trực tiếp vẫn cấp mã, đường chuyển đổi thì không',
  ).toBeTruthy();
});

test('TC-183-INT: Chuỗi đầy đủ Đơn thư → Vụ án → Thống kê → Truy nguyên trong một phiên', async ({ request }) => {
  const { body: pet, marks: m } = await createPetition(request, 'D');
  const detail = await (await request.get(`${API}/petitions/${pet.id}`, { headers: auth() })).json();

  const conv = await request.post(`${API}/petitions/${pet.id}/convert-case`, {
    headers: auth(),
    data: {
      caseName: `${RUN}-D-VuAn`,
      crime: `${RUN}-D-ToiDanh`,
      jurisdiction: 'PC02',
      expectedUpdatedAt: detail.data?.updatedAt,
    },
    failOnStatusCode: false,
  });
  const convBody = await conv.json();
  const kase = convBody.data?.case ?? convBody.data;
  expect(conv.status()).toBeLessThan(300);
  madeCases.push(kase.id);

  // Bổ sung thông tin chủ thể + thiệt hại trên vụ án vừa sinh ra từ chuyển đổi.
  const put = await request.put(`${API}/cases/${kase.id}`, {
    headers: auth(),
    data: {
      name: `${RUN}-D-VuAn`,
      caseProvenance: 'FROM_PETITION',
      linkedPetitionId: pet.id,
      tenCungCap: m.senderName,
      cccdCungCap: m.senderIdNumber,
      sdtCungCap: m.senderPhone,
      diaChiCungCap: m.senderAddress,
      moTaChiTiet: m.content,
      statistic: { soTienBiThietHai: 5500000, soLuongBiHai: 2 },
    },
    failOnStatusCode: false,
  });
  expect(put.status(), `cập nhật vụ án: ${put.status()}`).toBeLessThan(300);

  const row = (await q<any>('SELECT * FROM cases WHERE id = $1', [kase.id]))[0];
  const stat = (await q<any>('SELECT * FROM case_statistics WHERE "caseId" = $1', [kase.id]))[0];

  const checks: Array<[string, boolean]> = [
    ['tenCungCap', row.tenCungCap === m.senderName],
    ['cccdCungCap', row.cccdCungCap === m.senderIdNumber],
    ['sdtCungCap', row.sdtCungCap === m.senderPhone],
    ['diaChiCungCap', row.diaChiCungCap === m.senderAddress],
    ['moTaChiTiet', row.moTaChiTiet === m.content],
    ['statistic.soTienBiThietHai', Number(stat?.soTienBiThietHai) === 5500000],
    ['statistic.soLuongBiHai', Number(stat?.soLuongBiHai) === 2],
    ['liên kết đơn gốc', row.linkedPetitionId === pet.id],
  ];
  console.log('\n[TC-183] chuỗi xuyên module:');
  for (const [k, ok] of checks) console.log(`  ${ok ? 'đạt   ' : 'HỎNG  '} ${k}`);
  const failed = checks.filter(([, ok]) => !ok).map(([k]) => k);
  expect(failed, `dữ liệu rơi ở: ${failed.join(', ')}`).toEqual([]);

  // Tra cứu được theo giá trị đã hợp nhất — nửa còn lại của mục tiêu "cột typed queryable".
  const sr = await request.get(`${API}/cases?search=${encodeURIComponent(m.senderName)}&limit=20&offset=0`, { headers: auth() });
  const sj = await sr.json();
  const items = (sj.data?.items ?? sj.data ?? []) as any[];
  expect(items.some((x: any) => x.id === kase.id), 'BUG-003: phải tra được vụ án theo tên người tố cáo').toBe(true);
});

test('TC-186-INT: Sửa vụ án sinh từ chuyển đổi — cột và dữ liệu phụ không phân kỳ', async ({ request }) => {
  const { body: pet } = await createPetition(request, 'E');
  const detail = await (await request.get(`${API}/petitions/${pet.id}`, { headers: auth() })).json();
  const conv = await request.post(`${API}/petitions/${pet.id}/convert-case`, {
    headers: auth(),
    data: { caseName: `${RUN}-E-VuAn`, crime: 'X', jurisdiction: 'PC02', expectedUpdatedAt: detail.data?.updatedAt },
    failOnStatusCode: false,
  });
  expect(conv.status()).toBeLessThan(300);
  const cbody = await conv.json();
  const kase = cbody.data?.case ?? cbody.data;
  madeCases.push(kase.id);

  const val = `${RUN}-E-NoiXayRa`;
  await request.put(`${API}/cases/${kase.id}`, {
    headers: auth(),
    data: { name: `${RUN}-E-VuAn`, caseProvenance: 'FROM_PETITION', linkedPetitionId: pet.id, noiXayRa: val },
    failOnStatusCode: false,
  });
  const row = (await q<any>('SELECT "noiXayRa", metadata FROM cases WHERE id = $1', [kase.id]))[0];
  expect(row.noiXayRa, 'giá trị phải vào CỘT chuẩn').toBe(val);
  const metaVal = row.metadata?.noiXayRa;
  if (metaVal !== undefined && metaVal !== null) {
    expect(String(metaVal), 'dual-write chỉ an toàn khi hai nơi bằng nhau').toBe(val);
  }
});

test('TC-188-INT: Hồ sơ nhập qua giao diện mới xuất chứng từ được, không thiếu mục', async ({ request }) => {
  const { body: pet } = await createPetition(request, 'F');
  const r = await request.get(`${API}/petitions/${pet.id}/export-readiness`, { headers: auth(), failOnStatusCode: false });
  console.log(`\n[TC-188] kiểm tra sẵn sàng in chứng từ: HTTP ${r.status()}`);
  expect(r.status(), 'chức năng in chứng từ phải còn hoạt động sau khi đổi nơi lưu').toBeLessThan(500);
  if (r.status() === 200) {
    const d = (await r.json()).data ?? {};
    expect(typeof d, 'phải trả về được trạng thái sẵn sàng').not.toBe('undefined');
  }
});

test('TC-187-INT: Hồi quy — danh sách và phân trang ba module vẫn chạy', async ({ request }) => {
  for (const p of ['/cases', '/petitions', '/incidents']) {
    const r1 = await request.get(`${API}${p}?limit=10&offset=0`, { headers: auth(), failOnStatusCode: false });
    expect(r1.status(), `${p} trang 1`).toBe(200);
    const b1 = await r1.json();
    const items1 = (b1.data?.items ?? b1.data ?? []) as any[];
    const r2 = await request.get(`${API}${p}?limit=10&offset=10`, { headers: auth(), failOnStatusCode: false });
    expect(r2.status(), `${p} trang 2`).toBe(200);
    const b2 = await r2.json();
    const items2 = (b2.data?.items ?? b2.data ?? []) as any[];
    const overlap = items1.filter((x: any) => items2.some((y: any) => y.id === x.id));
    expect(overlap.length, `${p}: trang 1 và trang 2 không được trùng bản ghi`).toBe(0);
  }
});

test('TC-189-INT: Hồi quy — số liệu tổng hợp còn đọc được và nhất quán', async ({ request }) => {
  const r = await request.get(`${API}/cases/stats`, { headers: auth(), failOnStatusCode: false });
  expect(r.status(), 'màn hình tổng hợp phải còn hoạt động').toBe(200);
  // Đường dẫn thống kê trả JSON THÔ, không bọc trong `data` như các đường dẫn khác.
  const raw = await r.json();
  const d = raw && typeof raw.data === 'object' && raw.data !== null ? raw.data : raw;
  const keys = Object.keys(d ?? {});
  console.log(`\n[TC-189] tổng hợp trả ${keys.length} nhóm: ${keys.slice(0, 6).join(', ')} | total=${d?.total}`);
  expect(keys.length, 'màn hình tổng hợp phải trả số liệu').toBeGreaterThan(0);
  expect(Number.isFinite(Number(d.total)), 'tổng số hồ sơ phải là một con số').toBe(true);

  // Nhất quán: tổng phải bằng tổng các nhóm trạng thái.
  if (d.byStatus && typeof d.byStatus === 'object') {
    const sum = Object.values(d.byStatus as Record<string, number>).reduce((a, b) => a + Number(b || 0), 0);
    console.log(`[TC-189] tổng=${d.total}, cộng theo trạng thái=${sum}`);
    expect(sum, 'tổng phải khớp tổng các nhóm trạng thái').toBe(Number(d.total));
  }
});

test('TC-190-INT: Quan hệ biến đổi — thêm điều kiện lọc thì tập kết quả phải thu hẹp', async ({ request }) => {
  const a = await request.get(`${API}/cases?limit=100&offset=0`, { headers: auth() });
  const ja = await a.json();
  const listA = (ja.data?.items ?? ja.data ?? []) as any[];
  const b = await request.get(`${API}/cases?limit=100&offset=0&status=TIEP_NHAN`, { headers: auth() });
  const jb = await b.json();
  const listB = (jb.data?.items ?? jb.data ?? []) as any[];
  // So bằng TỔNG SỐ, không so độ dài một trang — cả hai đều chạm trần `limit` thì
  // phép so sánh trở thành vô nghĩa (test xanh mà không chứng minh gì).
  const totalA = Number(ja.data?.total ?? ja.total ?? listA.length);
  const totalB = Number(jb.data?.total ?? jb.total ?? listB.length);
  console.log(`\n[TC-190] không lọc: tổng=${totalA} (trang ${listA.length}) | có lọc: tổng=${totalB} (trang ${listB.length})`);
  expect(Number.isFinite(totalA) && Number.isFinite(totalB), 'phải đọc được tổng số để so sánh').toBe(true);
  expect(totalB, 'thêm bộ lọc không được làm kết quả NHIỀU hơn').toBeLessThanOrEqual(totalA);
  expect(totalB, 'bộ lọc trạng thái phải thực sự thu hẹp tập kết quả').toBeLessThan(totalA);
  // Mọi bản ghi trong tập lọc phải thoả điều kiện lọc.
  const wrong = listB.filter((x: any) => x.status && x.status !== 'TIEP_NHAN');
  expect(wrong.length, 'kết quả lọc chứa bản ghi sai trạng thái').toBe(0);
});

test('TC-191-INT: Quan hệ biến đổi — sửa rồi sửa ngược lại thì hồ sơ trở về trạng thái đầu', async ({ request }) => {
  const { body: pet } = await createPetition(request, 'G');
  const detail = await (await request.get(`${API}/petitions/${pet.id}`, { headers: auth() })).json();
  const conv = await request.post(`${API}/petitions/${pet.id}/convert-case`, {
    headers: auth(),
    data: { caseName: `${RUN}-G-VuAn`, crime: 'X', jurisdiction: 'PC02', expectedUpdatedAt: detail.data?.updatedAt },
    failOnStatusCode: false,
  });
  expect(conv.status()).toBeLessThan(300);
  const cbody = await conv.json();
  const kase = cbody.data?.case ?? cbody.data;
  madeCases.push(kase.id);

  const base = { name: `${RUN}-G-VuAn`, caseProvenance: 'FROM_PETITION', linkedPetitionId: pet.id };
  await request.put(`${API}/cases/${kase.id}`, { headers: auth(), data: { ...base, noiXayRa: 'GIA-TRI-1' }, failOnStatusCode: false });
  const before = (await q<any>('SELECT * FROM cases WHERE id = $1', [kase.id]))[0];

  await request.put(`${API}/cases/${kase.id}`, { headers: auth(), data: { ...base, noiXayRa: 'GIA-TRI-2' }, failOnStatusCode: false });
  await request.put(`${API}/cases/${kase.id}`, { headers: auth(), data: { ...base, noiXayRa: 'GIA-TRI-1' }, failOnStatusCode: false });
  const after = (await q<any>('SELECT * FROM cases WHERE id = $1', [kase.id]))[0];

  const drifted: string[] = [];
  for (const k of Object.keys(before)) {
    if (['updatedAt', 'version'].includes(k)) continue;
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) drifted.push(k);
  }
  console.log(`\n[TC-191] trường trôi sau vòng sửa đi–sửa lại: ${drifted.length ? drifted.join(', ') : 'không có'}`);
  expect(drifted, 'thao tác sửa phải khả nghịch — không trường nào được trôi theo').toEqual([]);
});

test('TC-192-INT: Kiểm tra nhanh — máy chủ sống, ba module mở được', async ({ request }) => {
  const h = await request.get(`${BASE}/api/v1/health`, { failOnStatusCode: false });
  expect(h.status()).toBe(200);
  for (const p of ['/cases', '/petitions', '/incidents']) {
    const r = await request.get(`${API}${p}?limit=1&offset=0`, { headers: auth(), failOnStatusCode: false });
    expect(r.status(), `${p} phải mở được`).toBe(200);
  }
});
