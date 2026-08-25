import type { UseBulkSelectionResult } from './useBulkSelection';
import { TABLE_HEADER_STICKY_BG } from '@/constants/styles';

/**
 * v0.48 PR1 F2 — Checkbox column helper cho list pages.
 *
 * List pages PC02 KHÔNG dùng shared DataTable (chỉ `tabs.tsx` dùng) — mỗi page roll
 * own `<table>`. Helper này export 2 sub-component để insert vào `<thead><tr>` +
 * `<tbody><tr>` của bất cứ table nào.
 *
 * A11y (plan v2 D-C2):
 * - native input[type=checkbox] (no custom).
 * - aria-checked="mixed" cho indeterminate header.
 * - aria-label per row.
 * - Header checkbox có aria-live="polite" qua wrapper trong BulkActionBar (count text).
 */

interface HeaderProps {
  selection: UseBulkSelectionResult;
  totalRowsLabel?: string; // "vụ án" / "vụ việc" / "đơn thư"
}

export function BulkSelectionHeaderCell({ selection, totalRowsLabel }: HeaderProps) {
  return (
    <th className={`w-10 px-2 py-2 text-left sticky left-0 z-[1] ${TABLE_HEADER_STICKY_BG}`}>
      <input
        type="checkbox"
        aria-label={`Chọn tất cả ${totalRowsLabel ?? 'bản ghi'} trong trang`}
        checked={selection.pageState === 'all'}
        ref={(el) => {
          if (el) el.indeterminate = selection.pageState === 'some';
        }}
        onChange={selection.togglePage}
        className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
    </th>
  );
}

interface RowProps {
  id: string;
  selection: UseBulkSelectionResult;
  /** Optional eligibility check — disable + tooltip lý do (vd "Chỉ xóa được khi giai đoạn Tiếp nhận"). */
  ineligibleReason?: string | null;
  rowLabel?: string; // "vụ án {caseCode}" — dùng cho aria-label
  /**
   * Lớp nền THẬT của hàng chứa ô này.
   *
   * Ô ghim buộc phải có nền đục, nếu không nội dung cuộn ngang hiện xuyên qua. Nhưng đặt
   * cứng `bg-white` như trước thì trên hàng đang chọn (nền xanh) hay hàng quá hạn (nền cảnh
   * báo), ô ghim thành một vệt trắng lệch màu ngay mép trái. `Table` đã tính sẵn nền của
   * từng hàng nên truyền xuống đây thay vì đoán.
   */
  bgClass?: string;
}

export function BulkSelectionRowCell({
  id,
  selection,
  ineligibleReason,
  rowLabel,
  bgClass = 'bg-white',
}: RowProps) {
  const disabled = ineligibleReason != null;
  return (
    <td
      className={`w-10 px-2 py-2 sticky left-0 z-[1] ${bgClass}`}
      onClick={(e) => e.stopPropagation()} // tránh trigger row onClick
    >
      <input
        type="checkbox"
        aria-label={`Chọn ${rowLabel ?? `bản ghi ${id}`}`}
        checked={selection.isSelected(id)}
        onChange={() => selection.toggleOne(id)}
        disabled={disabled}
        aria-disabled={disabled}
        title={disabled ? ineligibleReason ?? undefined : undefined}
        className={[
          'h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        ].join(' ')}
      />
    </td>
  );
}
