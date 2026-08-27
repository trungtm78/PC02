/**
 * bu-noi-dung-donthu.ts — điền ô nội dung cho đơn thư đã di trú.
 *
 * Hệ cũ có ĐÚNG MỘT ô nội dung. Bản di trú đổ nó vào `summary`, nhưng form hiện ô "Tóm tắt
 * nội dung" đọc `detailContent` (`summary` bị ẩn và được suy lại từ `detailContent` mỗi lần
 * lưu). Hệ quả đo trên máy chạy 27/08/2026: cả 46.499 hồ sơ di trú mở ra thấy ô nội dung
 * TRẮNG dù chữ vẫn nằm trong bảng, và bấm Lưu thì bị chặn vì "Nội dung là bắt buộc".
 *
 * AN TOÀN: chỉ điền hồ sơ có `summary` mà `detailContent` đang trống. Không đè chữ cán bộ đã
 * gõ, không đụng `summary`, không đụng `legacyRaw`. Chạy hai lần cho kết quả như một.
 *
 * Dùng:  set -a && source .env && set +a
 *        node dist/src/legacy-migration/cli/bu-noi-dung-donthu.js [--dry]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export interface KetQua {
  quet: number;
  dienVao: number;
  boQuaViDaCoChu: number;
}

/** Ô nội dung coi là TRỐNG khi thiếu hẳn hoặc chỉ có khoảng trắng. */
export function dangTrong(v: string | null | undefined): boolean {
  return v == null || v.trim() === '';
}

export async function buNoiDung(prisma: PrismaClient, dry: boolean): Promise<KetQua> {
  const kq: KetQua = { quet: 0, dienVao: 0, boQuaViDaCoChu: 0 };
  const BATCH = 1000;
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.petition.findMany({
      // Chi ho so DI TRU. Don thu tao tren he moi suy `summary` ra TU `detailContent`, nen cap
      // "co tom tat ma trong noi dung" khong the xay ra - quet chung chi mo them duong ghi nham.
      where: { summary: { not: null }, legacySourceId: { not: null } },
      select: { id: true, summary: true, detailContent: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;
    for (const r of rows) {
      kq.quet++;
      if (!dangTrong(r.detailContent)) {
        kq.boQuaViDaCoChu++;
        continue;
      }
      if (dangTrong(r.summary)) continue;
      kq.dienVao++;
      if (!dry) {
        // Kiem "dang trong" LAI ngay trong cau ghi. Ban doc la anh chup: can bo co the go noi
        // dung vao dung ho so ay giua luc doc va luc ghi, va khi ay `update` theo id se de mat
        // chu vua go. `updateMany` kem dieu kien thi cau ghi tu bo qua.
        const r2 = await prisma.petition.updateMany({
          where: { id: r.id, OR: [{ detailContent: null }, { detailContent: '' }] },
          data: { detailContent: r.summary as string },
        });
        if (r2.count === 0) {
          kq.dienVao--;
          kq.boQuaViDaCoChu++;
        }
      }
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < BATCH) break;
  }
  return kq;
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  try {
    const kq = await buNoiDung(prisma, dry);
    console.log(
      `[bu-noi-dung] quét ${kq.quet}, điền vào ${kq.dienVao}, bỏ qua vì đã có chữ ${kq.boQuaViDaCoChu}${dry ? ' (THỬ)' : ''}`,
    );
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
