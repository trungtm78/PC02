/**
 * Đổi mã LS-* → VA-* cho vụ án đã lỡ gán tiền tố LS (Luật sư). Bản chất chúng là VỤ ÁN HÌNH SỰ
 * (Giết người…), chỉ đến TỪ nguồn luat-su, nên phải mang tiền tố VA.
 *
 * STT cũ của chúng (LS-2026-10…) TRÙNG dải VA-2026-<STT> đã dùng, nên cấp STT MỚI từ bộ đếm
 * engine của năm tương ứng (VA-2026-09872…) — không đụng mã sẵn có. Bump bộ đếm để vụ mới
 * tiếp tục phía trên. Idempotent (không còn LS- thì 0). Mặc định `--dry`.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const PAD = 5;

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    const tpl = await prisma.documentNumberTemplate.findFirst({
      where: { documentType: 'CASE', isActive: true },
      select: { id: true },
    });
    if (!tpl) throw new Error('Không thấy template CASE active — chạy seed-document-numbers trước.');

    const cases = await prisma.case.findMany({
      where: { caseCode: { startsWith: 'LS-' }, deletedAt: null },
      select: { id: true, caseCode: true },
      orderBy: { legacySourceId: 'asc' },
    });

    // Nhóm theo NĂM lấy từ mã LS-<năm>-<stt>; cấp STT mới từ bộ đếm năm đó.
    const counters = new Map<string, number>();
    const getCounter = async (year: string): Promise<number> => {
      if (counters.has(year)) return counters.get(year)!;
      const c = await prisma.documentNumberCounter.findUnique({
        where: { templateId_periodKey: { templateId: tpl.id, periodKey: year } },
        select: { currentValue: true },
      });
      counters.set(year, c?.currentValue ?? 0);
      return counters.get(year)!;
    };

    let doi = 0;
    const mau: string[] = [];
    for (const c of cases) {
      const year = (c.caseCode ?? '').split('-')[1] ?? '2026';
      const next = (await getCounter(year)) + 1;
      counters.set(year, next);
      const code = `VA-${year}-${String(next).padStart(PAD, '0')}`;
      doi++;
      if (mau.length < 4) mau.push(`${c.caseCode} → ${code}`);
      if (apply) await prisma.case.update({ where: { id: c.id }, data: { caseCode: code } });
    }

    if (apply) {
      for (const [year, val] of counters) {
        await prisma.documentNumberCounter.upsert({
          where: { templateId_periodKey: { templateId: tpl.id, periodKey: year } },
          create: { templateId: tpl.id, periodKey: year, currentValue: val },
          update: { currentValue: val },
        });
      }
    }

    console.log(apply ? '\n— ĐÃ GHI —\n' : '\n— CHẠY THỬ (thêm --apply để ghi) —\n');
    console.log(`Vụ mã LS- → VA-: ${doi}`);
    for (const m of mau) console.log(`   ${m}`);
    for (const [year, val] of counters) console.log(`   bộ đếm CASE ${year} → ${val}`);
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
