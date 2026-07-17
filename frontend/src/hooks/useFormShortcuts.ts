import { useShortcut } from './useShortcut';

export interface FormShortcutHandlers {
  /** Lưu hồ sơ (F2). */
  onSave?: () => void;
  /** Hủy / quay lại (Escape). */
  onCancel?: () => void;
  /** Xuất/In chứng từ Word (F4). */
  onExportDocs?: () => void;
  /** Xóa hồ sơ (F3) — chỉ bật khi `canDelete`. */
  onDelete?: () => void;
  /** Cho phép Xóa (thường = chế độ SỬA; form TẠO mới không có gì để xóa). */
  canDelete?: boolean;
}

/**
 * Gắn phím tắt chuẩn cho một FORM nhập liệu (điểm DRY cho Đơn thư / Vụ việc / Vụ án).
 * Đọc binding hiện hành (mặc định F2/Esc/F4/F3) từ registry + override per-user.
 * Mỗi handler là optional — chỉ đăng ký (enabled) khi được truyền.
 */
export function useFormShortcuts({
  onSave,
  onCancel,
  onExportDocs,
  onDelete,
  canDelete = false,
}: FormShortcutHandlers): void {
  useShortcut('save', () => onSave?.(), { enabled: !!onSave });
  useShortcut('cancel', () => onCancel?.(), { enabled: !!onCancel });
  useShortcut('exportDocx', () => onExportDocs?.(), { enabled: !!onExportDocs });
  useShortcut('delete', () => onDelete?.(), { enabled: !!onDelete && canDelete });
}
