import { useCallback, useMemo, useState, type ReactNode } from 'react';
import DynamicExportDocumentsModal from '@/features/document-templates/components/DynamicExportDocumentsModal';
import { PrintDocumentsModalContext, type PrintDocumentsModalApi, type PrintDocumentsModalArgs } from './PrintDocumentsModalContext';
export type { PrintDocumentsModalApi, PrintDocumentsModalArgs } from './PrintDocumentsModalContext';

/**
 * Modal "In chứng từ" dùng chung, mở được từ BẤT KỲ ĐÂU — trước hết là từ một dòng danh sách.
 *
 * Anh báo 09/09/2026: ba màn danh sách không có nút In, muốn in phải mở hồ sơ ra rồi mới bấm
 * được — ba lần bấm cho việc cán bộ làm liên tục.
 *
 * Dùng lại đúng `DynamicExportDocumentsModal` của màn sửa, KHÔNG dựng màn in thứ hai. Mở được
 * từ danh sách vì modal ấy chỉ cần `{entity, entityId}` rồi tự gọi API lấy phần còn lại — kể cả
 * `updatedAt`; nó không đọc trạng thái form.
 *
 * Khuôn provider singleton chép từ `AssignModalProvider`: một thể hiện duy nhất ở gốc cây, mở
 * bằng lời gọi hàm. Gắn modal vào từng dòng là dựng lại nó vài chục lần trên mỗi trang.
 */
export function PrintDocumentsModalProvider({ children }: { children: ReactNode }) {
  const [args, setArgs] = useState<PrintDocumentsModalArgs | null>(null);

  const open = useCallback((next: PrintDocumentsModalArgs) => setArgs(next), []);
  const close = useCallback(() => setArgs(null), []);

  const api = useMemo<PrintDocumentsModalApi>(() => ({ open }), [open]);

  return (
    <PrintDocumentsModalContext.Provider value={api}>
      {children}
      {args && (
        <DynamicExportDocumentsModal
          entity={args.entity}
          entityId={args.entityId}
          onClose={close}
          onEntityPatched={args.onPatched ? () => args.onPatched?.() : undefined}
        />
      )}
    </PrintDocumentsModalContext.Provider>
  );
}
