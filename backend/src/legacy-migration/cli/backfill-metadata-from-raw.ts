/**
 * backfill-metadata-from-raw.ts — Đưa MỌI field hệ cũ vào metadata cấu trúc (Petition/Incident).
 *
 * Petition/Incident trước KHÔNG có cột metadata → nhiều field cũ kẹt trong legacyRaw.
 * Nay: metadata = mọi key legacyRaw (bỏ _search/hệ thống, bỏ giá trị rỗng) → mỗi field cũ
 * có ô tương ứng cấu trúc (yêu cầu: chuyển đầy đủ field cũ sang field mới). Idempotent.
 *
 * Dùng: npx ts-node cli/backfill-metadata-from-raw.ts [--apply]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });
const APPLY = process.argv.includes('--apply');

// legacyRaw column name khác nhau: petitions/incidents dùng "legacyRaw".
const TABLES = ['petitions', 'incidents'];

// SQL build metadata = jsonb_object_agg(non-system, non-empty keys).
function updateSql(table: string): string {
  return `
    UPDATE "${table}" t SET metadata = sub.md
    FROM (
      SELECT x.id, jsonb_object_agg(e.key, e.value) AS md
      FROM "${table}" x, LATERAL jsonb_each(x."legacyRaw") AS e(key, value)
      WHERE x."legacyRaw" IS NOT NULL AND x.metadata IS NULL
        AND e.key NOT LIKE '%\\_search'
        AND e.key NOT LIKE '\\_%'
        AND e.key NOT IN ('da_xoa','da_nhan','don_vi_id','nguoi_them','__v','add_time','update_time')
        AND COALESCE(e.value #>> '{}', '') <> ''
      GROUP BY x.id
    ) sub
    WHERE t.id = sub.id`;
}

async function main(): Promise<void> {
  for (const table of TABLES) {
    const pending = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT COUNT(*)::bigint n FROM "${table}" WHERE "legacyRaw" IS NOT NULL AND metadata IS NULL`,
    );
    const n = Number(pending[0]?.n ?? 0);
    if (!APPLY) {
      console.log(`  [dry] ${table}: ${n} bản ghi cần đưa field cũ vào metadata`);
      continue;
    }
    const updated = await prisma.$executeRawUnsafe(updateSql(table));
    console.log(`  [apply] ${table}: cập nhật metadata ${updated} bản ghi`);
  }
}

main()
  .catch((e) => {
    console.error('[backfill-metadata] LỖI:', e?.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
