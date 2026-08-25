/**
 * sua-nam-ngay-tiep-nhan.ts — sửa LỖI GÕ NĂM ở ngày tiếp nhận của đơn thư di trú.
 *
 * VẤN ĐỀ: một số đơn thư có ngày tiếp nhận với năm LỚN HƠN năm phát sinh hồ sơ — chuyện
 * không thể xảy ra. Một hồ sơ mở năm 2023 không thể tiếp nhận năm 3023. Đo ngày 25/08/2026
 * trên dữ liệu thật: 16 hồ sơ, năm sai gồm 3023, 2925, 2205, 2203, 2029, 2027, 2026.
 *
 * ĐÂY LÀ LỖI CỦA HỆ CŨ, KHÔNG PHẢI LỖI DI TRÚ: `legacyRaw.ngay_tiep_nhan_nguon_tin` khớp
 * y hệt giá trị đang lưu. Bản di trú trung thực; chính hệ cũ nhập sai.
 *
 * QUY TẮC SỬA — suy từ bằng chứng trong chính bản ghi, KHÔNG phỏng đoán:
 *   • Thay năm bằng `nam` (năm phát sinh hồ sơ), GIỮ NGUYÊN ngày và tháng.
 *   • 5/16 hồ sơ có `ngay_viet_don` TRÙNG ĐÚNG ngày/tháng, chỉ khác năm — bằng chứng trực
 *     tiếp cho thấy đó là lỗi gõ năm.
 *   • Ba chốt an toàn, hồ sơ nào không qua được thì BỎ QUA và báo, không sửa bừa:
 *       1. chỉ đụng hồ sơ có năm ngày nhận > năm hồ sơ;
 *       2. kết quả không được ở tương lai;
 *       3. kết quả không được TRƯỚC ngày viết đơn.
 *
 * KHÔNG MẤT DỮ LIỆU: giá trị gốc vẫn nằm nguyên trong `legacyRaw` và hiện đầy đủ trên bảng
 * "Dữ liệu gốc hệ cũ" của giao diện.
 *
 * KHÔNG đụng hồ sơ chỉ sai THÁNG (năm khớp) — không có bằng chứng nào suy ra tháng đúng;
 * những hồ sơ ấy phải đối chiếu hồ sơ giấy.
 *
 * MẶC ĐỊNH CHỈ ĐỌC; `--apply` mới ghi.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

export interface KetQuaSua {
  stt: string;
  cu: string;
  moi: string | null;
  lyDoBoQua?: string;
}

/** Đọc ngày kiểu `d/m/yyyy` hoặc `dd/mm/yyyy` của hệ cũ. */
export function docNgayHeCu(s: unknown): { ngay: number; thang: number; nam: number } | null {
  if (typeof s !== 'string') return null;
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return { ngay: Number(m[1]), thang: Number(m[2]), nam: Number(m[3]) };
}

/**
 * Tính ngày đã sửa, hoặc lý do bỏ qua. Thuần — không chạm cơ sở dữ liệu.
 *
 * `hienTai` truyền vào thay vì gọi `new Date()` bên trong, để ca kiểm cố định được thời
 * điểm và không đỏ theo ngày chạy.
 */
export function tinhNgayDaSua(
  ngayNhan: Date,
  namHoSo: number,
  ngayVietDon: string | null | undefined,
  hienTai: Date,
): { moi: Date } | { boQua: string } {
  const namNhan = ngayNhan.getUTCFullYear();
  if (!Number.isInteger(namHoSo) || namHoSo < 1900 || namHoSo > 2200) {
    return { boQua: 'năm hồ sơ không hợp lệ' };
  }
  if (namNhan <= namHoSo) return { boQua: 'năm ngày nhận không lớn hơn năm hồ sơ' };

  const moi = new Date(
    Date.UTC(namHoSo, ngayNhan.getUTCMonth(), ngayNhan.getUTCDate(), 0, 0, 0, 0),
  );
  // Ngày/tháng phải giữ nguyên; 29/2 của năm nhuận rơi vào năm thường sẽ trượt sang 1/3.
  if (moi.getUTCDate() !== ngayNhan.getUTCDate() || moi.getUTCMonth() !== ngayNhan.getUTCMonth()) {
    return { boQua: 'đổi năm làm trượt ngày (29/2)' };
  }
  if (moi.getTime() > hienTai.getTime()) return { boQua: 'kết quả vẫn ở tương lai' };

  const vd = docNgayHeCu(ngayVietDon);
  if (vd) {
    const ngayViet = new Date(Date.UTC(vd.nam, vd.thang - 1, vd.ngay));
    if (moi.getTime() < ngayViet.getTime()) {
      return { boQua: 'kết quả TRƯỚC ngày viết đơn' };
    }
  }
  return { moi };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
  });
  const hienTai = new Date();

  console.log(`\n=== Sửa lỗi gõ năm ở ngày tiếp nhận — chế độ: ${apply ? 'GHI THẬT' : 'CHỈ ĐỌC'} ===\n`);

  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; stt: string; receivedDate: Date; nam: string; ngayVietDon: string | null }>
    >`
      SELECT id, stt, "receivedDate",
             "legacyRaw"->>'nam' AS nam,
             "legacyRaw"->>'ngay_viet_don' AS "ngayVietDon"
        FROM petitions
       WHERE "deletedAt" IS NULL
         AND "legacyRaw"->>'nam' ~ '^[0-9]{4}$'
         AND EXTRACT(YEAR FROM "receivedDate") > ("legacyRaw"->>'nam')::int
       ORDER BY "receivedDate" DESC`;

    console.log(`Hồ sơ có năm ngày nhận LỚN HƠN năm hồ sơ: ${rows.length}\n`);
    if (!rows.length) {
      console.log('>>> KHÔNG CÓ HỒ SƠ NÀO CẦN SỬA.');
      return;
    }

    const ketQua: KetQuaSua[] = [];
    let daSua = 0;

    console.log('Mã hồ sơ'.padEnd(14), 'Đang lưu'.padEnd(12), '→', 'Sửa thành'.padEnd(12), 'Ghi chú');
    console.log('-'.repeat(70));

    for (const r of rows) {
      const kq = tinhNgayDaSua(r.receivedDate, Number(r.nam), r.ngayVietDon, hienTai);
      const cu = r.receivedDate.toISOString().slice(0, 10);
      if ('boQua' in kq) {
        ketQua.push({ stt: r.stt, cu, moi: null, lyDoBoQua: kq.boQua });
        console.log(r.stt.padEnd(14), cu.padEnd(12), '→', 'BỎ QUA'.padEnd(12), kq.boQua);
        continue;
      }
      const moi = kq.moi.toISOString().slice(0, 10);
      ketQua.push({ stt: r.stt, cu, moi });
      console.log(r.stt.padEnd(14), cu.padEnd(12), '→', moi.padEnd(12), `(năm hồ sơ ${r.nam})`);
      if (apply) {
        await prisma.petition.update({ where: { id: r.id }, data: { receivedDate: kq.moi } });
        daSua++;
      }
    }

    const boQua = ketQua.filter((k) => k.moi === null);
    console.log(`\nSẽ sửa: ${ketQua.length - boQua.length} · Bỏ qua: ${boQua.length}`);
    if (apply) console.log(`\n>>> ĐÃ SỬA ${daSua} hồ sơ. Giá trị gốc vẫn còn nguyên trong legacyRaw.`);
    else console.log('\n(CHỈ ĐỌC — chưa ghi gì. Thêm --apply để thực thi.)');
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
