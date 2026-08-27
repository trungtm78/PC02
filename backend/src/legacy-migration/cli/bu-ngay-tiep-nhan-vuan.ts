/**
 * bu-ngay-tiep-nhan-vuan.ts — điền `receiveDate` cho vụ án đã di trú.
 *
 * Cột `Case.receiveDate` có từ lâu nhưng bộ di trú CHƯA BAO GIỜ ghi, nên đo trên máy chạy
 * 27/08/2026: cả **3.359/3.359** vụ án di trú đều trống. Form Vụ án đòi ô này (từ PR #185,
 * 18/07/2026), nên KHÔNG vụ án cũ nào mở ra sửa và lưu lại được — bị chặn bởi "Vui lòng chọn
 * ngày tiếp nhận", một ô mà cán bộ không có gì để điền cho đúng.
 *
 * Dữ liệu vẫn còn nguyên trong bản thô: `ngay_de_xuat` có ở cả 3.359 hồ sơ,
 * `ngay_tiep_nhan_nguon_tin` ở 1.924. Cùng thứ tự ưu tiên như Đơn thư: biên bản tiếp nhận
 * trước, ngày đề xuất là đường lùi.
 *
 * AN TOÀN: chỉ điền hồ sơ đang trống; câu ghi kèm điều kiện ấy nên cán bộ điền xen giữa thì bỏ
 * qua; `legacyRaw` không đụng. Chạy hai lần cho kết quả như một. Mặc định `--dry`.
 *
 * Dùng:  set -a && source .env && set +a
 *        node dist/src/legacy-migration/cli/bu-ngay-tiep-nhan-vuan.js [--apply]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { parseLegacyDate } from '../legacy-mapper';
import { banGocTuAnhEm, type KhoBang } from './ban-goc-anh-em';

export interface KetQua {
  quet: number;
  dienVao: number;
  khongDoanDuoc: number;
  boQuaViSuaXen: number;
}

/** Ngày tiếp nhận suy từ bản thô hệ cũ: biên bản tiếp nhận trước, ngày đề xuất là đường lùi. */
export function ngayTiepNhanTuBanGoc(goc: Record<string, unknown> | null | undefined): Date | undefined {
  if (!goc) return undefined;
  return parseLegacyDate(goc.ngay_tiep_nhan_nguon_tin) ?? parseLegacyDate(goc.ngay_de_xuat);
}

export async function buNgayTiepNhan(prisma: PrismaClient, dry: boolean): Promise<KetQua> {
  const kq: KetQua = { quet: 0, dienVao: 0, khongDoanDuoc: 0, boQuaViSuaXen: 0 };

  // Hồ sơ là vỏ liên kết — bản thô nằm ở thực thể anh em cùng khoá nguồn.
  const rawAnhEm = await banGocTuAnhEm(prisma as unknown as KhoBang, 'case', { receiveDate: null });

  const BATCH = 1000;
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.case.findMany({
      where: { legacySourceId: { not: null }, receiveDate: null, deletedAt: null },
      select: { id: true, legacyRaw: true, legacySourceId: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (rows.length === 0) break;

    for (const r of rows) {
      kq.quet++;
      const goc =
        (r.legacyRaw as Record<string, unknown> | null) ??
        (r.legacySourceId ? rawAnhEm.get(r.legacySourceId) : null);
      const ngay = ngayTiepNhanTuBanGoc(goc);
      if (!ngay) {
        kq.khongDoanDuoc++;
        continue;
      }
      if (!dry) {
        // Chỉ ăn nếu ô VẪN trống — cán bộ điền xen giữa thì bỏ qua.
        const ghi = await prisma.case.updateMany({
          where: { id: r.id, receiveDate: null },
          data: { receiveDate: ngay },
        });
        if (ghi.count === 0) {
          kq.boQuaViSuaXen++;
          continue;
        }
      }
      kq.dienVao++;
    }
    cursor = rows[rows.length - 1].id;
    if (rows.length < BATCH) break;
  }
  return kq;
}

async function main(): Promise<void> {
  const dry = !process.argv.includes('--apply');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  try {
    const kq = await buNgayTiepNhan(prisma, dry);
    console.log(
      `[bu-ngay-tiep-nhan] quét ${kq.quet}, điền vào ${kq.dienVao}, ` +
        `không đoán được ${kq.khongDoanDuoc}, bỏ qua vì cán bộ sửa xen ${kq.boQuaViSuaXen}` +
        `${dry ? ' (THỬ — thêm --apply để ghi)' : ''}`,
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
