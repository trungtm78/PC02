import { useShortcut } from './useShortcut';

export interface ListShortcutHandlers {
  /** Thêm mới (F6) — thường điều hướng tới route .../new. */
  onNew?: () => void;
  /** Làm mới danh sách (Alt+R) — refetch dữ liệu. */
  onRefresh?: () => void;
  /** Xuất Excel (Ctrl+E) — nếu trang có. */
  onExport?: () => void;
  /**
   * Tìm kiếm (Ctrl+K). Mặc định focus ô search của danh sách ([role="searchbox"]).
   * Truyền handler riêng để ghi đè nếu cần.
   */
  onSearch?: () => void;
}

function focusListSearch() {
  document.querySelector<HTMLInputElement>('[role="searchbox"]')?.focus();
}

/**
 * Gắn phím tắt chuẩn cho một trang DANH SÁCH.
 * Mỗi handler optional — chỉ đăng ký khi được truyền (onSearch mặc định focus ô search).
 */
export function useListShortcuts({ onNew, onRefresh, onExport, onSearch }: ListShortcutHandlers): void {
  useShortcut('newRecord', () => onNew?.(), { enabled: !!onNew });
  useShortcut('refreshList', () => onRefresh?.(), { enabled: !!onRefresh });
  useShortcut('export', () => onExport?.(), { enabled: !!onExport });
  useShortcut('search', () => (onSearch ?? focusListSearch)());
}
