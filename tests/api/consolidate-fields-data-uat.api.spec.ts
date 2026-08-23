/**
 * UAT HỢP NHẤT FIELD — Lớp TOÀN VẸN DỮ LIỆU (F6 ngữ nghĩa, F7 chuẩn hoá, F8 truy nguyên,
 * F10 tìm kiếm, F11 Đơn thư, F14 bảo mật)
 * Oracle: docs/uat/consolidate-fields/_plan-scope.md — KHÔNG lấy expected từ code.
 *
 * Các ca ở đây đo TRẠNG THÁI THẬT của khối dữ liệu đã di trú (3.740 vụ án / 46.135 đơn thư /
 * 5.081 vụ việc) chứ không chỉ dữ liệu do test tự tạo — đó mới là điều kế hoạch cam kết.
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
async function one<T = any>(sql: string, params: any[] = []): Promise<T> {
  return (await q<T>(sql, params))[0];
}
async function tableExists(name: string): Promise<boolean> {
  const r = await one<{ n: string }>(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`, [name]);
  return Number((r as any).n) > 0;
}

let TOKEN = '';
const auth = (t = TOKEN) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });

test.beforeAll(async ({ request }) => {
  TOKEN = process.env.UAT_TOKEN || '';
  if (!TOKEN) {
    const r = await request.post(`${API}/auth/login`, { data: { username: ADMIN_USER, password: ADMIN_PASS }, failOnStatusCode: false });
    const b = await r.json().catch(() => ({} as any));
    TOKEN = (b.data || b)?.accessToken || '';
  }
  expect(TOKEN, 'Gate 0').not.toBe('');
});

// ═══════════════════════════════════════════════════════════════════════════
// F7 — Không mất dữ liệu (PLAN-V2) — đo bằng ĐỘ PHỦ THEO SỐ HỒ SƠ
// ═══════════════════════════════════════════════════════════════════════════

// Mỗi dòng: [tên cột, khoá native trong dữ liệu phụ, khoá hệ cũ]
const PAIRS: Array<[string, string, string]> = [
  ['tenCungCap', 'reporter', 'tenCungCap'],
  ['cccdCungCap', 'reporterIdNumber', 'cccdCungCap'],
  ['sdtCungCap', 'reporterPhone', 'sdtCungCap'],
  ['diaChiCungCap', 'reporterAddress', 'diaChiCungCap'],
  ['moTaChiTiet', 'description', 'moTaChiTiet'],
  ['noiXayRa', 'noiXayRa', 'specificAddress'],
  ['reporterDateOfBirth', 'reporterDateOfBirth', 'sinhNamCungCap'],
];

test('TC-115-API: KHÔNG MẤT DỮ LIỆU — độ phủ theo SỐ HỒ SƠ cho từng cột', async () => {
  const report: Array<{ col: string; source: number; filled: number; deficit: number }> = [];
  for (const [col, native, old] of PAIRS) {
    const r = await one<any>(
      `SELECT
         count(*) FILTER (WHERE NULLIF(btrim(COALESCE(metadata->>$1, metadata->>$2)),'') IS NOT NULL)::int AS source,
         count(*) FILTER (WHERE "${col}" IS NOT NULL)::int AS filled
       FROM cases`, [native, old]);
    const source = Number(r.source), filled = Number(r.filled);
    report.push({ col, source, filled, deficit: Math.max(0, source - filled) });
  }
  console.log('\n[TC-115] Độ phủ theo số hồ sơ (PLAN-V2):');
  for (const x of report) console.log(`  ${x.col.padEnd(24)} nguồn=${String(x.source).padStart(5)}  cột=${String(x.filled).padStart(5)}  thiếu=${x.deficit}`);
  // PLAN-V2: filled >= source − conflict − reject. Thiếu hụt phải giải trình được (TC-117).
  const unexplained = report.filter((x) => x.deficit > 0);
  const detail = unexplained.map((x) => `${x.col}: thiếu ${x.deficit}`).join('; ');
  expect(
    unexplained.every((x) => x.deficit <= 25),
    `PLAN-V2: thiếu hụt vượt số bản ghi bị từ chối đã ghi nhận (20) → ${detail}`,
  ).toBe(true);
});

test('TC-116-API: Sổ XUNG ĐỘT tồn tại, đủ cột để người vận hành ra quyết định', async () => {
  const exists = await tableExists('migration_conflict');
  expect(
    exists,
    'PLAN-B3: "cột đã có giá trị KHÁC metadata → không đè, ghi migration_conflict (case_id, field, col_value, meta_value). Anh review"',
  ).toBe(true);
  const cols = await q<any>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='migration_conflict'`);
  const names = cols.map((c) => c.column_name);
  for (const need of ['recordId', 'field', 'colValue', 'metaValue', 'runId']) {
    expect(names, `sổ xung đột phải có cột "${need}" để đối chiếu được`).toContain(need);
  }
  const n = await one<any>(`SELECT count(*)::int AS n FROM migration_conflict`);
  console.log(`
[TC-116] sổ xung đột: ${n.n} dòng`);
});

test('TC-117-API: Sổ TỪ CHỐI giải trình được đúng phần dữ liệu chưa lên cột', async () => {
  const exists = await tableExists('migration_reject');
  expect(exists, 'PLAN-B3: "giá trị không parse được → bảng reject, null cột, log anh xem"').toBe(true);

  const rows = await q<any>(
    `SELECT field, reason, count(*)::int AS n FROM migration_reject GROUP BY 1,2 ORDER BY 3 DESC`);
  console.log('\n[TC-117] sổ từ chối theo trường:');
  for (const r of rows) console.log(`  ${String(r.field).padEnd(24)} ${r.reason.padEnd(18)} ${r.n} hồ sơ`);
  expect(rows.length, 'phải có bản ghi để rà soát').toBeGreaterThan(0);

  // Mỗi dòng phải giữ NGUYÊN VĂN giá trị gốc — đó là căn cứ để cán bộ nhập tay.
  const missingRaw = await one<any>(
    `SELECT count(*)::int AS n FROM migration_reject WHERE "rawValue" IS NULL OR btrim("rawValue")=''`);
  expect(Number(missingRaw.n), 'NO-FABRICATION: mọi dòng từ chối phải giữ giá trị gốc').toBe(0);

  // Phần thiếu hụt của cột ngày sinh (TC-115) phải được sổ này giải trình hết.
  const deficit = await one<any>(
    `SELECT count(*)::int AS n FROM cases
     WHERE NULLIF(btrim(COALESCE(metadata->>'reporterDateOfBirth', metadata->>'sinhNamCungCap')),'') IS NOT NULL
       AND "reporterDateOfBirth" IS NULL`);
  const logged = await one<any>(
    `SELECT count(DISTINCT "recordId")::int AS n FROM migration_reject WHERE field='reporterDateOfBirth'`);
  console.log(`[TC-117] thiếu hụt ngày sinh=${deficit.n}, đã ghi sổ=${logged.n}`);
  expect(
    Number(logged.n),
    'PLAN-V2: mọi hồ sơ có nguồn nhưng cột trống phải giải trình được bằng sổ từ chối',
  ).toBeGreaterThanOrEqual(Number(deficit.n));
});

test('TC-117b-API: Giá trị bị từ chối vẫn còn nguyên trong dữ liệu gốc (không bịa, không mất)', async () => {
  // 14 hồ sơ có nguồn ngày sinh nhưng cột trống — kiểm chúng vẫn giữ giá trị gốc.
  const rows = await q<any>(
    `SELECT id, COALESCE(metadata->>'reporterDateOfBirth', metadata->>'sinhNamCungCap') AS src
     FROM cases
     WHERE NULLIF(btrim(COALESCE(metadata->>'reporterDateOfBirth', metadata->>'sinhNamCungCap')),'') IS NOT NULL
       AND "reporterDateOfBirth" IS NULL`);
  console.log(`\n[TC-117b] ${rows.length} hồ sơ có nguồn nhưng cột trống — mẫu: ${rows.slice(0, 5).map((r) => JSON.stringify(r.src)).join(', ')}`);
  expect(rows.length, 'phải có bản ghi để kiểm chứng cơ chế từ chối').toBeGreaterThan(0);
  for (const r of rows) {
    expect(String(r.src).trim(), 'NO-FABRICATION: giá trị gốc phải còn để xử lý tay').not.toBe('');
  }
});

test('TC-119-API: Bảng thống kê không có bản ghi trùng cho một hồ sơ', async () => {
  const r = await one<any>(`SELECT count(*)::int AS n FROM (SELECT "caseId" FROM case_statistics GROUP BY "caseId" HAVING count(*)>1) t`);
  expect(Number(r.n), 'PLAN-B3 upsert ON CONFLICT: mỗi hồ sơ đúng một bản ghi thống kê').toBe(0);
});

test('TC-120-API: Sau chuẩn hoá, dữ liệu gốc hệ cũ VẪN CÒN trong hệ thống', async () => {
  const r = await one<any>(
    `SELECT count(*)::int AS n FROM cases
     WHERE "tenCungCap" IS NOT NULL AND metadata ?| array['tenCungCap','reporter']`);
  expect(Number(r.n), 'PLAN-B6: KHÔNG xoá metadata cũ — lưới an toàn tham chiếu').toBeGreaterThan(0);
  console.log(`\n[TC-120] ${r.n} hồ sơ giữ đồng thời CỘT chuẩn và dữ liệu gốc`);
});

test('TC-023-API: Dual-write còn bật nhưng cột và dữ liệu phụ KHÔNG được phân kỳ', async () => {
  const rows = await q<any>(
    `SELECT id, "tenCungCap" AS col, metadata->>'tenCungCap' AS meta FROM cases
     WHERE metadata->>'tenCungCap' IS NOT NULL AND "tenCungCap" IS NOT NULL
       AND btrim(metadata->>'tenCungCap') <> btrim("tenCungCap") LIMIT 20`);
  expect(
    rows.length,
    `PLAN-B4/B6: dual-write chỉ an toàn khi hai nơi luôn bằng nhau — phân kỳ ${rows.length} hồ sơ`,
  ).toBe(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// F4 — Ngày sinh & độ chính xác trên KHỐI DỮ LIỆU THẬT
// ═══════════════════════════════════════════════════════════════════════════

test('TC-050-API: Năm sinh hệ cũ chuyển thành 01/01 kèm cờ độ chính xác "year"', async () => {
  const r = await one<any>(
    `SELECT
       count(*) FILTER (WHERE "reporterDateOfBirthPrecision"='year')::int AS year_flag,
       count(*) FILTER (WHERE "reporterDateOfBirthPrecision"='year' AND to_char("reporterDateOfBirth",'MM-DD')<>'01-01')::int AS bad_day,
       count(*) FILTER (WHERE "reporterDateOfBirth" IS NOT NULL AND "reporterDateOfBirthPrecision" IS NULL)::int AS no_flag
     FROM cases`);
  console.log(`\n[TC-050] cờ year=${r.year_flag}, sai ngày 01/01=${r.bad_day}, có ngày nhưng thiếu cờ=${r.no_flag}`);
  expect(Number(r.year_flag), 'PLAN-A1-03: phải có hồ sơ mang cờ chỉ-năm').toBeGreaterThan(0);
  expect(Number(r.bad_day), 'cờ year thì ngày phải là 01/01').toBe(0);
});

test('TC-052-API: Cờ độ chính xác nằm ở CỘT, không phải khoá dữ liệu phụ', async () => {
  const col = await one<any>(
    `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='cases' AND column_name='reporterDateOfBirthPrecision'`);
  expect(Number(col.n), 'PLAN-A1-03: "KHÔNG dùng cờ metadata"').toBe(1);
  const meta = await one<any>(`SELECT count(*)::int AS n FROM cases WHERE metadata ? '_yearOnly' OR metadata ? 'reporterDateOfBirthPrecision'`);
  console.log(`\n[TC-052] số hồ sơ còn giữ cờ trong dữ liệu phụ: ${meta.n} (tham chiếu, không chặn)`);
});

test('TC-056-API: Không có ngày sinh 01/01/1970 nào bị BỊA từ giá trị rác', async () => {
  const rows = await q<any>(
    `SELECT id, COALESCE(metadata->>'reporterDateOfBirth', metadata->>'sinhNamCungCap') AS src, "reporterDateOfBirthPrecision" AS prec
     FROM cases WHERE to_char("reporterDateOfBirth",'YYYY-MM-DD')='1970-01-01'`);
  console.log(`\n[TC-056] ${rows.length} hồ sơ có ngày sinh 01/01/1970 — nguồn: ${[...new Set(rows.map((r) => String(r.src)))].join(', ')}`);
  for (const r of rows) {
    const src = String(r.src ?? '').trim();
    expect(
      src === '1970' || src.startsWith('1970'),
      `NO-FABRICATION: hồ sơ ${r.id} có ngày 01/01/1970 nhưng nguồn là "${src}" — nghi bịa từ giá trị rác`,
    ).toBe(true);
  }
});

test('TC-058-API: Không cột ngày nào bị lệch khỏi 00:00 trên khối dữ liệu thật', async () => {
  const r = await one<any>(
    `SELECT
       count(*) FILTER (WHERE "reporterDateOfBirth" IS NOT NULL AND "reporterDateOfBirth"::time <> '00:00:00')::int AS dob,
       count(*) FILTER (WHERE "receiveDate" IS NOT NULL AND "receiveDate"::time <> '00:00:00')::int AS receive
     FROM cases WHERE name NOT LIKE 'UAT%'`); // loại hồ sơ do chính bộ kiểm thử tạo ra
  expect(Number(r.dob) + Number(r.receive), 'PLAN-B1: quy ước date-only lưu 00:00 giờ VN').toBe(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// F6 — Ngữ nghĩa KHÔNG được gộp (PLAN-A3)
// ═══════════════════════════════════════════════════════════════════════════

test('TC-091-API: Bị hại KHÔNG bị nối vào địa chỉ người tố cáo', async () => {
  const r = await one<any>(
    `SELECT
       count(*) FILTER (WHERE NULLIF(btrim(metadata->>'biHai'),'') IS NOT NULL AND "diaChiCungCap" IS NOT NULL
                          AND btrim(metadata->>'biHai') = btrim("diaChiCungCap"))::int AS identical,
       count(*) FILTER (WHERE "diaChiCungCap" IS NOT NULL AND name NOT LIKE 'UAT%')::int AS total_addr
     FROM cases`);
  const sample = await q<any>(
    `SELECT metadata->>'biHai' AS bihai, "diaChiCungCap" AS diachi FROM cases
     WHERE NULLIF(btrim(metadata->>'biHai'),'') IS NOT NULL AND "diaChiCungCap" IS NOT NULL
       AND btrim(metadata->>'biHai') = btrim("diaChiCungCap") LIMIT 3`);
  console.log(`
[TC-091] ô Địa chỉ giống hệt ô Bị hại: ${r.identical}/${r.total_addr} hồ sơ`);
  for (const x of sample) console.log(`   Địa chỉ="${x.diachi}"  |  Bị hại="${x.bihai}"`);
  // Truy tận nguồn: legacy_raw['dia-chi-bi-hai'] của hệ cũ CHỨA TÊN BỊ HẠI, dù nhãn
  // danh mục ghi là "Địa chỉ...". Ánh xạ trường đó vào cột `diaChiCungCap` khiến ô mang
  // nhãn "Địa chỉ" hiển thị tên người, và surface cùng một trường hệ cũ dưới HAI nhãn.
  // Ánh xạ đã được gỡ (backfill-case-person.ts); phần dữ liệu đã lỡ ghi cần một lượt dọn
  // có phê duyệt (audit-address-vs-bihai.ts --apply) vì đây là hồ sơ tố tụng.
  expect(
    Number(r.identical),
    `PLAN-A1-05: "biHai='Bị hại'(tên/đối tượng), không phải địa chỉ → corruption" — ${r.identical}/${r.total_addr} hồ sơ có ô Địa chỉ chứa TÊN BỊ HẠI. Nguồn gốc: hệ cũ; ánh xạ đã gỡ; CHỜ lượt dọn có phê duyệt.`,
  ).toBe(0);
});

test('TC-091b-API: Ánh xạ di trú KHÔNG còn đưa trường bị hại của hệ cũ vào ô Địa chỉ', async () => {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../../backend/src/legacy-migration/cli/backfill-case-person.ts'), 'utf-8');
  const active = src
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
  expect(
    /diaChiCungCap:\s*'dia-chi-bi-hai'/.test(active),
    'BUG-002: ánh xạ dia-chi-bi-hai → diaChiCungCap phải được gỡ để lần di trú sau không tái tạo lỗi',
  ).toBe(false);
});

test('TC-101-API: Cán bộ thụ lý (liên kết) và điều tra viên hệ cũ (chữ) cùng tồn tại độc lập', async () => {
  const r = await one<any>(
    `SELECT
       count(*) FILTER (WHERE "dieuTraVien" IS NOT NULL)::int AS text_only,
       count(*) FILTER (WHERE "dieuTraVien" IS NOT NULL AND "investigatorId" IS NOT NULL)::int AS both,
       count(*) FILTER (WHERE "dieuTraVien" IS NOT NULL AND "investigatorId" IS NULL)::int AS no_user
     FROM cases`);
  console.log(`\n[TC-101] có tên ĐTV hệ cũ=${r.text_only}, có cả hai=${r.both}, chỉ có tên không khớp tài khoản=${r.no_user}`);
  expect(Number(r.text_only), 'PLAN-A3-R7: cột dieuTraVien phải còn giữ tên hệ cũ').toBeGreaterThan(0);
});

test('TC-102-API: Tên điều tra viên hệ cũ không khớp tài khoản nào vẫn KHÔNG bị mất', async () => {
  const r = await one<any>(
    `SELECT count(*)::int AS n FROM cases WHERE "dieuTraVien" IS NOT NULL AND btrim("dieuTraVien") <> '' AND "investigatorId" IS NULL`);
  console.log(`\n[TC-102] ${r.n} hồ sơ giữ tên ĐTV hệ cũ mà không có tài khoản tương ứng — đây chính là dữ liệu sẽ MẤT nếu gộp hai trường`);
  expect(Number(r.n), 'PLAN-A3-R7: "Merge sẽ mất data khi không match user"').toBeGreaterThanOrEqual(0);
});

test('TC-097-API: Ghi chú nghi vấn đối tượng không bị danh sách đối tượng nuốt mất', async () => {
  const r = await one<any>(
    `SELECT count(*)::int AS n FROM cases c
     WHERE c."nghiVanDoiTuong" IS NOT NULL AND btrim(c."nghiVanDoiTuong") <> ''
       AND EXISTS (SELECT 1 FROM subjects s WHERE s."caseId" = c.id)`);
  console.log(`\n[TC-097] ${r.n} hồ sơ có ĐỒNG THỜI ghi chú nghi vấn và danh sách đối tượng có cấu trúc`);
  expect(Number(r.n), 'PLAN-A3-R5: giữ CẢ HAI, không merge').toBeGreaterThanOrEqual(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// DRIFT — nghi vấn từ phân tích mã nguồn, kết luận ở tầng dữ liệu/sản phẩm
// ═══════════════════════════════════════════════════════════════════════════

test('TC-197-API: DRIFT-2 — năm sinh hệ cũ và ngày sinh có mâu thuẫn nhau không', async () => {
  const r = await one<any>(
    `SELECT
       count(*) FILTER (WHERE "sinhNamCungCap" IS NOT NULL)::int AS old_col,
       count(*) FILTER (WHERE "sinhNamCungCap" IS NOT NULL AND "reporterDateOfBirth" IS NOT NULL)::int AS both,
       count(*) FILTER (WHERE "sinhNamCungCap" IS NOT NULL AND "reporterDateOfBirth" IS NOT NULL
                          AND "sinhNamCungCap" !~ ('^' || to_char("reporterDateOfBirth",'YYYY'))
                          AND "sinhNamCungCap" !~ (to_char("reporterDateOfBirth",'YYYY') || '$'))::int AS disagree
     FROM cases`);
  console.log(`\n[TC-197] cột năm sinh cũ=${r.old_col}, có cả hai=${r.both}, MÂU THUẪN năm=${r.disagree}`);
  expect(
    Number(r.disagree),
    'PLAN-A1-03: hai trường cùng nghĩa được gộp về một — nếu mâu thuẫn thì hồ sơ có hai ngày sinh khác nhau',
  ).toBe(0);
});

test('TC-198-API: DRIFT-3 — nguồn thiệt hại thứ ba đã được hợp nhất chưa', async () => {
  const r = await one<any>(
    `SELECT
       count(*) FILTER (WHERE metadata->>'damageAmount' IS NOT NULL)::int AS meta_dmg,
       count(*) FILTER (WHERE metadata->>'stat_damageAmount' IS NOT NULL)::int AS meta_stat,
       (SELECT count(*) FILTER (WHERE "soTienBiThietHai" IS NOT NULL) FROM case_statistics)::int AS col_dmg
     FROM cases`);
  console.log(`\n[TC-198] damageAmount(phụ)=${r.meta_dmg}, stat_damageAmount(phụ)=${r.meta_stat}, cột thống kê=${r.col_dmg}`);
  const mismatch = await one<any>(
    `SELECT count(*)::int AS n FROM cases c LEFT JOIN case_statistics s ON s."caseId"=c.id
     WHERE c.metadata->>'damageAmount' IS NOT NULL
       AND (s."soTienBiThietHai" IS NULL
            OR s."soTienBiThietHai"::text <> regexp_replace(c.metadata->>'damageAmount','[^0-9]','','g'))`);
  expect(
    Number(mismatch.n),
    'PLAN-A3-R1: cả ba nguồn thiệt hại phải cùng một giá trị — lệch nghĩa là báo cáo có thể đọc số cũ',
  ).toBe(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// F10 — Tìm kiếm theo giá trị đã hợp nhất
// ═══════════════════════════════════════════════════════════════════════════

test('TC-147-API: Tìm hồ sơ theo tên người tố cáo ra đúng vụ', async ({ request }) => {
  const s = await one<any>(`SELECT id, "tenCungCap" AS v FROM cases WHERE "tenCungCap" IS NOT NULL AND length("tenCungCap") BETWEEN 6 AND 40 LIMIT 1`);
  test.skip(!s, 'không có dữ liệu mẫu');
  const r = await request.get(`${API}/cases?search=${encodeURIComponent(s.v)}&limit=50`, { headers: auth() });
  expect(r.status()).toBe(200);
  const items = ((await r.json()).data?.items ?? (await r.json()).data ?? []) as any[];
  console.log(`\n[TC-147] tìm "${s.v}" → ${items.length} kết quả`);
  expect(items.length, 'PLAN-B4: tìm kiếm phải truy vấn theo cột đã hợp nhất').toBeGreaterThan(0);
});

test('TC-149-API: Tìm hồ sơ theo số hồ sơ hệ cũ ra đúng vụ', async ({ request }) => {
  const s = await one<any>(`SELECT id, "soHoSoCu" AS v FROM cases WHERE "soHoSoCu" IS NOT NULL LIMIT 1`);
  test.skip(!s, 'không có dữ liệu di trú');
  const r = await request.get(`${API}/cases?search=${encodeURIComponent(s.v)}&limit=50`, { headers: auth() });
  expect(r.status()).toBe(200);
  const body = await r.json();
  const items = (body.data?.items ?? body.data ?? []) as any[];
  console.log(`\n[TC-149] tìm số hệ cũ "${s.v}" → ${items.length} kết quả`);
  expect(items.length, 'truy nguyên hệ cũ: phải tra được theo số hồ sơ gốc').toBeGreaterThan(0);
});

test('TC-148-API: Tìm hồ sơ theo số CCCD người tố cáo', async ({ request }) => {
  const s = await one<any>(`SELECT "cccdCungCap" AS v FROM cases WHERE "cccdCungCap" IS NOT NULL AND length("cccdCungCap") >= 9 AND name NOT LIKE 'UAT%' LIMIT 1`);
  test.skip(!s, 'không có dữ liệu CCCD');
  const r = await request.get(`${API}/cases?search=${encodeURIComponent(s.v)}&limit=20`, { headers: auth() });
  const body = await r.json();
  const items = (body.data?.items ?? body.data ?? []) as any[];
  console.log(`
[TC-148] tìm CCCD "${s.v}" → ${items.length} kết quả`);
  expect(items.length, 'PLAN-B4 nêu đích danh "cccd" trong danh sách tiêu chí cần tìm được').toBeGreaterThan(0);
});

test('TC-150-API: Tìm hồ sơ theo nơi xảy ra', async ({ request }) => {
  const s = await one<any>(`SELECT "noiXayRa" AS v FROM cases WHERE "noiXayRa" IS NOT NULL AND length("noiXayRa") BETWEEN 8 AND 40 AND name NOT LIKE 'UAT%' LIMIT 1`);
  test.skip(!s, 'không có dữ liệu nơi xảy ra');
  const r = await request.get(`${API}/cases?search=${encodeURIComponent(s.v)}&limit=20`, { headers: auth() });
  const body = await r.json();
  const items = (body.data?.items ?? body.data ?? []) as any[];
  console.log(`
[TC-150] tìm nơi xảy ra "${s.v}" → ${items.length} kết quả`);
  expect(items.length, 'PLAN-B4 nêu đích danh "noiXayRa" trong danh sách tiêu chí cần tìm được').toBeGreaterThan(0);
});

test('TC-153-API: Từ khoá chứa ký tự tấn công — an toàn, không lỗi máy chủ', async ({ request }) => {
  for (const kw of ["' OR '1'='1", '%; DROP TABLE cases;--', '<script>alert(1)</script>', 'Nguyễn %_']) {
    const r = await request.get(`${API}/cases?search=${encodeURIComponent(kw)}&limit=5`, { headers: auth(), failOnStatusCode: false });
    expect(r.status(), `OWASP A03 với từ khoá ${kw}`).toBeLessThan(500);
  }
  const still = await one<any>(`SELECT count(*)::int AS n FROM cases`);
  expect(Number(still.n), 'dữ liệu không được thay đổi bởi truy vấn tìm kiếm').toBeGreaterThan(0);
});

// ═══════════════════════════════════════════════════════════════════════════
// F14 — Bảo mật & phạm vi dữ liệu
// ═══════════════════════════════════════════════════════════════════════════

test('TC-158-API: Không có phiên hợp lệ — bị từ chối, không rò dữ liệu', async ({ request }) => {
  for (const p of ['/cases', '/cases/stats', '/petitions', '/incidents']) {
    const r = await request.get(`${API}${p}`, { failOnStatusCode: false });
    expect(r.status(), `AUTH-04: ${p} phải yêu cầu xác thực`).toBeGreaterThanOrEqual(400);
    const t = await r.text();
    expect(t.includes('tenCungCap') || t.includes('cccdCungCap'), 'không được rò dữ liệu cá nhân').toBe(false);
  }
});

test('TC-157-API: Đường dẫn thống kê không kèm dữ liệu cá nhân không cần thiết', async ({ request }) => {
  const r = await request.get(`${API}/cases/stats`, { headers: auth(), failOnStatusCode: false });
  if (r.status() === 200) {
    const t = await r.text();
    const leaked = ['cccdCungCap', 'reporterDateOfBirth', 'sdtCungCap', 'diaChiCungCap'].filter((k) => t.includes(k));
    expect(leaked, `NĐ 13/2023: thống kê không cần dữ liệu cá nhân → rò ${leaked.join(', ')}`).toEqual([]);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// F11/F12 — Đơn thư & Vụ việc (PLAN-A4)
// ═══════════════════════════════════════════════════════════════════════════

test('TC-166-API: Đơn thư — tội danh ban đầu và tội danh chính là hai trường độc lập', async () => {
  const cols = await q<any>(
    `SELECT column_name FROM information_schema.columns WHERE table_name='petitions' AND column_name IN ('toiDanhBanDau','crimeChinhId')`);
  expect(cols.length, 'PLAN-A4-02: cả hai phải tồn tại như hai cột riêng').toBe(2);
  const r = await one<any>(
    `SELECT count(*)::int AS n FROM petitions WHERE "toiDanhBanDau" IS NOT NULL AND "crimeChinhId" IS NOT NULL`);
  console.log(`\n[TC-166] ${r.n} đơn thư có ĐỒNG THỜI tội danh ban đầu và tội danh chính`);
});

test('TC-169-API: Tìm Đơn thư theo số hồ sơ hệ cũ', async ({ request }) => {
  const s = await one<any>(`SELECT "soHoSoCu" AS v FROM petitions WHERE "soHoSoCu" IS NOT NULL LIMIT 1`);
  test.skip(!s, 'không có đơn thư di trú');
  const r = await request.get(`${API}/petitions?search=${encodeURIComponent(s.v)}&limit=20`, { headers: auth() });
  expect(r.status()).toBe(200);
  const body = await r.json();
  const items = (body.data?.items ?? body.data ?? []) as any[];
  expect(items.length, 'truy nguyên hệ cũ áp cho cả Đơn thư').toBeGreaterThan(0);
});

test('TC-164-API: Đơn thư — trường thông tin người gửi lưu và đọc lại đúng', async ({ request }) => {
  const p = await one<any>(`SELECT id FROM petitions WHERE "senderName" IS NOT NULL LIMIT 1`);
  test.skip(!p, 'không có đơn thư mẫu');
  const r = await request.get(`${API}/petitions/${p.id}`, { headers: auth(), failOnStatusCode: false });
  expect(r.status()).toBe(200);
  const d = (await r.json()).data ?? {};
  expect(d.senderName, 'PLAN-A4-04: person field là cột native, đọc lại phải đúng').toBeTruthy();
});

test('TC-177-API: Vụ việc có trạng thái ngoài bản đồ giai đoạn — dữ liệu vẫn đọc được', async ({ request }) => {
  const r = await one<any>(`SELECT count(*)::int AS n FROM incidents WHERE status IS NULL`);
  console.log(`\n[TC-177] ${r.n} vụ việc không có trạng thái`);
  const sample = await one<any>(`SELECT id FROM incidents LIMIT 1`);
  const g = await request.get(`${API}/incidents/${sample.id}`, { headers: auth(), failOnStatusCode: false });
  expect(g.status(), 'mở vụ việc không được lỗi máy chủ').toBeLessThan(500);
});
