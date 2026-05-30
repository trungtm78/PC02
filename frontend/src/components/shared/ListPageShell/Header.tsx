/**
 * <ListPageShell.Header> — header subcomponent.
 *
 * Slots: icon (lucide) + title (h1) + subtitle + actions (right-aligned).
 * Title id matches Context titleId → section aria-labelledby relationship.
 */
import { type ReactNode } from 'react';
import { type LucideIcon } from 'lucide-react';
import { PAGE_HEADER, PAGE_TITLE, PAGE_SUBTITLE } from '@/constants/styles';
import { useListPageShellContext } from './ListPageShell';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
}

export function Header({ title, subtitle, icon: Icon, actions }: HeaderProps) {
  const { titleId } = useListPageShellContext();

  return (
    <header
      data-testid="list-page-shell-header"
      className={`${PAGE_HEADER} flex items-start justify-between gap-4`}
    >
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div
            data-testid="list-page-shell-header-icon"
            className="flex-shrink-0 mt-1 p-2 rounded-lg bg-blue-50 text-blue-600"
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 id={titleId} className={`${PAGE_TITLE} truncate`}>
            {title}
          </h1>
          {subtitle && (
            <p
              data-testid="list-page-shell-header-subtitle"
              className={PAGE_SUBTITLE}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </header>
  );
}
