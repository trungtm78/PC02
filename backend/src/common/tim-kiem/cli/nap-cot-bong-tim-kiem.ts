/**
 * Nạp cột bóng tìm kiếm cho dữ liệu CŨ, theo lô, sau khi migration tìm kiếm đã áp.
 *
 * Vì sao không nạp trong migration: đo 15/09/2026, UPDATE 47.169 đơn thư + dựng chỉ mục khoá bảng
 * ~50 giây giữa lúc deploy. Theo lô thì mỗi câu chỉ chạm 1.000 dòng, cán bộ vẫn ghi được.
 *
 * Đi theo CON TRỎ id: lấy 1.000 id kế tiếp (khoá chính, rẻ), rồi chỉ UPDATE dòng lệch trong số đó.
 * Cách "lấy 1.000 dòng lệch đầu tiên" chạy thật mất ~15 s mỗi lô vì lô sau phải đi qua lại mọi
 * dòng lô trước đã sửa. Con trỏ luôn tăng nên vòng lặp tự kết thúc.
 *
 * Câu SQL sinh từ CÙNG tệp khai với trigger (`sinhCauNapCotBong`), chỉ SET cột bóng (không đẩy
 * `updatedAt`, không kích trigger). Chỉ ghi dòng lệch nên chạy lại ra 0 ghi.
 *
 * Dùng:
 *   set -a && source .env && set +a
 *   node dist/src/common/tim-kiem/cli/nap-cot-bong-tim-kiem.js          # chạy thử: đếm dòng lệch
 *   node dist/src/common/tim-kiem/cli/nap-cot-bong-tim-kiem.js --that   # nạp thật
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { KHAI_TIM_KIEM } from '../khai';
import {
  canNapDoiTuong,
  canNapHoTen,
  sinhCauNapCotBong,
  sinhCauNapDoiTuong,
  sinhCauNapHoTen,
  type CauNap,
} from '../sinh/sinh-tim-kiem';

export const LO_MAC_DINH = 1000;

type PrismaNap = Pick<PrismaClient, '$queryRawUnsafe' | '$executeRawUnsafe'>;

async function demLech(prisma: PrismaNap, cau: CauNap): Promise<number> {
  const [dong] = await prisma.$queryRawUnsafe<Array<{ n: number }>>(cau.dem);
  return Number(dong?.n ?? 0);
}

export interface KetQuaNap {
  bang: string;
  lechTruoc: number;
  daNap: number;
  lechSau: number;
}

export async function napCotBongTimKiem(
  prisma: PrismaNap,
  ghiThat: boolean,
  lo = LO_MAC_DINH,
): Promise<KetQuaNap[]> {
  const viec: Array<{ bang: string; cau: CauNap }> = [
    ...(canNapHoTen(KHAI_TIM_KIEM)
      ? [{ bang: 'users', cau: sinhCauNapHoTen() }]
      : []),
    ...(canNapDoiTuong(KHAI_TIM_KIEM)
      ? [{ bang: 'subjects', cau: sinhCauNapDoiTuong() }]
      : []),
    ...KHAI_TIM_KIEM.map((k) => ({ bang: k.bang, cau: sinhCauNapCotBong(k) })),
  ];

  const ketQua: KetQuaNap[] = [];
  for (const { bang, cau } of viec) {
    const lechTruoc = await demLech(prisma, cau);
    console.log(`${bang}: ${lechTruoc} dòng cột bóng lệch cột nguồn`);
    if (!ghiThat || lechTruoc === 0) {
      ketQua.push({ bang, lechTruoc, daNap: 0, lechSau: lechTruoc });
      continue;
    }

    let conTro = '';
    let daNap = 0;
    for (;;) {
      const dong = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        cau.layLo,
        conTro,
        lo,
      );
      if (dong.length === 0) break;
      const ids = dong.map((d) => d.id);
      daNap += await prisma.$executeRawUnsafe(cau.nap, ids);
      conTro = ids[ids.length - 1];
      console.log(`  ${bang}: tới id ${conTro}, đã nạp ${daNap}/${lechTruoc}`);
    }

    const lechSau = await demLech(prisma, cau);
    if (lechSau !== 0) {
      throw new Error(`${bang}: nạp xong vẫn còn ${lechSau} dòng lệch.`);
    }
    ketQua.push({ bang, lechTruoc, daNap, lechSau });
  }

  console.log(
    ghiThat
      ? '\nĐã nạp xong, còn 0 dòng lệch.'
      : '\nCHẠY THỬ — chưa ghi gì. Thêm --that để nạp.',
  );
  return ketQua;
}

if (require.main === module) {
  const ghiThat = process.argv.includes('--that');
  // Prisma 7 bỏ trình điều khiển dựng sẵn: `new PrismaClient()` trần ném ngay lúc dựng.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  napCotBongTimKiem(prisma, ghiThat)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => void prisma.$disconnect());
}
