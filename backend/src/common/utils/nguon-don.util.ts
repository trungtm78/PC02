import { khoaDonVi } from './chuan-hoa-ten.util';

/** `Directory.type` của danh mục Nguồn đơn/Đơn vị giao. */
export const LOAI_DANH_MUC_NGUON_DON = 'NGUON_DON';

/** Tiền tố mã mục — ô "Tạo mới" trên form và CLI nạp dữ liệu cũ PHẢI dùng chung một dãy mã. */
export const TIEN_TO_MA_NGUON_DON = 'ND';

/**
 * Khoá so trùng của một giá trị Nguồn đơn.
 *
 * Dùng lại nguyên `khoaDonVi`: phần lớn giá trị prod LÀ tên đơn vị ("PC01 Công an TP.HCM",
 * "Công an phường Bàn Cờ"), nên mọi luật gộp tên đơn vị đều đúng ở đây — bỏ dấu (gộp cả NFC
 * lẫn NFD), bỏ tiền tố "BCH"/"Phòng", mở "HCM" thành "Hồ Chí Minh", bỏ dấu câu.
 *
 * Viết một hàm gộp thứ hai cho cùng một lớp dữ liệu là mời hai luật trôi khỏi nhau.
 */
export function khoaNguonDon(giaTri: string | null | undefined): string {
  if (!giaTri) return '';
  return khoaDonVi(giaTri);
}

/**
 * Nguồn đơn có phải "nộp trực tiếp" không.
 *
 * Quyết định hai thứ nhìn thấy được: nhóm thông tin định danh nguyên đơn có tự bung ra không,
 * và Số điện thoại nguyên đơn có bắt buộc không. Người nộp đứng trước mặt thì lấy được số;
 * đơn đến bằng bưu điện thì không, nên ép nhập là ép cán bộ bịa.
 *
 * SUY TỪ TÊN, không đọc cơ sở dữ liệu. Ba lý do:
 *
 * 1. Chạy y hệt ở máy chủ lẫn trình duyệt — một bản cài đặt, nên luật bắt buộc SĐT không thể
 *    lệch giữa hai đầu.
 * 2. Kiểm được ở tầng DTO (đồng bộ), không phải đẩy xuống tầng nghiệp vụ và mất hình lỗi
 *    theo-từng-ô của `ValidationPipe`.
 * 3. Cán bộ tạo nhanh mục "Trực tiếp" thì cờ TỰ CÓ — không ai quên gắn được. Cờ lưu trong
 *    `metadata` thì chỉ cần một mục tạo tay thiếu cờ là luật bắt buộc biến mất im lặng.
 *
 * Prod có "Trực tiếp" (10.656), "trực tiếp" (956) và dạng NFD — tất cả về cùng một khoá.
 */
export function laNguonTrucTiep(ten: string | null | undefined): boolean {
  const khoa = khoaNguonDon(ten);
  if (!khoa) return false;
  // Khớp NGUYÊN CỤM "truc tiep" đứng riêng: "Gián tiếp" không chứa cụm ấy, còn "Nộp trực tiếp
  // tại trụ sở" thì có. Dùng ranh giới từ để không cắt vào giữa chữ.
  return /\btruc tiep\b/.test(khoa);
}
