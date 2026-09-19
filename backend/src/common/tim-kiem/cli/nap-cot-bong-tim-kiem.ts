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

async function co(prisma: PrismaNap, sql: string): Promise<boolean> {
  const [dong] = await prisma.$queryRawUnsafe<Array<{ co: boolean }>>(sql);
  return dong?.co === true;
}

/**
 * Kiểm lúc deploy: bảng nào cột bóng chưa đúng. Chỉ đọc. Hai câu rẻ thay cho câu `dem` (đo prod 19/09/2026:
 * `dem` tính lại f_bo_dau trên mọi dòng, 1 phút 47 giây cho 15 bảng — tải nặng ở MỖI lần deploy; hai câu
 * này ~2 giây):
 *  - `chuaNap`: còn cột bóng NULL ở bất kỳ dòng nào (migration thêm cột mới, dữ liệu cũ chưa nạp);
 *  - `lechMau`: 200 dòng cũ nhất lệch biểu thức hiện hành (biểu thức cột ĐÃ CÓ đổi mà chưa nạp lại).
 */
export async function kiemCotBongChuaNap(prisma: PrismaNap): Promise<string[]> {
  const conThieu: string[] = [];
  for (const { bang, cau } of sinhCacCauNap(KHAI_TIM_KIEM)) {
    const rong = await co(prisma, cau.chuaNap);
    const lechMau = await co(prisma, cau.lechMau);
    const lyDo = [
      rong && 'còn cột bóng NULL',
      lechMau && 'dòng cũ lệch biểu thức hiện hành',
    ].filter(Boolean);
    console.log(
      `${bang}: ${lyDo.length ? `CẦN NẠP — ${lyDo.join('; ')}` : 'đúng'}`,
    );
    if (lyDo.length) conThieu.push(bang);
  }
  return conThieu;
}

/** 2 = còn bảng cần nạp (deploy.sh báo đỏ); khác với 1 = lỗi chạy. */
export function maThoatKiem(conThieu: readonly string[]): number {
  return conThieu.length > 0 ? 2 : 0;
}

/**
 * Nối dây dòng lệnh — tách khỏi `require.main` để kiểm được: `--kiem` → 0/2; không cờ → chạy thử; `--that`
 * → nạp thật; lỗi → 1 (không bao giờ 0). Kết nối LUÔN đóng, và đóng lỗi không đổi mã của việc chính.
 */
export async function chayCli(
  argv: readonly string[],
  prisma: PrismaNap & { $disconnect(): Promise<void> },
): Promise<number> {
  try {
    if (argv.includes('--kiem'))
      return maThoatKiem(await kiemCotBongChuaNap(prisma));
    await napCotBongTimKiem(prisma, argv.includes('--that'));
    return 0;
  } catch (e) {
    console.error(e);
    return 1;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

if (require.main === module) {
  // Prisma 7 bỏ trình điều khiển dựng sẵn: `new PrismaClient()` trần ném ngay lúc dựng.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  void chayCli(process.argv, prisma).then((ma) => {
    process.exitCode = ma;
  });
}
