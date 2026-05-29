/**
 * <ListPageShell.BulkBar> — bulk action toolbar khi có rows selected.
 *
 * Không render khi selectedIds rỗng. Count region wrap aria-live=polite
 * để screen reader announce changes.
 *
 * Variants:
 * - 'sticky' (default): sticky top desktop
 * - 'mobile-bottom': fixed bottom mobile với safe-area-inset
 */
import { X, type LucideIcon } from 'lucide-react';
import {
  BULK_BAR_STICKY,
  BULK_BAR_MOBILE_BOTTOM,
  BTN_DANGER,
  BTN_OUTLINE_SLATE,
  A11Y_FOCUS_RING,
} from '@/constants/styles';

export interface BulkAction {
  label: string;
  icon: LucideIcon;
  onClick(selectedIds: ReadonlySet<string>): void;
  variant?: 'default' | 'danger';
}

export interface BulkBarProps {
  selectedIds: ReadonlySet<string>;
  onClearSelection(): void;
  actions: BulkAction[];
  variant?: 'sticky' | 'mobile-bottom';
}

export function BulkBar({
  selectedIds,
  onClearSelection,
  actions,
  variant = 'sticky',
}: BulkBarProps): JSX.Element | null {
  if (selectedIds.size === 0) return null;

  const containerClass = variant === 'mobile-bottom' ? BULK_BAR_MOBILE_BOTTOM : BULK_BAR_STICKY;

  return (
    <div
      data-testid="list-page-shell-bulk-bar"
      role="toolbar"
      aria-label="Thao tác hàng loạt"
      className={containerClass}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Bỏ chọn tất cả"
          onClick={onClearSelection}
          className={`p-1.5 rounded hover:bg-slate-200/50 ${A11Y_FOCUS_RING}`}
        >
          <X className="w-4 h-4" />
        </button>
        <span
          data-testid="list-page-shell-bulk-count"
          aria-live="polite"
          className="text-sm font-medium"
        >
          Đã chọn {selectedIds.size} mục
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {actions.map((action) => {
          const Icon = action.icon;
          const btnClass = action.variant === 'danger' ? BTN_DANGER : BTN_OUTLINE_SLATE;
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => action.onClick(selectedIds)}
              className={`${btnClass} ${A11Y_FOCUS_RING} flex items-center gap-2`}
            >
              <Icon className="w-4 h-4" />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
