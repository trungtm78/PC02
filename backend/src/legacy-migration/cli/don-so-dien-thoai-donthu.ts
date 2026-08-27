/**
 * don-so-dien-thoai-donthu.ts — dọn ô số điện thoại của đơn thư đã di trú.
 *
 * Hệ cũ để cán bộ gõ tự do, và 4.693 hồ sơ mang KÝ HIỆU "không có" thay vì số: `...`, `0000`,
 * `..`, `Không`, `,`. Giữ nguyên thì hồ sơ mở ra bị chặn Lưu bởi một ô mà cán bộ không có gì
 * để sửa cho đúng — cùng lớp với số `0` bịa ở ô thiệt hại đã dọn hôm 26/08/2026.
 *
 * Ba việc, theo `docSoDienThoaiHeCu`:
 *   - ký hiệu "không có"  → xoá về trống.
 *   - đúng số nhưng có dấu phân cách → bỏ dấu.
 *   - còn lại → KHÔNG đụng (có thể là số thật ở dạng lạ), đếm riêng và nói ra.
 *
 * AN TOÀN: chỉ đụng hồ sơ DI TRÚ, và câu ghi chỉ ăn nếu ô vẫn đúng như lúc đọc — cán bộ sửa
 * xen giữa thì bỏ qua. `legacyRaw` không đụng tới, nên lúc nào cũng tra lại được bản gốc.
 *
 * Dùng:  set -a && source .env && set +a
 *        node dist/src/legacy-migration/cli/don-so-dien-thoai-donthu.js [--dry]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { docSoDienThoaiHeCu } from '../so-dien-thoai-he-cu';

export interface KetQua {
  quet: number;
  xoaVeTrong: number;
  chuanHoa: number;
  giuLaiVìKhongDoanDuoc: number;
  boQuaViCanBoSuaXen: number;
}

export async function donSoDienThoai(prisma: PrismaClient, dry: boolean): Promise<KetQua> {
  const kq: KetQua = {
    quet: 0,
    xoaVeTrong: 0,
    chuanHoa: 0,
    giuLaiVìKhongDoanDuoc: 0,
    boQuaViCanBoSuaXen: 0,
  };
  const BATCH = 1000;
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.petition.findMany({
      where: { legacySourceId: { not: null }, senderPhone: { not: null } },
      select: { id: true, senderPhone: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;
    for (const r of rows) {
      kq.quet++;
      const doc = docSoDienThoaiHeCu(r.senderPhone);
      if (doc.loai === 'giu-nguyen') continue;
      if (doc.loai === 'khong-doan-duoc') {
        kq.giuLaiVìKhongDoanDuoc++;
        continue;
      }
      const moi = doc.loai === 'chuan-hoa' ? doc.giaTri : null;
      if (!dry) {
        // Chỉ ăn nếu ô vẫn đúng như lúc đọc — bản đọc là ảnh chụp.
        const kqGhi = await prisma.petition.updateMany({
          where: { id: r.id, senderPhone: r.senderPhone },
          data: { senderPhone: moi },
        });
        if (kqGhi.count === 0) {
          kq.boQuaViCanBoSuaXen++;
          continue;
        }
      }
      if (doc.loai === 'chuan-hoa') kq.chuanHoa++;
      else kq.xoaVeTrong++;
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
    const kq = await donSoDienThoai(prisma, dry);
    console.log(
      `[don-sdt] quét ${kq.quet}, xoá về trống ${kq.xoaVeTrong}, chuẩn hoá ${kq.chuanHoa}, ` +
        `giữ lại vì không đoán được ${kq.giuLaiVìKhongDoanDuoc}, ` +
        `bỏ qua vì cán bộ sửa xen ${kq.boQuaViCanBoSuaXen}${dry ? ' (THỬ)' : ''}`,
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
