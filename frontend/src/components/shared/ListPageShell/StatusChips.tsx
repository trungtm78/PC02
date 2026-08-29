/**
 * <ListPageShell.StatusChips> — horizontal scroll chip bar cho status filter.
 *
 * Pseudo-chip "Tất cả" (value=null) prepended → clear filter. Each chip có
 * role="tab", aria-selected, aria-controls=tableId từ Context.
 *
 * Count contract: counts từ server-aggregated /stats endpoint scoped to active
 * non-status filters. Loading state → skeleton dot pill.
 */
import {
  STATUS_CHIPS_BAR,
  STATUS_CHIP_BASE,
  STATUS_CHIP_ACTIVE,
  STATUS_CHIP_INACTIVE,
  STATUS_CHIP_COUNT_ACTIVE,
  STATUS_CHIP_COUNT_INACTIVE,
  A11Y_FOCUS_RING,
} from '@/constants/styles';
import { useListPageShellContext } from './ListPageShell';

import { CHUA_BIET } from '@/lib/soLieuHienThi';

export interface StatusChipOption {
  value: string;
  shortLabel: string;
  label: string;
  count?: number;
}

export interface StatusChipsProps {
  options: StatusChipOption[];
  activeValue: string | null;
  onChange(value: string | null): void;
  /** Tổng count khi "Tất cả" chip render. Optional — nếu missing, "Tất cả" không có count. */
  totalCount?: number;
  /** Khi true, hiển thị skeleton thay vì count number. */
  countsLoading?: boolean;
  /**
   * Đã hỏi và HỎNG. Khác `countsLoading` (đang hỏi) và khác count = 0 (đã hỏi, câu trả lời là
   * không có gì). Đo trên máy thật 29/08/2026: chặn máy chủ thì chip "Tất cả" ra số 0 ở
   * /objects · /people/* · /lawyers · /uy-thac-dieu-tra — số 0 ấy đọc như một câu trả lời.
   */
  countsUnknown?: boolean;
  /**
   * Đang lọc theo NHÓM trạng thái (bấm thẻ thống kê) — lúc đó không status đơn lẻ nào
   * được chọn nên `activeValue` là null, và chip "Tất cả" sẽ sáng lên: đó là nói dối,
   * vì danh sách đang bị lọc. Cờ này tắt trạng thái sáng của chip "Tất cả".
   */
  groupActive?: boolean;
}

export function StatusChips({
  options,
  activeValue,
  onChange,
  totalCount,
  countsLoading,
  countsUnknown = false,
  groupActive = false,
}: StatusChipsProps) {
  const { tableId } = useListPageShellContext();

  const renderCount = (count: number | undefined, isActive: boolean) => {
    if (countsLoading) {
      return (
        <span
          data-testid="status-chip-count-skeleton"
          className={`${isActive ? STATUS_CHIP_COUNT_ACTIVE : STATUS_CHIP_COUNT_INACTIVE} animate-pulse`}
          aria-hidden="true"
        >
          •
        </span>
      );
    }
    if (countsUnknown) {
      return (
        <span className={isActive ? STATUS_CHIP_COUNT_ACTIVE : STATUS_CHIP_COUNT_INACTIVE}>
          {CHUA_BIET}
        </span>
      );
    }
    if (count == null) return null;
    return (
      <span className={isActive ? STATUS_CHIP_COUNT_ACTIVE : STATUS_CHIP_COUNT_INACTIVE}>
        {count}
      </span>
    );
  };

  const renderChip = (
    value: string | null,
    shortLabel: string,
    label: string,
    count: number | undefined,
  ) => {
    // Chip "Tất cả" (value === null) không được sáng khi đang lọc theo nhóm.
    const isActive = activeValue === value && !(value === null && groupActive);
    return (
      <button
        key={value ?? '__all__'}
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls={tableId}
        title={label}
        onClick={() => onChange(value)}
        className={`${STATUS_CHIP_BASE} ${isActive ? STATUS_CHIP_ACTIVE : STATUS_CHIP_INACTIVE} ${A11Y_FOCUS_RING}`}
      >
        <span>{shortLabel}</span>
        {renderCount(count, isActive)}
      </button>
    );
  };

  return (
    <div role="tablist" aria-label="Lọc theo trạng thái" className={STATUS_CHIPS_BAR}>
      {renderChip(null, 'Tất cả', 'Tất cả', totalCount)}
      {options.map((opt) => renderChip(opt.value, opt.shortLabel, opt.label, opt.count))}
    </div>
  );
}
