/**
 * backfill-case-person.ts — Surface thông tin NGƯỜI CUNG CẤP / bị hại của VỤ ÁN từ legacy_raw.
 *
 * Bug: buildCase KHÔNG map ten_ca_nhan/sinh_nam/so_cccd/sdt vào Case (chỉ Petition/Incident map)
 * → vụ án di trú mất hiển thị tên/sinh năm/CCCD người cung cấp dù nguồn CÓ (giữ trong legacy_raw).
 * Backfill vào Case.metadata (idempotent — chỉ set khi metadata chưa có + nguồn có).
 *
 * Dùng: npx ts-node cli/backfill-case-person.ts [--apply]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });
const APPLY = process.argv.includes('--apply');

// metadata key ← legacy_raw source key
const MAP: Record<string, string> = {
  tenCungCap: 'ten_ca_nhan_co_quan_to_chuc_cung_cap',
  sinhNamCungCap: 'sinh_nam_nguoi_to_giac',
  cccdCungCap: 'so_cccd_nguyen_don',
  ngayCapCccd: 'ngay_cap_cccd_nguyen_don',
  noiCapCccd: 'noi_cap_cccd_nguyen_don',
  sdtCungCap: 'so_dien_thoai_nguyen_don',
  diaChiCungCap: 'dia-chi-bi-hai',
};

async function main(): Promise<void> {
  const buildPairs = Object.entries(MAP)
    .map(([k, src]) => `'${k}', NULLIF(legacy_raw->>'${src}','')`)
    .join(', ');

  const pending = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT COUNT(*)::bigint n FROM "cases"
     WHERE legacy_raw IS NOT NULL
       AND (metadata->>'tenCungCap') IS NULL
       AND COALESCE(legacy_raw->>'ten_ca_nhan_co_quan_to_chuc_cung_cap','') <> ''`,
  );
  const n = Number(pending[0]?.n ?? 0);
  console.log(`  cases cần surface người cung cấp: ${n}`);
  if (!APPLY) {
    console.log('  (dry-run — thêm --apply để ghi)');
    return;
  }
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "cases"
     SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(${buildPairs}))
     WHERE legacy_raw IS NOT NULL
       AND (metadata->>'tenCungCap') IS NULL
       AND COALESCE(legacy_raw->>'ten_ca_nhan_co_quan_to_chuc_cung_cap','') <> ''`,
  );
  console.log(`  [apply] cập nhật ${updated} vụ án`);
}

main()
  .catch((e) => {
    console.error('[backfill-case-person] LỖI:', e?.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
