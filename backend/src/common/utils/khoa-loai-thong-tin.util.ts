import { LoaiDon } from '@prisma/client';
import { boDauTiengViet } from './chuan-hoa-ten.util';

/**
 * Luật gộp của ô "Loại thông tin" — MỘT nơi cho cả ba đường dùng: bộ nạp danh mục từ dữ liệu cũ,
 * ô "Tạo mới" trên form (chặn tạo trùng), và bộ nạp hệ cũ khi đổ hồ sơ mới vào.
 *
 * Hệ cũ không có danh mục loại thông tin — cán bộ gõ tay, nên cùng một loại có nhiều cách viết.
 * Đo trên bản sao dữ liệu thật 27/08/2026: 735 giá trị khác nhau, 624 sau khi bỏ hoa/thường.
 */

/** `Directory.type` của danh mục Loại thông tin. */
export const LOAI_DANH_MUC_LOAI_THONG_TIN = 'LOAI_THONG_TIN';

/** Tiền tố mã mục — ô "Tạo mới" trên form và CLI nạp dữ liệu cũ PHẢI dùng chung một dãy mã. */
export const TIEN_TO_MA_LOAI_THONG_TIN = 'LTT';

/** Hậu tố đếm số đơn đứng cuối: "Tố giác (02 đơn)" → "Tố giác". */
const HAU_TO_DEM_DON = /\s*\(\s*\d+\s*don\s*\)\s*$/;

/** Viết tắt trong ngoặc mà dữ liệu thật dùng song song bản đầy đủ. Khớp nguyên từ, không cắt giữa chữ. */
const VIET_TAT: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bqd\b/g, 'quyet dinh'],
  [/\bhv\b/g, 'hanh vi'],
];

/** Dấu câu thừa ở cuối: "Lưu đơn." → "Lưu đơn". */
const DAU_CAU_CUOI = /[.,;:]+$/;

/**
 * Khoá so trùng của một giá trị Loại thông tin.
 *
 * Bỏ dấu tiếng Việt (gộp cả chuỗi dựng sẵn lẫn tổ hợp, NBSP), bỏ hậu tố đếm đơn, mở viết tắt
 * `QĐ`/`HV`, bỏ dấu câu cuối. KHÔNG gộp giá trị ghép ("Tố giác, Đề nghị") vào từng loại — hồ sơ
 * ấy thật sự mang cả hai.
 */
export function khoaLoaiThongTin(giaTri: string | null | undefined): string {
  if (!giaTri) return '';
  let khoa = boDauTiengViet(giaTri).replace(HAU_TO_DEM_DON, '');
  for (const [mau, day] of VIET_TAT) khoa = khoa.replace(mau, day);
  return khoa.replace(DAU_CAU_CUOI, '').replace(/\s+/g, ' ').trim();
}

/** Tiền tố khoá quyết định nhóm hạn. Loại không khớp tiền tố nào dùng hạn Phản ánh. */
const TIEN_TO_NHOM_HAN: ReadonlyArray<readonly [string, LoaiDon]> = [
  ['to cao', LoaiDon.TO_CAO],
  ['khieu nai', LoaiDon.KHIEU_NAI],
  ['kien nghi', LoaiDon.KIEN_NGHI],
];

/** "Đơn tố cáo" là "Tố cáo" — chữ "Đơn" đứng đầu không đổi loại. */
const TIEN_TO_DON = /^don /;

const KY_TU_CUA_TU = /[a-z0-9]/;

/**
 * Nhóm hạn gán SẴN cho một loại theo tên — giá trị khởi điểm của `metadata.nhomHan` trong danh mục,
 * cán bộ quản trị sửa được sau.
 *
 * Tiền tố phải là NGUYÊN từ: "Tố cáo/khiếu nại" khớp Tố cáo (dấu "/" là ranh giới), "Tố cáoo" thì
 * không. Mặc định `PHAN_ANH` vì đó đúng là nhánh cuối của khối tự tính hạn khi hồ sơ không mang
 * loại đơn.
 */
export function nhomHanTheoTen(ten: string | null | undefined): LoaiDon {
  const khoa = khoaLoaiThongTin(ten).replace(TIEN_TO_DON, '');
  for (const [tienTo, nhom] of TIEN_TO_NHOM_HAN) {
    if (
      khoa.startsWith(tienTo) &&
      !KY_TU_CUA_TU.test(khoa.charAt(tienTo.length))
    )
      return nhom;
  }
  return LoaiDon.PHAN_ANH;
}

/** Tên hiển thị của mục danh mục: gộp khoảng trắng, viết hoa chữ đầu, giữ nguyên phần còn lại. */
export function vietHoaChuDau(ten: string): string {
  const gon = ten.replace(/\s+/g, ' ').trim();
  if (!gon) return '';
  return gon.charAt(0).toLocaleUpperCase('vi') + gon.slice(1);
}
