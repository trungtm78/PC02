/**
 * bu-don-thu-lech-loai.ts — thêm ĐƠN THƯ GẮN KÈM cho hồ sơ hệ cũ nằm ở danh sách Đơn thư (`loai=don_thu`)
 * nhưng đã nạp thành Vụ án/Vụ việc (phân loại nguồn tin ra vụ án/vụ việc/luật sư).
 *
 * Anh báo 18/09/2026: "Lê Nguyễn Yến Thanh" (26-11129) hệ cũ có ở danh sách Đơn thư, hệ mới tìm không
 * ra. Đo prod: 61 vụ án + 25 vụ việc như vậy. Anh chốt: tạo THÊM đơn thư gắn kèm (trạng thái "Đã chuyển
 * vụ án/vụ việc", nối tới hồ sơ đích) — CHỈ THÊM, không sửa vụ án/vụ việc. Bộ nạp đã tự làm cho hồ sơ
 * nạp từ nay (`ganDonThuKemKhiLechLoai`); công cụ này bù cho hồ sơ đã nạp trước.
 *
 * • Mặc định CHẠY THỬ; `--that` mới ghi. Luôn `pg_dump` trước khi chạy thật.
 * • Bình ổn: đơn đã có (theo `legacySourceId`) thì bỏ qua — chạy lại ra 0.
 * • Sau khi thêm: cấp mã đơn bằng `buMaHoSo` (vỏ liên kết mượn bản thô vụ án/vụ việc anh em).
 *
 * Dùng: set -a && source .env && set +a
 *       node dist/src/legacy-migration/cli/bu-don-thu-lech-loai.js [--that]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { LegacyMigrationService } from '../legacy-migration.service';
import type { LegacyRecord } from '../legacy-mapper';
import { buMaHoSo } from './backfill-ma-ho-so';

/** Bản thô của vụ án/vụ việc di trú mà hệ cũ xếp ở danh sách Đơn thư. */
export function hoSoLoaiDonThu(
  dong: Array<{ legacySourceId: string | null; legacyRaw: unknown }>,
): LegacyRecord[] {
  return dong
    .filter(
      (d) => d.legacySourceId && d.legacyRaw && typeof d.legacyRaw === 'object',
    )
    .map((d) => d.legacyRaw as LegacyRecord)
    .filter((r) => {
      const loai =
        typeof r.loai === 'string' ? r.loai.trim().toLowerCase() : '';
      return loai === 'don_thu' || loai === 'don-thu' || loai === 'don';
    });
}

async function main(): Promise<void> {
  const that = process.argv.includes('--that');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  try {
    console.log(
      `=== Bù đơn thư gắn kèm — chế độ: ${that ? 'GHI THẬT' : 'CHẠY THỬ'} ===`,
    );
    const chon = {
      where: { legacySourceId: { not: null }, deletedAt: null },
      select: { legacySourceId: true, legacyRaw: true },
    };
    const [vuAn, vuViec] = await Promise.all([
      prisma.case.findMany(chon),
      prisma.incident.findMany(chon),
    ]);
    const records = hoSoLoaiDonThu([...vuAn, ...vuViec]);
    console.log(`Hồ sơ loai=don_thu đang ở Vụ án/Vụ việc: ${records.length}`);

    const service = new LegacyMigrationService(
      prisma as never,
      { log: () => Promise.resolve() } as never,
    );
    const kq = await service.ganDonThuKemChoHoSoDaCo(records, !that);

    const theoLoai = (l: 'CASE' | 'INCIDENT') =>
      kq.daTao.filter((x) => x.loai === l).length;
    console.log(
      `${that ? 'Đã thêm' : 'Sẽ thêm'} ${kq.daTao.length} đơn gắn kèm (vụ án ${theoLoai('CASE')}, vụ việc ${theoLoai('INCIDENT')})` +
        ` · đã có ${kq.daCo} · không thấy hồ sơ đích ${kq.khongThayDich.length} · lỗi ${kq.loi.length}`,
    );
    for (const x of kq.daTao.slice(0, 10))
      console.log(
        `  ${x.legacyId} → ${x.loai === 'CASE' ? 'vụ án' : 'vụ việc'} ${x.dichId}`,
      );
    for (const e of kq.loi.slice(0, 10))
      console.log(`  LỖI ${e.legacyId}: ${e.message.slice(0, 160)}`);

    if (that && kq.daTao.length) {
      // Đơn vừa thêm mang mã tạm `DT-LEGACY-…` — cấp mã thật ngay, cùng luật với bộ cập nhật.
      await buMaHoSo(prisma, true);
    }
    if (!that)
      console.log(
        '\n(CHẠY THỬ — chưa ghi gì. Thêm --that để thực thi, nhớ pg_dump trước.)',
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
