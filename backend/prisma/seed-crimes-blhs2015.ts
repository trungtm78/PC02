/**
 * Seed master Tội danh BLHS 2015 (bảng `crimes`) — 316 điều (Điều 108→425).
 * Run standalone: set -a && source .env && set +a && npx ts-node prisma/seed-crimes-blhs2015.ts
 * Hoặc gọi từ seed.ts: seedCrimes(prisma).
 * Idempotent: upsert theo `code` (D{articleNo}). Giữ nguyên id của bản ghi đã backfill từ Directory(type=CRIME)
 * trong migration crime_master_table → Subject.crimeId không vỡ FK.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { buildCrimeCatalog } from './crime-catalog';

export async function seedCrimes(prisma: PrismaClient): Promise<void> {
  const catalog = buildCrimeCatalog();
  let created = 0;
  let updated = 0;

  for (const c of catalog) {
    const existing = await prisma.crime.findUnique({ where: { code: c.code } });
    if (existing) updated++;
    else created++;
    await prisma.crime.upsert({
      where: { code: c.code },
      // upsert theo code: bản ghi đã backfill (id = Directory id) được cập nhật, GIỮ id → FK Subject còn hợp lệ.
      update: {
        name: c.name,
        articleNo: c.articleNo,
        chapter: c.chapter,
        pc02Relevant: c.pc02Relevant,
        legacyValue: c.legacyValue,
        order: c.order,
        isActive: c.isActive,
      },
      create: {
        code: c.code,
        name: c.name,
        articleNo: c.articleNo,
        chapter: c.chapter,
        pc02Relevant: c.pc02Relevant,
        legacyValue: c.legacyValue,
        order: c.order,
        isActive: c.isActive,
      },
    });
  }

  // Ẩn khỏi picker các crime KHÔNG thuộc catalog BLHS (placeholder di trú/KHAC từ backfill).
  // GIỮ bản ghi để Subject.crimeId cũ vẫn FK hợp lệ; display dùng relation nên không ảnh hưởng.
  const catalogCodes = catalog.map((c) => c.code);
  const deactivated = await prisma.crime.updateMany({
    where: { code: { notIn: catalogCodes }, isActive: true },
    data: { isActive: false },
  });

  const total = await prisma.crime.count();
  console.log(
    `[seed:crimes] catalog=${catalog.length} created=${created} updated=${updated} deactivated=${deactivated.count} | tổng crimes trong DB=${total}`,
  );
}

// Standalone mode
if (require.main === module) {
  const adapter = new PrismaPg({
    connectionString:
      process.env['DATABASE_URL'] ??
      'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
  });
  const standaloneClient = new PrismaClient({ adapter });
  seedCrimes(standaloneClient)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await standaloneClient.$disconnect();
    });
}
