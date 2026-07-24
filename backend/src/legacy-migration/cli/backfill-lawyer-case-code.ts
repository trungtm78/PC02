/**
 * Cấp mã cho VỤ ÁN NGUỒN LUẬT SƯ còn trống mã: `LS-<năm>-<STT>`.
 *
 * Bối cảnh: 20 vụ nguồn `luat-su` (mỗi vụ 1 luật sư, tội danh, KHÔNG có năm/ngày/diễn biến)
 * không dựng được mã VA-năm-STT vì nguồn `nam=0`. Anh chốt: mã LS-[năm]-STT.
 * Năm: dùng `nam` nếu hợp lệ (4 chữ số > 0); không thì lùi về NĂM NHẬP HỆ (createdAt) —
 * ghi rõ là năm nhập, không phải năm phát sinh (nguồn không có).
 *
 * Chỉ vụ TRỐNG mã, chống trùng (@unique), idempotent, mặc định `--dry`.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { capMaDuyNhat } from './backfill-case-code';

/** Mã luật sư: LS-<năm>-<STT>. Năm lùi về createdAt khi nam không hợp lệ. */
export function maLuatSu(nam: unknown, sttCu: unknown, stt: unknown, namNhap: number): string | undefined {
  const y = String(nam ?? '').trim();
  const nam4 = /^\d{4}$/.test(y) && y !== '0000' ? y : String(namNhap);
  const s = String(sttCu ?? '').trim() || String(stt ?? '').trim();
  if (!s) return undefined;
  return `LS-${nam4}-${s}`;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    const coCode = await prisma.case.findMany({
      where: { caseCode: { not: null } },
      select: { caseCode: true },
    });
    const daDung = new Set<string>(coCode.map((c) => c.caseCode!).filter(Boolean));

    const cases = await prisma.case.findMany({
      where: { legacySourceId: { not: null }, deletedAt: null, OR: [{ caseCode: null }, { caseCode: '' }] },
      select: { id: true, legacyRaw: true, createdAt: true },
      orderBy: { legacySourceId: 'asc' },
    });

    let ganDuoc = 0;
    let thieuStt = 0;
    for (const c of cases) {
      const raw = (c.legacyRaw ?? {}) as Record<string, unknown>;
      const base = maLuatSu(raw.nam, raw.stt_cu, raw.stt, c.createdAt.getUTCFullYear());
      if (!base) {
        thieuStt++;
        continue;
      }
      const code = capMaDuyNhat(base, daDung);
      ganDuoc++;
      if (apply) await prisma.case.update({ where: { id: c.id }, data: { caseCode: code } });
    }

    console.log(apply ? '\n— ĐÃ GHI —\n' : '\n— CHẠY THỬ (thêm --apply để ghi) —\n');
    console.log(`Vụ án luật sư còn trống mã : ${cases.length}`);
    console.log(`  → gán mã LS-năm-STT      : ${ganDuoc}`);
    console.log(`  → thiếu STT (bỏ)         : ${thieuStt}`);
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
