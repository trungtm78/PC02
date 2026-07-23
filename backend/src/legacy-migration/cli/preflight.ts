/**
 * Kiểm TRƯỚC khi nạp. Không ghi một dòng nào vào bảng vận hành.
 *
 * Chạy:
 *   set -a && source .env && set +a
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/preflight.ts
 *   ./node_modules/.bin/ts-node src/legacy-migration/cli/preflight.ts --year 2026
 *
 * Thoát mã 1 nếu có lỗi CHẶN — để chạy trong kịch bản tự động vẫn dừng đúng lúc.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { LEGACY_KEY_VERSION } from './stage';
import { normalizePhanLoai } from '../legacy-mapper';
import {
  checkEpochField, checkCrimeAmbiguity, checkCrimeCoverage, checkUnknownUnits,
  checkUnclassifiedRecords, checkKeyVersion, checkTeamUniqueness, summarize,
  type CheckResult,
} from './preflight-checks';

/** Các trường ngày kiểu epoch cần kiểm riêng — quy tắc +50400s mới chỉ CHỨNG MINH cho ngay_de_xuat. */
const EPOCH_FIELDS = [
  'ngay_de_xuat',
  'ngay_xay_ra',
  'ngay_thong_ke',
  'ngay_tiep_nhan_tin',
  'ngay_thang_nam_het_thoi_hieu_vu_viec',
  'thoi_han_thuc_hien_uy_thac_dieu_tra',
];

async function main(): Promise<void> {
  const yearArg = process.argv.includes('--year') ? process.argv[process.argv.indexOf('--year') + 1] : undefined;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });
  const results: CheckResult[] = [];

  try {
    const scope = yearArg ? `năm ${yearArg}` : 'toàn bộ';
    console.log(`\n═══ KIỂM TRƯỚC KHI NẠP — phạm vi: ${scope} ═══\n`);

    // 1. Phiên bản quy tắc khoá của lần nạp bảng chờ gần nhất.
    const lastRun = await prisma.legacyImportRun.findFirst({ orderBy: { startedAt: 'desc' } });
    results.push(checkKeyVersion(lastRun?.legacyKeyVersion ?? null, LEGACY_KEY_VERSION));

    // 2. Tội danh: mỗi mã cũ phải ứng đúng 1 tội danh mới.
    const crimeDup = await prisma.$queryRaw<{ legacyValue: number; crimes: bigint }[]>`
      SELECT "legacyValue", count(*)::bigint AS crimes FROM crimes
      WHERE "legacyValue" IS NOT NULL GROUP BY 1 HAVING count(*) > 1`;
    results.push(checkCrimeAmbiguity(crimeDup.map((c) => ({ legacyValue: c.legacyValue, crimes: Number(c.crimes) }))));

    // 3. Tội danh: mã dùng trong hồ sơ có tra được không.
    const crimeMissing = await prisma.$queryRaw<{ v: string; n: bigint }[]>`
      SELECT s.raw->>'toi_danh_chinh_blhs2015' AS v, count(*)::bigint AS n
      FROM legacy_staging s
      WHERE s."sourceFile" IN ('ho_so_doi_1','ho_so')
        AND s.raw->>'toi_danh_chinh_blhs2015' ~ '^[0-9]+$'
        AND NOT EXISTS (SELECT 1 FROM crimes c WHERE c."legacyValue" = (s.raw->>'toi_danh_chinh_blhs2015')::int)
      GROUP BY 1 ORDER BY 2 DESC`;
    results.push(checkCrimeCoverage(crimeMissing.map((c) => ({ legacyValue: c.v, records: Number(c.n) }))));

    // 4. Đơn vị chưa phân loại.
    const unknowns = await prisma.legacyUnitAlias.findMany({
      where: { kind: 'UNKNOWN' },
      select: { sampleRaw: true, rawValue: true, recordCount: true },
      orderBy: { recordCount: 'desc' },
    });
    results.push(checkUnknownUnits(unknowns.map((u) => ({ sample: u.sampleRaw ?? u.rawValue, count: u.recordCount }))));

    // 5. Trùng tên/mã tổ.
    const teams = await prisma.team.findMany({ select: { name: true, code: true } });
    results.push(checkTeamUniqueness(teams.map((t) => t.name), teams.map((t) => t.code)));

    // 6. Hồ sơ không nhận diện được phân loại — chạy đúng hàm mà bộ nạp sẽ dùng.
    const yearFilter = yearArg ? { path: ['nam'], equals: yearArg } : undefined;
    const recs = await prisma.legacyStaging.findMany({
      where: { sourceFile: { in: ['ho_so_doi_1', 'ho_so'] }, ...(yearFilter ? { raw: yearFilter } : {}) },
      select: { raw: true },
    });
    let unclassified = 0;
    for (const r of recs) {
      if (!normalizePhanLoai(r.raw as Record<string, unknown>)) unclassified++;
    }
    results.push(checkUnclassifiedRecords(unclassified, recs.length));

    // 7. Từng trường ngày kiểu epoch.
    for (const f of EPOCH_FIELDS) {
      const rows = await prisma.$queryRawUnsafe<{ rem: number; n: bigint }[]>(
        `SELECT (raw->>'${f}')::bigint % 86400 AS rem, count(*)::bigint AS n
         FROM legacy_staging
         WHERE "sourceFile" IN ('ho_so_doi_1','ho_so')
           AND raw->>'${f}' ~ '^[0-9]+$' AND (raw->>'${f}')::numeric > 946684800
         GROUP BY 1`,
      );
      results.push(checkEpochField(f, new Map(rows.map((r) => [Number(r.rem), Number(r.n)]))));
    }

    // ── In kết quả ──────────────────────────────────────────────────────────
    const icon = (s: string) => (s === 'BLOCK' ? '⛔' : s === 'WARN' ? '⚠️ ' : '✅');
    for (const r of results) {
      console.log(`${icon(r.severity)} [${r.severity}] ${r.title}: ${r.detail}`);
      for (const s of r.samples ?? []) console.log(`      · ${s}`);
    }

    // Nhóm hồ sơ mới nhất được soi riêng: đây là phần đang dùng hằng ngày, sai ở đây
    // ảnh hưởng ngay công việc, khác với hồ sơ 2016-2020 chủ yếu để tra cứu.
    const byYear = await prisma.$queryRaw<{ nam: string; n: bigint }[]>`
      SELECT COALESCE(raw->>'nam','(trống)') AS nam, count(*)::bigint AS n
      FROM legacy_staging WHERE "sourceFile" IN ('ho_so_doi_1','ho_so')
      GROUP BY 1 ORDER BY 1 DESC LIMIT 4`;
    console.log('\n── Hồ sơ mới nhất (nạp trước) ──');
    for (const r of byYear) console.log(`   ${String(r.nam).padStart(8)}: ${r.n} hồ sơ`);

    const sum = summarize(results);
    console.log(
      `\n${sum.canProceed ? '✅ ĐỦ ĐIỀU KIỆN NẠP' : '⛔ CHƯA ĐƯỢC NẠP'} — ${sum.blocks} lỗi chặn, ${sum.warns} cảnh báo.\n`,
    );
    if (!sum.canProceed) process.exitCode = 1;
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
