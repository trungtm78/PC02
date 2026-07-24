/**
 * Soft-delete các VỤ ÁN RÁC TEST lẫn trong prod: tên chứa "UAT-RUN" (sinh bởi bộ chạy UAT).
 *
 * An toàn: chỉ đánh dấu `deletedAt` (khôi phục được), KHÔNG xoá cứng. Bỏ qua vụ đã xoá.
 * Mặc định `--dry`; ghi khi `--apply`.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    const rac = await prisma.case.findMany({
      where: { deletedAt: null, name: { contains: 'UAT-RUN' } },
      select: { id: true, name: true },
    });

    console.log(apply ? '\n— ĐÃ SOFT-DELETE —\n' : '\n— CHẠY THỬ (thêm --apply để xoá) —\n');
    console.log(`Vụ án rác UAT-RUN: ${rac.length}`);
    for (const c of rac.slice(0, 5)) console.log(`   ${c.name}`);
    if (rac.length > 5) console.log(`   … và ${rac.length - 5} vụ khác`);

    if (apply && rac.length) {
      const r = await prisma.case.updateMany({
        where: { id: { in: rac.map((c) => c.id) } },
        data: { deletedAt: new Date() },
      });
      console.log(`\nĐã đánh dấu xoá ${r.count} vụ (khôi phục được bằng cách xoá deletedAt).`);
    }
    console.log('');
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
