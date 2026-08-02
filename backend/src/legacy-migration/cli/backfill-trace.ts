/**
 * backfill-trace.ts — Điền field TRUY NGUYÊN cho bản ghi đã di trú (PR-3).
 *
 * Bản ghi cũ di trú TRƯỚC khi có soHoSoCu/legacyId/legacyCollection. Backfill từ:
 *  - legacySourceId ("collection:id") → legacyCollection + legacyId
 *  - legacyRaw->>'stt' (hoặc 'stt_cu') → soHoSoCu (số hồ sơ hệ cũ, tìm kiếm được)
 *
 * Idempotent: chỉ cập nhật row có legacyId IS NULL. Chạy được local + prod.
 * Dùng: npx ts-node cli/backfill-trace.ts [--apply]  (mặc định dry-run đếm)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });
const APPLY = process.argv.includes('--apply');

// legacy_raw column: cases dùng @map("legacy_raw"); petitions/incidents dùng "legacyRaw".
const TABLES: Array<{ table: string; rawCol: string }> = [
  { table: 'cases', rawCol: 'legacy_raw' },
  { table: 'petitions', rawCol: '"legacyRaw"' },
  { table: 'incidents', rawCol: '"legacyRaw"' },
];

async function main(): Promise<void> {
  for (const { table, rawCol } of TABLES) {
    const pending = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT COUNT(*)::bigint n FROM "${table}" WHERE "legacySourceId" IS NOT NULL AND "legacyId" IS NULL`,
    );
    const n = Number(pending[0]?.n ?? 0);
    if (!APPLY) {
      console.log(`  [dry] ${table}: ${n} bản ghi cần backfill trace`);
      continue;
    }
    // legacyId = phần sau dấu ':' cuối (hoặc cả chuỗi nếu không có ':'); chỉ khi là số.
    const updated = await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET
         "legacyCollection" = CASE WHEN "legacySourceId" LIKE '%:%' THEN split_part("legacySourceId", ':', 1) ELSE NULL END,
         "legacyId" = CASE WHEN regexp_replace("legacySourceId", '^.*:', '') ~ '^[0-9]+$'
                           THEN regexp_replace("legacySourceId", '^.*:', '')::int ELSE NULL END,
         "soHoSoCu" = COALESCE(${rawCol}->>'stt', ${rawCol}->>'stt_cu')
       WHERE "legacySourceId" IS NOT NULL AND "legacyId" IS NULL`,
    );
    console.log(`  [apply] ${table}: cập nhật ${updated} bản ghi`);
  }
}

main()
  .catch((e) => {
    console.error('[backfill-trace] LỖI:', e?.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
