/**
 * Nguồn đơn có phải "nộp trực tiếp" không — BẢN TRÌNH DUYỆT.
 *
 * Bản máy chủ: `backend/src/common/utils/nguon-don.util.ts` (`laNguonTrucTiep`).
 *
 * Hai bản phải cho cùng kết quả: luật này quyết định nhóm thông tin định danh có tự bung
 * không, và Số điện thoại nguyên đơn có bắt buộc không. Lệch nhau nghĩa là form cho Lưu còn
 * máy chủ trả 400 — hoặc ngược lại, form chặn thứ máy chủ nhận.
 *
 * Cả hai đầu chấm chính mình trên `truc-tiep.corpus.json`. Bên nào trôi thì cổng bên ấy đỏ.
 */

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
const DONG_TU_TIEP_NHAN = /\b(nop|den|gui|trao|mang|dua|tiep nhan|tiep dan|tiep cong dan)\b/;

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
