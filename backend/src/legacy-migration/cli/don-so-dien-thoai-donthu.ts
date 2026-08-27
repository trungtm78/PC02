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

/** Một bảng cần dọn: tên để nói với người, tên mô hình Prisma, và cột giữ số. */
export interface BangSoDienThoai {
  ten: string;
  model: 'petition' | 'incident' | 'case';
  cot: string;
}

/**
 * Ba bảng mang cùng một lỗi.
 *
 * Bộ dọn ra đời cho Đơn thư và chạy xong 4.691 hồ sơ hôm 26/08/2026. Vụ việc và Vụ án mang
 * đúng ký hiệu ấy ở cột riêng của chúng mà chưa ai đụng — cùng một lỗi, cùng một cách sửa.
 */
export const BANG_SO_DIEN_THOAI: readonly BangSoDienThoai[] = [
  { ten: 'Đơn thư', model: 'petition', cot: 'senderPhone' },
  { ten: 'Vụ việc', model: 'incident', cot: 'sdtNguoiToGiac' },
  { ten: 'Vụ án', model: 'case', cot: 'sdtCungCap' },
];

export interface KetQua {
  /** Tên bảng, để dòng báo cáo nói rõ con số thuộc màn nào. */
  ten: string;
  quet: number;
  xoaVeTrong: number;
  chuanHoa: number;
  giuLaiVìKhongDoanDuoc: number;
  boQuaViCanBoSuaXen: number;
}

export async function donSoDienThoai(
  prisma: PrismaClient,
  dry: boolean,
  bang: BangSoDienThoai = BANG_SO_DIEN_THOAI[0],
): Promise<KetQua> {
  // Cột khác nhau giữa ba bảng nên phải dựng điều kiện và dữ liệu theo tên cột. Prisma không
  // có kiểu cho cột động, nhưng `BANG_SO_DIEN_THOAI` là danh sách đóng nên tên cột luôn thật.
  const kho = (prisma as unknown as Record<string, {
    findMany: (a: unknown) => Promise<Record<string, unknown>[]>;
    updateMany: (a: unknown) => Promise<{ count: number }>;
  }>)[bang.model];
  const kq: KetQua = {
    ten: bang.ten,
    quet: 0,
    xoaVeTrong: 0,
    chuanHoa: 0,
    giuLaiVìKhongDoanDuoc: 0,
    boQuaViCanBoSuaXen: 0,
  };
  const BATCH = 1000;
  let cursor: string | undefined;
  for (;;) {
    const rows = await kho.findMany({
      where: { legacySourceId: { not: null }, [bang.cot]: { not: null } },
      select: { id: true, [bang.cot]: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;
    for (const raw of rows) {
      const r = { id: raw['id'] as string, sdt: (raw[bang.cot] ?? null) as string | null };
      kq.quet++;
      const doc = docSoDienThoaiHeCu(r.sdt);
      if (doc.loai === 'giu-nguyen') continue;
      if (doc.loai === 'khong-doan-duoc') {
        kq.giuLaiVìKhongDoanDuoc++;
        continue;
      }
      const moi = doc.loai === 'chuan-hoa' ? doc.giaTri : null;
      if (!dry) {
        // Chỉ ăn nếu ô vẫn đúng như lúc đọc — bản đọc là ảnh chụp.
        const kqGhi = await kho.updateMany({
          where: { id: r.id, [bang.cot]: r.sdt },
          data: { [bang.cot]: moi },
        });
        if (kqGhi.count === 0) {
          kq.boQuaViCanBoSuaXen++;
          continue;
        }
      }
      if (doc.loai === 'chuan-hoa') kq.chuanHoa++;
      else kq.xoaVeTrong++;
    }
    cursor = rows[rows.length - 1]['id'] as string;
    if (rows.length < BATCH) break;
  }
  return kq;
}

/** Chạy lần lượt cả ba bảng, trả về kết quả từng bảng theo đúng thứ tự đã khai. */
export async function donSoDienThoaiTatCa(prisma: PrismaClient, dry: boolean): Promise<KetQua[]> {
  const ds: KetQua[] = [];
  for (const bang of BANG_SO_DIEN_THOAI) {
    ds.push(await donSoDienThoai(prisma, dry, bang));
  }
  return ds;
}

async function main(): Promise<void> {
  const dry = process.argv.includes('--dry');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  try {
    for (const kq of await donSoDienThoaiTatCa(prisma, dry)) {
      console.log(
        `[don-sdt] ${kq.ten}: quét ${kq.quet}, xoá về trống ${kq.xoaVeTrong}, ` +
          `chuẩn hoá ${kq.chuanHoa}, giữ lại vì không đoán được ${kq.giuLaiVìKhongDoanDuoc}, ` +
          `bỏ qua vì cán bộ sửa xen ${kq.boQuaViCanBoSuaXen}${dry ? ' (THỬ)' : ''}`,
      );
    }
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
