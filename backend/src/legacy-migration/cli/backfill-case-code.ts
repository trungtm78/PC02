/**
 * Sinh MÃ VỤ ÁN CHUẨN cho vụ án di trú (hệ cũ không có mã): `VA-<năm phát sinh>-<STT cũ>`.
 *
 * Anh chốt format: VA-[năm phát sinh]-STT(số thứ tự vụ án cũ). Nguồn:
 *   • năm  = `nam` (năm phát sinh hồ sơ cũ — phủ 100% vụ án)
 *   • STT  = `stt_cu` (số thứ tự cũ); lùi về `stt` nếu trống
 *
 * Ràng buộc:
 *   • CHỈ điền vụ án đang TRỐNG caseCode (không đè 91 mã engine đã sinh, không đè lần chạy trước).
 *   • `caseCode` là @unique — trùng thì thêm hậu tố `-2`, `-3`… (stt_cu lặp giữa các loại hồ sơ).
 *   • Duyệt theo thứ tự legacySourceId để KẾT QUẢ ỔN ĐỊNH (chạy lại không đổi mã đã gán).
 *   • Mặc định `--dry`; ghi khi `--apply`.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/** Sinh mã cơ sở từ năm + STT. Trả về undefined nếu thiếu dữ kiện (không bịa). */
export function maCoSo(nam: unknown, sttCu: unknown, stt: unknown): string | undefined {
  const y = String(nam ?? '').trim();
  const s = String(sttCu ?? '').trim() || String(stt ?? '').trim();
  if (!/^\d{4}$/.test(y) || !s) return undefined;
  return `VA-${y}-${s}`;
}

/** Cấp mã DUY NHẤT: thêm hậu tố -2, -3… nếu mã cơ sở đã bị chiếm. */
export function capMaDuyNhat(base: string, daDung: Set<string>): string {
  if (!daDung.has(base)) {
    daDung.add(base);
    return base;
  }
  for (let i = 2; ; i++) {
    const thu = `${base}-${i}`;
    if (!daDung.has(thu)) {
      daDung.add(thu);
      return thu;
    }
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }) });

  try {
    // Tập mã ĐANG dùng (mọi caseCode hiện có) để không đụng độ.
    const coCode = await prisma.case.findMany({
      where: { caseCode: { not: null } },
      select: { caseCode: true },
    });
    const daDung = new Set<string>(coCode.map((c) => c.caseCode!).filter(Boolean));

    // Vụ án di trú CHƯA có mã, duyệt theo legacySourceId cho ổn định.
    const cases = await prisma.case.findMany({
      where: { legacySourceId: { not: null }, OR: [{ caseCode: null }, { caseCode: '' }] },
      select: { id: true, legacyRaw: true },
      orderBy: { legacySourceId: 'asc' },
    });

    // Năm hiện tại: mã engine cấp cho vụ án MỚI dùng counter năm này. Phải nâng counter lên
    // trên STT lớn nhất đã backfill năm nay, nếu không mã mới sẽ TRÙNG mã backfill (caseCode @unique).
    const namNay = String(new Date().getUTCFullYear());
    let maxSttNamNay = 0;

    let ganDuoc = 0;
    let thieuDuLieu = 0;
    for (const c of cases) {
      const raw = (c.legacyRaw ?? {}) as Record<string, unknown>;
      const base = maCoSo(raw.nam, raw.stt_cu, raw.stt);
      if (!base) {
        thieuDuLieu++;
        continue;
      }
      const code = capMaDuyNhat(base, daDung);
      ganDuoc++;
      if (String(raw.nam ?? '').trim() === namNay) {
        const seq = parseInt(String(raw.stt_cu ?? '').trim() || String(raw.stt ?? '').trim(), 10);
        if (!Number.isNaN(seq)) maxSttNamNay = Math.max(maxSttNamNay, seq);
      }
      if (apply) await prisma.case.update({ where: { id: c.id }, data: { caseCode: code } });
    }

    // Nâng counter CASE năm hiện tại (idempotent — chỉ tăng, không giảm).
    let bumpTo = 0;
    if (apply && maxSttNamNay > 0) {
      const tpl = await prisma.documentNumberTemplate.findFirst({
        where: { documentType: 'CASE', isActive: true },
        select: { id: true },
      });
      if (tpl) {
        const cur = await prisma.documentNumberCounter.findUnique({
          where: { templateId_periodKey: { templateId: tpl.id, periodKey: namNay } },
          select: { currentValue: true },
        });
        bumpTo = Math.max(cur?.currentValue ?? 0, maxSttNamNay);
        await prisma.documentNumberCounter.upsert({
          where: { templateId_periodKey: { templateId: tpl.id, periodKey: namNay } },
          create: { templateId: tpl.id, periodKey: namNay, currentValue: bumpTo },
          update: { currentValue: bumpTo },
        });
      }
    }

    console.log(apply ? '\n— ĐÃ GHI —\n' : '\n— CHẠY THỬ (thêm --apply để ghi) —\n');
    console.log(`Vụ án di trú chưa có mã : ${cases.length}`);
    console.log(`  → gán mã VA-năm-STT   : ${ganDuoc}`);
    console.log(`  → thiếu năm/STT (bỏ)  : ${thieuDuLieu}`);
    if (apply && bumpTo > 0) console.log(`  → nâng counter CASE ${namNay} → ${bumpTo} (tránh trùng mã mới)`);
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
