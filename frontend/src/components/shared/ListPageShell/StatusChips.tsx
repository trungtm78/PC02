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
}

export function StatusChips({
  options,
  activeValue,
  onChange,
  totalCount,
  countsLoading,
}: StatusChipsProps): JSX.Element {
  const { tableId } = useListPageShellContext();

  const renderCount = (count: number | undefined, isActive: boolean): JSX.Element | null => {
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
  ): JSX.Element => {
    const isActive = activeValue === value;
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
