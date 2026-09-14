import { createContext, useContext } from 'react';

/**
 * Hợp đồng của popup tạo nhanh mục danh mục — tách khỏi tệp provider vì
 * `react-refresh/only-export-components` cấm tệp component xuất cả hook lẫn context.
 */
export interface QuickCreateDirectoryArgs {
  type: string;
  /** Chữ cán bộ vừa gõ ở ô tìm — điền sẵn để họ không phải gõ lại. */
  tenGoiY?: string;
  nhanTitle?: string;
  /** Gọi sau khi tạo xong (hoặc tìm thấy bản đã có) với TÊN để chọn ngay. */
  onCreated?: (ten: string) => void;
}

export interface QuickCreateDirectoryApi {
  open: (args: QuickCreateDirectoryArgs) => void;
}

export const QuickCreateDirectoryCtx = createContext<QuickCreateDirectoryApi | null>(null);

/**
 * Bản KHÔNG ném lỗi khi chưa có provider — form Đơn thư được dựng trong ca kiểm và trong vài
 * màn không bọc CompositeModalProvider. Ném ở đó là làm trắng màn hình vì một tính năng phụ.
 */
export function useQuickCreateDirectoryModalSafe(): QuickCreateDirectoryApi | null {
  return useContext(QuickCreateDirectoryCtx);
}
