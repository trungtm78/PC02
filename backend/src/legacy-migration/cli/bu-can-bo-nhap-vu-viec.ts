/**
 * bu-can-bo-nhap-vu-viec.ts — bù ô "Cán bộ nhập" (`canBoNhapId`) cho vụ việc đã di trú.
 *
 * PHÁT HIỆN 18/09/2026 khi bấm thử bộ lọc: lọc Vụ việc theo "Cán bộ nhập" ra 0 dòng, cột "Người nhập"
 * trắng. Đo prod (chỉ đọc): 4.725 vụ việc, `canBoNhapId` có ở 6 bản, `createdById` có ở 4.607. Bộ nạp
 * hệ cũ gắn người thêm (`nguoi_them`) vào `createdById` mà không gắn vào ô cán bộ nhập — cột, bộ lọc
 * và thẻ tìm "Người nhập" của Vụ việc lại đọc ô ấy. Bộ nạp đã sửa; CLI này bù phần đã nạp.
 *
 * • Chỉ lấp ô ĐANG TRỐNG, bằng người tạo ĐÃ CÓ (khoá ngoại sẵn đúng) — không đè cán bộ nhập đã chọn.
 * • Chạy lại cho kết quả y hệt (lần hai: 0 dòng).
 * • MẶC ĐỊNH CHỈ ĐỌC, in mẫu để người đọc kiểm trước; `--apply` mới ghi, trong một giao dịch.
 *
 * Dùng: set -a && source .env && set +a
 *       ts-node src/legacy-migration/cli/bu-can-bo-nhap-vu-viec.ts [--apply]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/** Tập cần bù — câu đếm và câu ghi dùng CHUNG, lệch tập là số ghi khác số đếm và cả lượt bị huỷ oan. */
const TAP =
  'WHERE "canBoNhapId" IS NULL AND "createdById" IS NOT NULL AND "deletedAt" IS NULL';

export const CAU_DEM = `SELECT count(*)::int AS "thieu" FROM incidents ${TAP}`;

export const CAU_MAU =
  `SELECT i.code AS "ma", u.username AS "taiKhoan", ` +
  `concat_ws(' ', u."lastName", u."firstName") AS "hoTen" ` +
  `FROM incidents i JOIN users u ON u.id = i."createdById" ` +
  `WHERE i."canBoNhapId" IS NULL AND i."deletedAt" IS NULL ` +
  `ORDER BY i.code LIMIT 5`;

/** Không động `updatedAt` — đây là sửa di trú, không phải cán bộ sửa. */
export const CAU_BU = `UPDATE incidents SET "canBoNhapId" = "createdById" ${TAP}`;

export interface PrismaBu {
  $queryRawUnsafe<T = unknown>(sql: string): Promise<T>;
  $executeRawUnsafe(sql: string): Promise<number>;
  $transaction<T>(fn: (tx: PrismaBu) => Promise<T>): Promise<T>;
}

export async function buCanBoNhapVuViec(
  prisma: PrismaBu,
  apply: boolean,
  inRa: (dong: string) => void = console.log,
): Promise<{ thieu: number; daBu: number }> {
  inRa(
    `\n=== Bù Cán bộ nhập Vụ việc — chế độ: ${apply ? 'GHI THẬT' : 'CHỈ ĐỌC'} ===\n`,
  );
  const [dem] = await prisma.$queryRawUnsafe<Array<{ thieu: number }>>(CAU_DEM);
  const thieu = dem?.thieu ?? 0;
  inRa(`Vụ việc trống Cán bộ nhập nhưng có người tạo: ${thieu}`);
  if (thieu > 0) {
    const mau = await prisma.$queryRawUnsafe<
      Array<{
        ma: string | null;
        taiKhoan: string | null;
        hoTen: string | null;
      }>
    >(CAU_MAU);
    for (const m of mau) inRa(`   ${m.ma} → ${m.taiKhoan} (${m.hoTen})`);
  }
  if (!apply) {
    inRa('\nCHỈ ĐỌC — không ghi gì. Chạy lại với --apply để ghi.');
    return { thieu, daBu: 0 };
  }
  if (thieu === 0) return { thieu, daBu: 0 };
  const daBu = await prisma.$transaction(async (tx) => {
    const n = await tx.$executeRawUnsafe(CAU_BU);
    // Ghi khác số đã đếm nghĩa là dữ liệu đổi giữa chừng — huỷ cả giao dịch, không ghi nửa vời.
    if (n !== thieu) {
      throw new Error(`đếm ${thieu} mà ghi ${n} — huỷ, không ghi gì`);
    }
    return n;
  });
  inRa(`Đã bù ${daBu} vụ việc.`);
  return { thieu, daBu };
}

/** Kết nối theo `DATABASE_URL` — tạo client không mở kết nối, lệnh đầu tiên mới mở. */
export function taoPrisma(
  url = process.env['DATABASE_URL'],
): PrismaBu & { $disconnect(): Promise<void> } {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  }) as unknown as PrismaBu & { $disconnect(): Promise<void> };
}

/** Chỉ `--apply` mới ghi; kết nối LUÔN được đóng, kể cả khi lượt bù lỗi và huỷ giao dịch. */
export async function chayCli(
  argv: readonly string[],
  prisma: PrismaBu & { $disconnect(): Promise<void> },
  inRa?: (dong: string) => void,
): Promise<{ thieu: number; daBu: number }> {
  try {
    return await buCanBoNhapVuViec(prisma, argv.includes('--apply'), inRa);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  chayCli(process.argv, taoPrisma()).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
