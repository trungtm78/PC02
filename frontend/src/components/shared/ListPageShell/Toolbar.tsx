/**
 * <ListPageShell.Toolbar> — search input + filter toggle + reset button.
 *
 * Children (optional) = advanced filter content rendered trong CSS grid
 * accordion (FILTER_ACCORDION_* tokens). Toggle button có aria-expanded.
 *
 * Reset button conditional (activeFilterCount > 0 + onResetFilters provided).
 */
import { useState, useId, useRef, type ReactNode } from 'react';
import { Search, SlidersHorizontal, RotateCcw } from 'lucide-react';
import {
  INPUT_WITH_ICON,
  ICON_INPUT_POSITION,
  BTN_OUTLINE_SLATE,
  BTN_OUTLINE_BLUE,
  FILTER_ACCORDION_COLLAPSED,
  FILTER_ACCORDION_EXPANDED,
  FILTER_ACCORDION_CONTENT,
  A11Y_FOCUS_RING,
} from '@/constants/styles';

export interface ToolbarProps {
  searchValue: string;
  onSearchChange(value: string): void;
  searchPlaceholder?: string;
  /** Số filter đang active (hiển thị badge cạnh nút "Bộ lọc"). */
  activeFilterCount?: number;
  /** Callback khi user click "Xóa lọc" — only rendered nếu activeFilterCount > 0. */
  onResetFilters?(): void;
  /** Advanced filter content rendered trong accordion khi expanded. */
  children?: ReactNode;
}

export function Toolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Tìm kiếm...',
  activeFilterCount = 0,
  onResetFilters,
  children,
}: ToolbarProps) {
  const [expanded, setExpanded] = useState(false);
  const filterPanelId = useId();
  const ref = useRef<HTMLDivElement>(null);

  const hasAdvancedFilters = children != null;
  const showReset = activeFilterCount > 0 && onResetFilters != null;

  return (
    <div
      ref={ref}
      data-testid="list-page-shell-toolbar"
      className="bg-white border-b border-slate-200 px-4 py-3"
    >
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className={ICON_INPUT_POSITION} aria-hidden="true" />
          <input
            type="search"
            role="searchbox"
            aria-label="Tìm kiếm trong danh sách"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className={`${INPUT_WITH_ICON} ${A11Y_FOCUS_RING}`}
          />
        </div>

        {hasAdvancedFilters && (
          <button
            type="button"
            data-testid="list-page-shell-filter-toggle"
            aria-expanded={expanded}
            aria-controls={filterPanelId}
            onClick={() => setExpanded((v) => !v)}
            className={`${activeFilterCount > 0 ? BTN_OUTLINE_BLUE : BTN_OUTLINE_SLATE} ${A11Y_FOCUS_RING} flex items-center gap-2`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Bộ lọc</span>
            {activeFilterCount > 0 && (
              <span
                data-testid="list-page-shell-filter-count"
                className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-blue-600 text-white text-xs font-semibold"
              >
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        {showReset && (
          <button
            type="button"
            data-testid="list-page-shell-reset-filters"
            onClick={onResetFilters}
            className={`${BTN_OUTLINE_SLATE} ${A11Y_FOCUS_RING} flex items-center gap-2`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Xóa lọc</span>
          </button>
        )}
      </div>

      {hasAdvancedFilters && (
        <div
          id={filterPanelId}
          className={`${expanded ? FILTER_ACCORDION_EXPANDED : FILTER_ACCORDION_COLLAPSED} mt-3`}
        >
          <div className={FILTER_ACCORDION_CONTENT}>{children}</div>
        </div>
      )}
    </div>
  );
}
