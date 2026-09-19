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
 * Câu SQL sinh từ CÙNG khối trigger đã gộp theo bảng (`sinhCacCauNap`), chỉ SET cột bóng (không đẩy
 * `updatedAt`, không kích trigger). Chỉ ghi dòng lệch nên chạy lại ra 0 ghi.
 *
 * Dùng:
 *   set -a && source .env && set +a
 *   node dist/src/common/tim-kiem/cli/nap-cot-bong-tim-kiem.js          # chạy thử: đếm dòng lệch
 *   node dist/src/common/tim-kiem/cli/nap-cot-bong-tim-kiem.js --that   # nạp thật
 *   node dist/src/common/tim-kiem/cli/nap-cot-bong-tim-kiem.js --kiem   # deploy.sh: còn dòng chưa nạp → thoát 2
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { KHAI_TIM_KIEM } from '../khai';
import { sinhCacCauNap, type CauNap } from '../sinh/sinh-tim-kiem';

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
  // Mỗi bảng MỘT lần, cùng biểu thức với trigger (khối đã gộp theo bảng).
  const viec: Array<{ bang: string; cau: CauNap }> =
    sinhCacCauNap(KHAI_TIM_KIEM);

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

/**
 * Kiểm lúc deploy: bảng nào còn dòng CHƯA TỪNG nạp (cột bóng NULL). Chỉ đọc.
 *
 * Không dùng câu `dem`: nó tính lại f_bo_dau trên mọi dòng — đo prod 19/09/2026 mất 1 phút 47 giây cho
 * 15 bảng, tải nặng lên CSDL ở MỖI lần deploy. Deploy chỉ cần bắt đúng lớp hỏng migration để lại (cột mới
 * NULL cho dữ liệu cũ); lệch do sửa tay biểu thức thì vẫn có bản chạy thử đầy đủ để đo.
 */
export async function kiemCotBongChuaNap(prisma: PrismaNap): Promise<string[]> {
  const conThieu: string[] = [];
  for (const { bang, cau } of sinhCacCauNap(KHAI_TIM_KIEM)) {
    const [dong] = await prisma.$queryRawUnsafe<Array<{ co: boolean }>>(
      cau.chuaNap,
    );
    const co = dong?.co === true;
    console.log(`${bang}: ${co ? 'CÒN dòng chưa nạp cột bóng' : 'đã nạp đủ'}`);
    if (co) conThieu.push(bang);
  }
  return conThieu;
}

/** 2 = còn bảng chưa nạp (deploy.sh báo đỏ); khác với 1 = lỗi chạy. */
export function maThoatKiem(conThieu: readonly string[]): number {
  return conThieu.length > 0 ? 2 : 0;
}

if (require.main === module) {
  const ghiThat = process.argv.includes('--that');
  // Prisma 7 bỏ trình điều khiển dựng sẵn: `new PrismaClient()` trần ném ngay lúc dựng.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  const viec: Promise<unknown> = process.argv.includes('--kiem')
    ? kiemCotBongChuaNap(prisma).then((conThieu) => {
        process.exitCode = maThoatKiem(conThieu);
      })
    : napCotBongTimKiem(prisma, ghiThat);
  viec
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => void prisma.$disconnect());
}
