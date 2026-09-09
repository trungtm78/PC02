/**
 * hoSoCode.ts — hiển thị mã hồ sơ theo kiểu hệ cũ.
 *
 * Hệ cũ hiện `26-11171`; hệ mới lưu `2026-11171`. Cùng một con số, khác cách rút gọn năm.
 * Cán bộ đọc quen dạng ngắn, nên MÀN HÌNH hiện dạng ngắn — dữ liệu trong cơ sở dữ liệu
 * KHÔNG đổi.
 *
 * Phần TÌM KIẾM (suy ra dạng còn lại) nằm ở MÁY CHỦ — `backend/src/common/utils/
 * ho-so-code.util.ts`. Tìm đúng không được phụ thuộc việc trình duyệt liệt kê đủ các dạng:
 * ứng dụng di động, lệnh gọi API trực tiếp, hay một bản giao diện cũ đều phải tìm ra hồ sơ.
 *
 * Nguyên tắc: chỉ rút gọn thứ CHẮC CHẮN là mã `năm-stt`. Mọi chuỗi khác trả nguyên văn —
 * cắt bừa sẽ tạo ra mã sai mà nhìn vẫn "hợp lệ", loại lỗi khó phát hiện nhất.
 */

/** Năm hồ sơ hợp lý. Ngoài khoảng này gần như chắc chắn là lỗi gõ, đừng rút gọn. */
const NAM_MIN = 1900;
const NAM_MAX = 2100;

/** `2026-11171`, `2025-1-2` — năm bốn chữ số, số thứ tự, hậu tố chống trùng tuỳ chọn. */
const DANG_DAY_DU = /^(\d{4})-(\d+(?:-\d+)*)$/;

/** Mã để HIỂN THỊ: `2026-11171` → `26-11171`. Chuỗi lạ trả nguyên văn. */
export function formatHoSoCode(ma: string | null | undefined): string {
  if (!ma) return '';
  const m = DANG_DAY_DU.exec(ma.trim());
  if (!m) return ma;
  const nam = Number(m[1]);
  if (nam < NAM_MIN || nam > NAM_MAX) return ma;
  return `${String(nam).slice(2)}-${m[2]}`;
}

/**
 * Phần "STT cũ" ghép sau mã hồ sơ, chép NGUYÊN cách hệ cũ viết.
 *
 * `_PC02/Modules/doi_1/templates/doi_1_xem.tpl:44` của hệ cũ:
 *
 *     {$info.stt} {if $info.stt_cu} <em class="text-danger"> -  (STT cũ: {$info.stt_cu})</em>{/if}
 *
 * Giữ đúng chữ và đúng hai khoảng trắng sau dấu gạch — cán bộ đọc quen dạng ấy. Phần in
 * nghiêng màu đỏ do nơi gọi bọc thẻ, hàm này chỉ lo phần chữ.
 *
 * Trả RỖNG khi không có số cũ: một phần ba tới quá nửa hồ sơ không có (đo 09/09/2026 — đơn thư
 * 67%, vụ việc 70%, vụ án 44% mới có). In `(STT cũ: —)` cho tất cả là làm mọi hàng cao thêm
 * mà không nói gì.
 */
export function phanSttCu(sttCu: string | null | undefined): string {
  const gia = sttCu?.trim();
  if (!gia) return '';
  return ` -  (STT cũ: ${gia})`;
}
