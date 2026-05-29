/**
 * <ListPageShell.AlertBanners> — persistent alerts (overdue count, warnings).
 * <ListPageShell.TransientBanners> — ephemeral toasts (success messages, errors).
 *
 * Split per autoplan design auto-decision #3 (post-action layout shift bug):
 * - AlertBanners đặt phía trên StatusChips → persistent, không gây layout shift
 *   khi user click bulk action
 * - TransientBanners đặt phía trên Pagination → ephemeral, consumer dismiss qua
 *   timer hoặc explicit close button
 */
import { Children, type ReactNode } from 'react';

function hasChildren(children: ReactNode): boolean {
  // Children.count === 0 cho null/undefined/empty fragments
  return Children.count(children) > 0 && children !== false && children !== null;
}

export interface BannersProps {
  children?: ReactNode;
}

export function AlertBanners({ children }: BannersProps): JSX.Element | null {
  if (!hasChildren(children)) return null;
  return (
    <div
      data-testid="list-page-shell-alert-banners"
      role="region"
      aria-label="Cảnh báo"
      className="px-4 py-2 space-y-2 bg-amber-50 border-b border-amber-200"
    >
      {children}
    </div>
  );
}

export function TransientBanners({ children }: BannersProps): JSX.Element | null {
  if (!hasChildren(children)) return null;
  return (
    <div
      data-testid="list-page-shell-transient-banners"
      role="status"
      aria-live="polite"
      className="px-4 py-2 space-y-2"
    >
      {children}
    </div>
  );
}
