/**
 * Sửa hướng xử lý của đơn thư có ô "Đơn vị giải quyết" là CÂU Trả đơn/Lưu đơn.
 *
 * Vì sao cần: migration `20260909150000_huong_xu_ly_don` suy hướng CHỈ từ trạng thái. Hệ cũ không
 * có ô hướng — trả đơn / lưu đơn thì cán bộ gõ luôn câu vào ô đơn vị, còn trạng thái vẫn là "mới
 * tiếp nhận". Đo 13/09/2026: ~1.540 đơn thư như thế mang Giao đơn.
 *
 * Luật là `huongTheoNoiDungDonVi` — CÙNG hàm bộ nạp hệ cũ dùng. Không viết lại bằng SQL: hai bản
 * luật ở hai nơi là trôi khỏi nhau.
 *
 * Chỉ đụng hồ sơ đang Giao đơn hoặc trống hướng. KHÔNG đổi trạng thái: trạng thái là kết quả đợt
 * suy trạng thái đã duyệt, còn thứ in sai là câu đề xuất — chỉ phụ thuộc hướng.
 *
 * Ghi bằng SQL thô để KHÔNG đẩy `updatedAt` của hàng nghìn hồ sơ, giống migration backfill gốc —
 * nếu không, danh sách "sửa gần đây" ngập hồ sơ không ai động vào.
 *
 * Dùng:
 *   set -a && source .env && set +a
 *   node dist/src/legacy-migration/cli/suy-huong-theo-noi-dung-don-vi.js          # chạy thử
 *   node dist/src/legacy-migration/cli/suy-huong-theo-noi-dung-don-vi.js --that   # ghi thật
 *
 * Chạy lại được: lần hai ra 0 hồ sơ.
 */
import { HuongXuLyDon, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { huongTheoNoiDungDonVi } from '../../petitions/huong-xu-ly.rule';

export interface HoSoXet {
  id: string;
  stt: string;
  donViGiaiQuyet: string | null;
  huongXuLy: HuongXuLyDon | null;
}

/** Hồ sơ phải đổi sang Trả đơn/Lưu đơn — hàm thuần, tách khỏi kết nối. */
export function chonHoSoCanDoiHuong(rows: readonly HoSoXet[]): HoSoXet[] {
  return rows.filter(
    (r) =>
      (r.huongXuLy === null || r.huongXuLy === HuongXuLyDon.GIAO_DON) &&
      huongTheoNoiDungDonVi(r.donViGiaiQuyet) === HuongXuLyDon.TRA_LUU_DON,
  );
}

const LO = 500;

export async function suyHuongTheoNoiDungDonVi(prisma: PrismaClient, ghiThat: boolean) {
  const rows = (await prisma.petition.findMany({
    where: {
      deletedAt: null,
      donViGiaiQuyet: { not: null },
      OR: [{ huongXuLy: null }, { huongXuLy: HuongXuLyDon.GIAO_DON }],
    },
    select: { id: true, stt: true, donViGiaiQuyet: true, huongXuLy: true },
  })) as HoSoXet[];

  const doi = chonHoSoCanDoiHuong(rows);

  // In MẪU chứ không chỉ con số: con số không lộ được một nhóm bị bắt nhầm, danh sách thì có.
  const theoCau = new Map<string, number>();
  for (const r of doi) {
    const k = (r.donViGiaiQuyet ?? '').trim();
    theoCau.set(k, (theoCau.get(k) ?? 0) + 1);
  }
  console.log(`Đơn thư đang Giao đơn / trống hướng : ${rows.length}`);
  console.log(`Sẽ đổi sang Trả đơn/Lưu đơn         : ${doi.length}`);
  console.log('\n20 câu nhiều hồ sơ nhất:');
  for (const [cau, n] of [...theoCau.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${String(n).padStart(5)}  ${cau.slice(0, 90)}`);
  }
  console.log('\nMười hồ sơ đầu: ' + doi.slice(0, 10).map((r) => r.stt).join(' '));

  if (!ghiThat) {
    console.log('\nCHẠY THỬ — chưa ghi gì. Thêm --that để ghi thật.');
    return { xet: rows.length, doi: doi.length, daGhi: 0 };
  }

  let daGhi = 0;
  for (let i = 0; i < doi.length; i += LO) {
    const ids = doi.slice(i, i + LO).map((r) => r.id);
    // Điều kiện hướng lặp lại trong câu UPDATE: hồ sơ cán bộ vừa đổi hướng giữa lúc đọc và lúc
    // ghi thì không bị đè.
    daGhi += await prisma.$executeRaw`
      UPDATE petitions SET "huongXuLy" = 'TRA_LUU_DON'::huong_xu_ly_don
      WHERE id = ANY(${ids}::text[])
        AND ("huongXuLy" IS NULL OR "huongXuLy" = 'GIAO_DON'::huong_xu_ly_don)`;
  }
  console.log(`\nĐã đổi ${daGhi} hồ sơ sang Trả đơn/Lưu đơn.`);
  return { xet: rows.length, doi: doi.length, daGhi };
}

if (require.main === module) {
  const ghiThat = process.argv.includes('--that');
  // Prisma 7 bỏ trình điều khiển dựng sẵn: `new PrismaClient()` trần ném ngay lúc dựng.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  suyHuongTheoNoiDungDonVi(prisma, ghiThat)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => void prisma.$disconnect());
}
