/**
 * Đo từng khoá `metadata` đã CẮT khỏi bảng xuất đầy đủ, trên cơ sở dữ liệu THẬT.
 *
 *   --kiem  (mặc định)  khoá đã cắt mà nay CÓ dữ liệu → mã thoát 1
 *   --sinh              in danh sách loại trừ mới để dán vào `cot-xuat-day-du.loai-tru.ts`
 *
 * VÌ SAO PHẢI CÓ. "Rỗng" là sự thật của HÔM NAY. Đo 23/09/2026: 88/88 khoá `legacyExtra` rỗng
 * trên cả 46.741 hồ sơ — chúng là ô của giai đoạn Vụ án/Vụ việc mà một đơn thư chưa chuyển
 * không bao giờ đi tới. Nhưng ngày cán bộ bắt đầu nhập một ô đã cắt, tệp xuất IM LẶNG thiếu cột
 * ấy: tệp vẫn ra, vẫn đủ tiêu đề, chỉ thiếu. Không lỗi nào hiện ra.
 *
 * Nên danh sách loại trừ phải ĐO ĐƯỢC, không phải "lý do viết sẵn" — cùng bài học với danh sách
 * loại trừ cột tìm kiếm (D4, đợt 21/09).
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { TRUONG_FORM_DON_THU } from '../khai-truong-form-don-thu.generated';
import { COT_XUAT_DAY_DU_LOAI_TRU } from '../cot-xuat-day-du.loai-tru';

export interface SoDoKhoa {
  khoaLuu: string;
  soHoSo: number;
}

/** Đếm số hồ sơ có giá trị khác rỗng ở từng khoá `metadata` được hỏi. */
export async function doKhoaMetadata(
  prisma: PrismaClient,
  khoa: readonly string[],
): Promise<SoDoKhoa[]> {
  if (!khoa.length) return [];
  /*
    "Có dữ liệu" phải ĐÚNG BẰNG nghĩa của bộ đọc trong tệp xuất.

    Toán tử #>> trên một mảng JSON cho ra chuỗi "[]" — khác rỗng. Nhưng bộ đọc (docTruong) trả
    v.join(", "), tức CHUỖI RỖNG cho mảng rỗng. Lệch nhau thì một ô chọn-nhiều đã bị xoá trắng
    vẫn làm phép đo báo "có dữ liệu", và cột ấy không bao giờ cắt được dù tệp xuất luôn in ô
    trống. Hai nhánh loại trừ dưới đây kéo phép đo về đúng nghĩa ấy.
  */
  const dong = await prisma.$queryRawUnsafe<{ key: string; n: bigint }[]>(
    `SELECT t.key AS key, count(*) AS n
       FROM petitions p, jsonb_each(p.metadata) t(key, value)
      WHERE p."deletedAt" IS NULL
        AND jsonb_typeof(p.metadata) = 'object'
        AND NOT (jsonb_typeof(t.value) = 'array' AND jsonb_array_length(t.value) = 0)
        AND jsonb_typeof(t.value) <> 'null'
        AND btrim(coalesce(t.value #>> '{}', '')) <> ''
        AND t.key = ANY($1::text[])
      GROUP BY t.key`,
    khoa as string[],
  );
  const dem = new Map(dong.map((d) => [d.key, Number(d.n)]));
  return khoa.map((k) => ({ khoaLuu: k, soHoSo: dem.get(k) ?? 0 }));
}

/** Khoá đã cắt mà NAY có dữ liệu — mỗi dòng là một cột đang im lặng thiếu khỏi tệp xuất. */
export function khoaCatNhamCoDuLieu(soDo: readonly SoDoKhoa[]): SoDoKhoa[] {
  return soDo.filter((d) => d.soHoSo > 0);
}

async function chay(): Promise<void> {
  const adapter = new PrismaPg({
    connectionString:
      process.env['DATABASE_URL'] ??
      'postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public',
  });
  const prisma = new PrismaClient({ adapter });
  try {
    if (process.argv.includes('--sinh')) {
      const moiKhoa = TRUONG_FORM_DON_THU.filter((t) => !t.cot).map((t) => t.khoaLuu);
      const soDo = await doKhoaMetadata(prisma, moiKhoa);
      const tong = await prisma.petition.count({ where: { deletedAt: null } });
      const ngay = new Date().toISOString().slice(0, 10);
      const rong = soDo.filter((d) => d.soHoSo === 0);
      console.log(
        rong
          .map(
            (d) =>
              `  { khoaLuu: '${d.khoaLuu}', lyDo: 'rỗng 0/${tong} hồ sơ', doNgay: '${ngay}' },`,
          )
          .join('\n'),
      );
      console.error(`[sinh] ${rong.length}/${moiKhoa.length} khoá rỗng trên ${tong} hồ sơ.`);
      return;
    }

    const soDo = await doKhoaMetadata(
      prisma,
      COT_XUAT_DAY_DU_LOAI_TRU.map((c) => c.khoaLuu),
    );
    const pham = khoaCatNhamCoDuLieu(soDo);
    if (pham.length) {
      console.error(
        `[kiem-cot-xuat-day-du] ${pham.length} cột ĐÃ CẮT nay CÓ dữ liệu — tệp xuất đang im lặng thiếu:`,
      );
      for (const p of pham) console.error(`  - ${p.khoaLuu}: ${p.soHoSo} hồ sơ`);
      process.exitCode = 1;
      return;
    }
    console.log(
      `[kiem-cot-xuat-day-du] ${COT_XUAT_DAY_DU_LOAI_TRU.length} cột đã cắt, tất cả vẫn rỗng. Đạt.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  chay().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
