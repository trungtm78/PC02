/** `Directory.type` của danh mục Nguồn đơn/Đơn vị giao. */
export const LOAI_DANH_MUC_NGUON_DON = 'NGUON_DON';

/** Tiền tố mã mục — ô "Tạo mới" trên form và CLI nạp dữ liệu cũ PHẢI dùng chung một dãy mã. */
export const TIEN_TO_MA_NGUON_DON = 'ND';

/**
 * Bỏ dấu, hạ chữ thường, đổi dấu câu thành khoảng trắng, gom khoảng trắng.
 *
 * KHÔNG bỏ tiền tố "phòng"/"bch" như khoá tên ĐƠN VỊ: ở đây "Phòng 1" và "Phòng 2" phải khác
 * nhau (bỏ tiền tố là còn "1" và "2", va vào mọi chuỗi gõ nhầm chỉ có số), và "Phòng chống tệ
 * nạn xã hội" bị cắt mất nửa từ ghép "phòng chống".
 */
function khoa(ten: string): string {
  return ten
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\bhcm\b/g, 'ho chi minh')
    .replace(/[.,;:()\-/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Phủ định: "Không trực tiếp", "Gián tiếp qua bưu điện" — loại TRƯỚC mọi luật nhận. */
const PHU_DINH = /\b(khong|gian tiep)\b/;

/** Chính nó đã là một kênh tiếp nhận, không cần cụm "trực tiếp". */
const KENH_TIEP_NHAN = /\b(nop tai tru so|tiep dan|tiep cong dan)\b/;

/** Động từ tiếp nhận cùng chuỗi — dấu hiệu "trực tiếp" nói về CÁCH NHẬN, không phải trạng từ. */
const DONG_TU_TIEP_NHAN =
  /\b(nop|den|gui|trao|mang|dua|tiep nhan|tiep dan|tiep cong dan)\b/;

/**
 * Nguồn đơn có phải "nộp trực tiếp" không.
 *
 * Cờ này BẬT luật bắt buộc Số điện thoại nguyên đơn, nên luật cố ý BẢO THỦ: nhận nhầm nghĩa
 * là cán bộ mở một đơn cũ và KHÔNG LƯU ĐƯỢC vì một ô không có dữ liệu để điền. Nhận sót chỉ
 * làm nhóm không tự bung và SĐT không bắt buộc — nhẹ hơn hẳn.
 *
 * Vì thế KHÔNG khớp bừa cụm "trực tiếp": trong dữ liệu thật nó hay đứng ở vai TRẠNG TỪ
 * ("Đơn vị trực tiếp thụ lý", "Giám đốc trực tiếp chỉ đạo") và trong câu PHỦ ĐỊNH
 * ("Không trực tiếp"). Chỉ nhận khi:
 *   1. cả chuỗi đúng là "trực tiếp", hoặc
 *   2. chuỗi là một kênh tiếp nhận đã biết, hoặc
 *   3. có cụm "trực tiếp" VÀ một động từ tiếp nhận trong cùng chuỗi.
 */
export function laNguonTrucTiep(ten: string | null | undefined): boolean {
  if (!ten) return false;
  const k = khoa(ten);
  if (!k || PHU_DINH.test(k)) return false;
  if (k === 'truc tiep') return true;
  if (KENH_TIEP_NHAN.test(k)) return true;
  return /\btruc tiep\b/.test(k) && DONG_TU_TIEP_NHAN.test(k);
}

/**
 * Khoá so trùng của một giá trị Nguồn đơn.
 *
 * Dùng CHUNG hàm chuẩn hoá với `laNguonTrucTiep` để hai luật không trôi khỏi nhau.
 *
 * KHÔNG dùng `khoaDonVi`: hàm ấy bỏ tiền tố "phòng"/"bch" theo ngữ pháp TÊN ĐƠN VỊ. Ở đây
 * điều đó sai và sai nguy hiểm — đo trên chính hàm ấy: "Phòng 1" → "1" và "Phòng 2" → "2"
 * (khoá rút còn một chữ số, va vào mọi chuỗi gõ nhầm chỉ có số trong 1.431 cách viết),
 * "Phòng Tiếp công dân" → "tiep cong dan" (gộp một ĐƠN VỊ với một KÊNH tiếp nhận),
 * "Phòng chống tệ nạn xã hội" → "chong te nan xa hoi" (cắt mất nửa từ ghép "phòng chống").
 */
export function khoaNguonDon(giaTri: string | null | undefined): string {
  if (!giaTri) return '';
  return khoa(giaTri);
}
