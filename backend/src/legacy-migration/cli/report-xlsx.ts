/**
 * Xuất báo cáo Excel về những hồ sơ CẦN NGƯỜI XEM LẠI sau khi di trú.
 *
 * Chạy:
 *   set -a && source .env && set +a
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/report-xlsx.ts
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/report-xlsx.ts --out "C:/PC02/bao-cao.xlsx"
 *
 * Bốn trang:
 *   1. Tổng quan            — số liệu chốt của cả đợt di trú
 *   2. Hồ sơ tự phán đoán   — không có trường phân loại, hệ thống tự suy + căn cứ + độ tin cậy
 *   3. Hồ sơ chưa nạp được  — kèm lý do và toàn bộ nội dung để xử lý tay
 *   4. Đơn vị chưa phân loại— giá trị đơn vị chờ duyệt, kèm số hồ sơ ảnh hưởng
 */
import * as path from 'path';
import * as ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { inferClass, needsInference } from './infer-class';

const CLASS_LABEL: Record<string, string> = {
  'vu-an-ban-dau': 'Vụ án',
  'vu-viec-ban-dau': 'Vụ việc (nguồn tin)',
  'don-cong-van-ban-dau': 'Đơn thư / công văn',
  'huong-dan-ban-dau': 'Hướng dẫn nghiệp vụ',
};

/** Ngày nghiệp vụ hệ cũ: epoch giây lệch −14h (xem parseLegacyDate). */
function legacyDate(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 946684800) return '';
  const d = new Date((n + 50400) * 1000);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function styleHeader(sheet: ExcelJS.Worksheet): void {
  const row = sheet.getRow(1);
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.height = 28;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

async function main(): Promise<void> {
  const outArg = process.argv.indexOf('--out');
  const outPath = outArg >= 0 ? process.argv[outArg + 1] : path.join(process.cwd(), 'bao-cao-di-tru.xlsx');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'PC02 — công cụ di trú dữ liệu';
    wb.created = new Date();

    // ── Trang 2: hồ sơ tự phán đoán ─────────────────────────────────────────
    const staged = await prisma.legacyStaging.findMany({
      where: { sourceFile: { in: ['ho_so_doi_1', 'ho_so'] } },
      select: { sourceFile: true, sourceId: true, raw: true },
    });
    const inferred = staged
      .map((s) => ({ s, raw: s.raw as Record<string, unknown> }))
      .filter(({ raw }) => needsInference(raw));

    const sh2 = wb.addWorksheet('Hồ sơ tự phán đoán');
    sh2.columns = [
      { header: 'Khoá gốc', key: 'key', width: 22 },
      { header: 'Năm', key: 'nam', width: 7 },
      { header: 'Ngày tiếp nhận', key: 'ngay', width: 14 },
      { header: 'Loại HỆ THỐNG TỰ SUY', key: 'loai', width: 20 },
      { header: 'Độ tin cậy', key: 'tincay', width: 11 },
      { header: 'Căn cứ suy đoán', key: 'cancu', width: 42 },
      { header: 'Người nhập (mã cũ)', key: 'nguoi', width: 16 },
      { header: 'Đơn vị giải quyết', key: 'donvi', width: 24 },
      { header: 'Người/cơ quan cung cấp', key: 'nguon', width: 24 },
      { header: 'Tóm tắt nội dung', key: 'tomtat', width: 90 },
    ];
    styleHeader(sh2);
    for (const { s, raw } of inferred) {
      const inf = inferClass(raw);
      const row = sh2.addRow({
        key: `${s.sourceFile}:${s.sourceId}`,
        nam: String(raw.nam ?? ''),
        ngay: legacyDate(raw.ngay_de_xuat),
        loai: CLASS_LABEL[inf.phanLoai] ?? inf.phanLoai,
        tincay: inf.confidence,
        cancu: inf.reason,
        nguoi: String(raw.nguoi_them ?? ''),
        donvi: String(raw.don_vi_giai_quyet ?? ''),
        nguon: String(raw.ten_ca_nhan_co_quan_to_chuc_cung_cap ?? ''),
        tomtat: String(raw.tom_tat_noi_dung ?? '').replace(/\r?\n/g, ' '),
      });
      row.alignment = { vertical: 'top', wrapText: true };
      // Tô đỏ dòng độ tin cậy THẤP — đây là dòng bắt buộc phải kiểm tay.
      if (inf.confidence === 'thấp') {
        row.getCell('tincay').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
        row.getCell('tincay').font = { bold: true, color: { argb: 'FF9C0006' } };
      }
    }

    // ── Trang 3: hồ sơ chưa nạp được ────────────────────────────────────────
    const errs = await prisma.legacyImportError.findMany({ orderBy: { createdAt: 'desc' } });
    const errIds = [...new Set(errs.map((e) => e.sourceId))];
    const present = new Set<string>([
      ...(await prisma.case.findMany({ where: { legacySourceId: { in: errIds } }, select: { legacySourceId: true } })).map((x) => x.legacySourceId!),
      ...(await prisma.incident.findMany({ where: { legacySourceId: { in: errIds } }, select: { legacySourceId: true } })).map((x) => x.legacySourceId!),
      ...(await prisma.petition.findMany({ where: { legacySourceId: { in: errIds } }, select: { legacySourceId: true } })).map((x) => x.legacySourceId!),
    ]);
    const stagedByKey = new Map(staged.map((s) => [`${s.sourceFile}:${s.sourceId}`, s.raw as Record<string, unknown>]));

    const sh3 = wb.addWorksheet('Hồ sơ chưa nạp được');
    sh3.columns = [
      { header: 'Khoá gốc', key: 'key', width: 22 },
      { header: 'Năm', key: 'nam', width: 7 },
      { header: 'Ngày tiếp nhận', key: 'ngay', width: 14 },
      { header: 'Đã vào hệ thống?', key: 'daco', width: 16 },
      { header: 'Lý do bị chặn', key: 'lydo', width: 46 },
      { header: 'Đơn vị giải quyết', key: 'donvi', width: 24 },
      { header: 'Tóm tắt nội dung', key: 'tomtat', width: 90 },
    ];
    styleHeader(sh3);
    for (const e of errs) {
      const raw = stagedByKey.get(e.sourceId);
      const daco = present.has(e.sourceId);
      const row = sh3.addRow({
        key: e.sourceId,
        nam: String(raw?.nam ?? ''),
        ngay: legacyDate(raw?.ngay_de_xuat),
        daco: daco ? 'Đã vào (lỗi ở lần chạy trước)' : 'CHƯA VÀO',
        lydo: e.reason.replace(/\s+/g, ' ').slice(0, 200),
        donvi: String(raw?.don_vi_giai_quyet ?? ''),
        tomtat: String(raw?.tom_tat_noi_dung ?? '').replace(/\r?\n/g, ' '),
      });
      row.alignment = { vertical: 'top', wrapText: true };
      if (!daco) {
        row.getCell('daco').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
        row.getCell('daco').font = { bold: true, color: { argb: 'FF9C0006' } };
      }
    }

    // ── Trang 4: đơn vị chưa phân loại ──────────────────────────────────────
    const unknowns = await prisma.legacyUnitAlias.findMany({
      where: { kind: 'UNKNOWN' },
      orderBy: { recordCount: 'desc' },
      select: { sampleRaw: true, rawValue: true, recordCount: true, note: true },
    });
    const sh4 = wb.addWorksheet('Đơn vị chưa phân loại');
    sh4.columns = [
      { header: 'Giá trị gốc', key: 'sample', width: 55 },
      { header: 'Số hồ sơ', key: 'n', width: 10 },
      { header: 'Vì sao chưa phân loại', key: 'note', width: 55 },
      { header: 'Người duyệt điền: TỔ / CƠ QUAN NGOÀI / KẾT QUẢ', key: 'quyet', width: 40 },
    ];
    styleHeader(sh4);
    for (const u of unknowns) {
      sh4.addRow({ sample: u.sampleRaw ?? u.rawValue, n: u.recordCount, note: u.note ?? '', quyet: '' }).alignment = {
        vertical: 'top',
        wrapText: true,
      };
    }

    // ── Trang 1: tổng quan (đặt lên đầu) ────────────────────────────────────
    const L = { legacySourceId: { not: null } };
    const [pt, inc, cs, gd, ex, pr, lw, teams, users] = await Promise.all([
      prisma.petition.count({ where: L }), prisma.incident.count({ where: L }), prisma.case.count({ where: L }),
      prisma.guidanceRecord.count({ where: L }), prisma.exchange.count({ where: L }), prisma.proposal.count({ where: L }),
      prisma.lawyer.count({ where: L }), prisma.team.count(), prisma.user.count(),
    ]);
    const fabricated = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM petitions WHERE "legacySourceId" IS NOT NULL AND "receivedDate"::date = CURRENT_DATE`;
    const notLoaded = errIds.filter((i) => !present.has(i)).length;

    const sh1 = wb.addWorksheet('Tổng quan', { properties: { tabColor: { argb: 'FF1F4E79' } } });
    sh1.columns = [
      { header: 'Chỉ tiêu', key: 'k', width: 46 },
      { header: 'Số liệu', key: 'v', width: 18 },
      { header: 'Ghi chú', key: 'n', width: 60 },
    ];
    styleHeader(sh1);
    const rows: [string, string | number, string][] = [
      ['Hồ sơ trong bảng chờ (nguồn)', staged.length, 'đọc nguyên văn từ dump MongoDB'],
      ['Đơn thư đã tạo', pt, ''],
      ['Vụ việc đã tạo', inc, ''],
      ['Vụ án đã tạo', cs, ''],
      ['Hướng dẫn nghiệp vụ', gd, ''],
      ['Trao đổi / Kiến nghị / Luật sư', `${ex} / ${pr} / ${lw}`, ''],
      ['Tổ/Nhóm trong hệ thống', teams, 'gồm cả tổ có sẵn trước khi di trú'],
      ['Người dùng trong hệ thống', users, 'gồm cả tài khoản có sẵn'],
      ['Hồ sơ mang ngày chạy di trú', Number(fabricated[0]?.n ?? 0), 'PHẢI bằng 0 — dấu vết của lỗi bịa ngày'],
      ['Hồ sơ hệ thống tự phán đoán loại', inferred.length, 'xem trang "Hồ sơ tự phán đoán"'],
      ['Hồ sơ CHƯA nạp được', notLoaded, 'xem trang "Hồ sơ chưa nạp được"'],
      ['Giá trị đơn vị chờ duyệt', unknowns.length, 'xem trang "Đơn vị chưa phân loại"'],
    ];
    for (const [k, v, n] of rows) sh1.addRow({ k, v, n });

    await wb.xlsx.writeFile(outPath);
    console.log(`\nĐã xuất báo cáo: ${outPath}`);
    console.log(`  · tự phán đoán loại : ${inferred.length} hồ sơ`);
    console.log(`  · chưa nạp được     : ${notLoaded} hồ sơ`);
    console.log(`  · đơn vị chờ duyệt  : ${unknowns.length} giá trị\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
