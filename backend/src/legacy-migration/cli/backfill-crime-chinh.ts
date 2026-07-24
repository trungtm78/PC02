/**
 * Nối TỘI DANH CHÍNH của vụ án di trú sang FK master Crime (Case.crimeChinhId) — chuẩn như Petition.
 *
 * Vì sao: form Vụ án trước dùng MasterClass 07 (18 mục thô) + cột `crime` (text) nên tội danh
 * không hiện trong ô chọn và không lọc/thống kê được. Nay Case có `crimeChinhId` FK → master
 * Crime (316 điều BLHS 2015). Nguồn cũ ghi `toi_danh_chinh_blhs2015`/`toi_danh_chinh` = SỐ
 * (legacyValue). Resolve: số → Crime.legacyValue; lùi về khớp TÊN với cột `crime`.
 *
 * Chỉ vụ CHƯA có crimeChinhId, idempotent, mặc định `--dry`.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/** Chuẩn hoá tên tội danh để khớp: bỏ dấu, thường hoá, gộp khoảng trắng, bỏ tiền tố "tội". */
export function chuanTenToi(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/^tội\s+|^toi\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    const crimes = await prisma.crime.findMany({ select: { id: true, name: true, legacyValue: true } });
    const byLegacy = new Map<number, string>();
    const byName = new Map<string, string>();
    for (const c of crimes) {
      if (c.legacyValue != null) byLegacy.set(c.legacyValue, c.id);
      byName.set(chuanTenToi(c.name), c.id);
    }

    const cases = await prisma.case.findMany({
      where: { legacySourceId: { not: null }, crimeChinhId: null, deletedAt: null },
      select: { id: true, crime: true, legacyRaw: true },
    });

    let quaSo = 0;
    let quaTen = 0;
    let khong = 0;
    for (const c of cases) {
      const raw = (c.legacyRaw ?? {}) as Record<string, unknown>;
      const lvRaw = raw.toi_danh_chinh_blhs2015 ?? raw.toi_danh_chinh;
      const lv = Number(String(lvRaw ?? '').trim());
      let crimeId: string | undefined;
      if (Number.isInteger(lv) && lv > 0) crimeId = byLegacy.get(lv);
      if (!crimeId && c.crime) crimeId = byName.get(chuanTenToi(c.crime));
      if (!crimeId) {
        khong++;
        continue;
      }
      if (Number.isInteger(lv) && lv > 0 && byLegacy.get(lv)) quaSo++;
      else quaTen++;
      if (apply) await prisma.case.update({ where: { id: c.id }, data: { crimeChinhId: crimeId } });
    }

    console.log(apply ? '\n— ĐÃ GHI —\n' : '\n— CHẠY THỬ (thêm --apply để ghi) —\n');
    console.log(`Vụ án chưa có tội danh FK : ${cases.length}`);
    console.log(`  → nối qua số (legacyValue): ${quaSo}`);
    console.log(`  → nối qua khớp tên        : ${quaTen}`);
    console.log(`  → không resolve được      : ${khong}`);
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
