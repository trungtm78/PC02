/**
 * Cleanup: xóa tội danh không đúng BLHS
 * Giữ lại: D{số} + KHAC
 * Xóa: test data (CHI*, DIEU-*, v.v.)
 * Run: npx ts-node prisma/cleanup-crime.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env['DATABASE_URL'] ?? 'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const all = await prisma.directory.findMany({
    where: { type: 'CRIME' },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

  console.log(`Total CRIME entries in DB: ${all.length}`);

  // Valid: D + digits OR KHAC (BLHS article codes)
  const validPattern = /^D\d+$|^KHAC$/;
  const toDelete = all.filter(x => !validPattern.test(x.code));
  const toKeep = all.filter(x => validPattern.test(x.code));

  console.log(`\nKeep (${toKeep.length} entries):`);
  toKeep.forEach(x => console.log(`  ✓ ${x.code}: ${x.name}`));

  console.log(`\nDelete (${toDelete.length} entries):`);
  toDelete.forEach(x => console.log(`  ✗ ${x.code}: ${x.name}`));

  if (toDelete.length === 0) {
    console.log('\nNothing to delete. DB is clean.');
    return;
  }

  const ids = toDelete.map(x => x.id);
  const result = await prisma.directory.deleteMany({
    where: { id: { in: ids } },
  });

  console.log(`\n✅ Deleted ${result.count} incorrect CRIME entries.`);
  console.log(`   Remaining CRIME entries: ${toKeep.length}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
