/** Loại thực thể gắn template chứng từ. */
export const ENTITY_TYPES = ['VU_VIEC', 'VU_AN', 'DON_THU'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

/** Danh mục mẫu chứng từ (nhóm hiển thị trong popup xuất file). */
export const TEMPLATE_CATEGORIES = [
  'Quyết định',
  'Biên bản',
  'Lệnh',
  'Thông báo',
  'Giấy chứng nhận',
  'Kết luận',
  'Khác',
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

/** Định dạng template hỗ trợ (vòng này chỉ DOCX; XLSX/PDF mở dần qua renderer/converter). */
export const SUPPORTED_FORMATS = ['DOCX'] as const;
export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

/**
 * VÒNG ĐỜI mẫu chứng từ.
 *
 * ── Vì sao có ──
 *
 * Ngày 28/08/2026 một đợt kiểm bảo mật để lại ba mẫu `TPL_MALICIOUS` / `TPL_XXE` /
 * `TPL_NORMAL_baseline` trên MÁY THẬT. Chúng ở `active` nên hiện thẳng trong popup In chứng từ
 * của mọi cán bộ ở màn Vụ việc.
 *
 * Gốc rễ không phải ba hàng rác ấy, mà là mẫu vừa tải lên đã thành `active` NGAY — không có bước
 * nào giữa "một người tải tệp lên" và "toàn bộ cán bộ nhìn thấy nó".
 *
 * ── Ba trạng thái ──
 *
 *  • `draft`    — nháp: chỉ quản trị thấy, đang soạn/đang duyệt. Mọi mẫu mới tải lên vào đây.
 *  • `active`   — đã ban hành: cán bộ thấy và in được.
 *  • `archived` — đã thu hồi: nghỉ hưu mà KHÔNG xoá, vì lịch sử in đã phát hành vẫn phải tra
 *                 được và mẫu có thể cần ban hành lại.
 *
 * Popup in vốn đã lọc `status: 'active'`, nên nháp và đã-thu-hồi tự động vô hình — không phải
 * sửa dòng nào ở đường in.
 */
export const TRANG_THAI_MAU = ['draft', 'active', 'archived'] as const;
export type TrangThaiMau = (typeof TRANG_THAI_MAU)[number];

/** Tải lên là NHÁP, không phải phát hành. Đây là dòng chặn cả lớp sự cố 28/08. */
export const TRANG_THAI_MAC_DINH_KHI_TAO: TrangThaiMau = 'draft';

/**
 * Chuyển được từ trạng thái này sang trạng thái kia không.
 *
 * Mọi cặp KHÁC NHAU giữa ba trạng thái đều hợp lệ — nghỉ hưu một mẫu phải hoàn tác được, và một
 * bản nháp bỏ dở cũng cần đường thu hồi. Chỉ chặn chuyển sang CHÍNH NÓ: đó là thao tác thừa, và
 * cho qua thì nhật ký đầy bản ghi không nói lên điều gì.
 */
export function chuyenDuocSang(tu: string, sang: string): boolean {
  const hopLe = (v: string): v is TrangThaiMau => (TRANG_THAI_MAU as readonly string[]).includes(v);
  if (!hopLe(tu) || !hopLe(sang)) return false;
  return tu !== sang;
}
