/**
 * Ca kiểm VÀNG bỏ dấu: `boDauTimKiem` (JS — dựng điều kiện thẻ) phải ra ĐÚNG chuỗi `f_bo_dau` (SQL —
 * giữ cột bóng) trên PostgreSQL THẬT của môi trường đang chạy. Lệch một ký tự là thẻ trả thiếu hồ sơ
 * mà không ca kiểm đơn vị nào thấy (đo 15/09/2026: `unaccent.rules` PG16 prod khác PG18 local).
 *
 * CHỈ ĐỌC: hàm dựng trong `pg_temp` của MỘT giao dịch, mất khi giao dịch xong — chạy trên prod được.
 *
 * Dùng (có DATABASE_URL):
 *   npm run kiem:vang-bo-dau                          # bộ tổng hợp: mọi mục bảng ánh xạ + câu khó
 *   npm run kiem:vang-bo-dau -- --chuoi-that          # + chuỗi thật trong đơn thư
 *   node dist/src/common/tim-kiem/cli/kiem-vang-bo-dau.js --chuoi-that    # trên máy chủ
 *
 * Mã thoát: 0 khớp hết · 1 có lệch (in tối đa 10 mẫu) · 2 tham số sai.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  BANG_MOT_KY_TU,
  BANG_NHIEU_KY_TU,
  boDauTimKiem,
  sinhHamFBoDau,
} from '../bo-dau';

export interface TxVang {
  $executeRawUnsafe(sql: string): Promise<number>;
  $queryRawUnsafe(sql: string, ...values: unknown[]): Promise<unknown>;
}

export interface PrismaVang {
  $transaction<R>(
    fn: (tx: TxVang) => Promise<R>,
    opts?: { timeout?: number; maxWait?: number },
  ): Promise<R>;
}

const NBSP = String.fromCharCode(0xa0);
const KHOANG_TRANG_CJK = String.fromCharCode(0x3000);

/** Mọi mục bảng ánh xạ (kẹp giữa chữ thường) + các câu khó gặp trong dữ liệu thật. */
export function boTongHopVang(): string[] {
  const ra: string[] = [];
  for (const k of BANG_MOT_KY_TU.keys()) ra.push(`A${k}b`);
  for (const [k] of BANG_NHIEU_KY_TU) ra.push(`x${k}y`);
  return ra.concat([
    'Nguyễn  Văn Á',
    'ĐỖ THỊ HỒNG',
    'vụ “Lừa đảo chiếm đoạt tài sản”',
    'Ngày 12/09 – 15/09',
    'tố giác…',
    'ông Nguyễn’s',
    '50m² và ¾ căn',
    'Khiếu nại (QĐ tố tụng)',
    `  Trần${NBSP}Văn${KHOANG_TRANG_CJK}Bình\t`,
    'Nguyễn Thị Ánh Tuyết, Đường Hồ Chí Minh'.normalize('NFD'),
    'Ưu Ơn Ăn Ẩn Ỷ Ỵ',
    "O'Brien 100%_x\\y",
  ]);
}

/** Cùng thân với migration, chỉ đổi chỗ nằm sang `pg_temp` — không để lại gì trên CSDL. */
export function sinhHamVangTam(): string {
  return sinhHamFBoDau().replace('public.f_bo_dau', 'pg_temp.f_bo_dau');
}

export interface KetQuaSoVang {
  so: number;
  lech: number;
  mau: Array<{ v: string; js: string; sql: string }>;
}

export function soSanhVang(
  cap: ReadonlyArray<readonly [string, string]>,
): KetQuaSoVang {
  const kq: KetQuaSoVang = { so: cap.length, lech: 0, mau: [] };
  for (const [v, sql] of cap) {
    const js = boDauTimKiem(v);
    if (js === sql) continue;
    kq.lech++;
    if (kq.mau.length < 10) kq.mau.push({ v, js, sql });
  }
  return kq;
}

const CAU_TONG_HOP =
  'SELECT i::int AS i, pg_temp.f_bo_dau(v) AS s FROM unnest($1::text[]) WITH ORDINALITY AS t(v, i) ORDER BY i';

/** Các cột chữ nhiều biến thể nhất của đơn thư — 200–300 ký tự đầu là đủ phủ bảng ký tự. */
const CAU_CHUOI_THAT = `SELECT v, pg_temp.f_bo_dau(v) AS s FROM (
  SELECT DISTINCT "senderName" AS v FROM "petitions"
  UNION SELECT DISTINCT "senderAddress" FROM "petitions"
  UNION SELECT DISTINCT "loaiThongTin" FROM "petitions"
  UNION SELECT DISTINCT "donViGiaiQuyet" FROM "petitions"
  UNION SELECT DISTINCT left("summary", 300) FROM "petitions"
  UNION SELECT DISTINCT left("detailContent", 300) FROM "petitions"
) t WHERE v IS NOT NULL`;

const THAM_SO_HOP_LE = new Set(['--chuoi-that']);

export async function chayKiemVang(
  argv: readonly string[],
  prisma: PrismaVang,
): Promise<number> {
  const la = argv.filter((a) => !THAM_SO_HOP_LE.has(a));
  if (la.length > 0) {
    console.error(`Tham số lạ: ${la.join(' ')} — chỉ nhận --chuoi-that`);
    return 2;
  }
  const chuoiThat = argv.includes('--chuoi-that');
  const tongHop = boTongHopVang();

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(sinhHamVangTam());
      const [phienBan] = (await tx.$queryRawUnsafe(
        'SELECT version() AS v',
      )) as Array<{ v: string }>;
      console.log(phienBan?.v.split(',')[0]);

      let lech = 0;
      const bao = (ten: string, cap: Array<[string, string]>) => {
        const kq = soSanhVang(cap);
        console.log(`${ten}: ${kq.so} chuỗi · lệch ${kq.lech}`);
        for (const m of kq.mau) console.log(`  ${JSON.stringify(m)}`);
        lech += kq.lech;
      };

      const dong = (await tx.$queryRawUnsafe(CAU_TONG_HOP, tongHop)) as Array<{
        i: number;
        s: string;
      }>;
      if (dong.length !== tongHop.length) {
        throw new Error(`Thiếu kết quả: ${dong.length}/${tongHop.length}`);
      }
      bao(
        'Bộ tổng hợp',
        dong.map((d) => [tongHop[Number(d.i) - 1], d.s]),
      );

      if (chuoiThat) {
        const that = (await tx.$queryRawUnsafe(CAU_CHUOI_THAT)) as Array<{
          v: string;
          s: string;
        }>;
        bao(
          'Chuỗi thật (đơn thư)',
          that.map((d) => [d.v, d.s]),
        );
      }
      return lech > 0 ? 1 : 0;
    },
    // 100k chuỗi thật chạy vài chục giây — mặc định 5 s của giao dịch tương tác là không đủ.
    { timeout: 10 * 60_000, maxWait: 10_000 },
  );
}

if (require.main === module) {
  // Prisma 7 bỏ trình điều khiển dựng sẵn: `new PrismaClient()` trần ném ngay lúc dựng.
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  chayKiemVang(process.argv.slice(2), prisma as unknown as PrismaVang)
    .then((ma) => {
      process.exitCode = ma;
    })
    .catch((e: unknown) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => void prisma.$disconnect());
}
