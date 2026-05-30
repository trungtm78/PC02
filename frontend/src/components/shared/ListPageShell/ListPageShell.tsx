/**
 * <ListPageShell> — root compound container cho list pages.
 *
 * Provides:
 * - section landmark với aria-labelledby cho Header
 * - unique IDs qua React.useId() cho a11y relationships (titleId, tableId)
 * - vertical flex layout cho children subcomponents (Header, StatusChips,
 *   Toolbar, BulkBar, Table, Pagination, etc.)
 *
 * Compound API — children compose explicitly:
 *
 *   <ListPageShell>
 *     <ListPageShell.Header title="..." />
 *     <ListPageShell.StatusChips ... />
 *     <ListPageShell.Toolbar ... />
 *     <ListPageShell.BulkBar ... />
 *     <ListPageShell.Table ... />
 *     <ListPageShell.Pagination ... />
 *   </ListPageShell>
 *
 * Mỗi subcomponent được attach via Object.assign trong file riêng (T7-T13).
 */
import { createContext, useContext, useId, type ReactNode } from 'react';

export interface ListPageShellContextValue {
  uniqueId: string;
  titleId: string;
  tableId: string;
}

const ListPageShellContext = createContext<ListPageShellContextValue | null>(null);

export function useListPageShellContext(): ListPageShellContextValue {
  const ctx = useContext(ListPageShellContext);
  if (!ctx) {
    throw new Error(
      'useListPageShellContext phải được gọi bên trong <ListPageShell>. ' +
      'Đảm bảo component nằm trong subtree của ListPageShell root.',
    );
  }
  return ctx;
}

export interface ListPageShellProps {
  children: ReactNode;
  /** Optional custom className cho wrapper section. */
  className?: string;
}

function ListPageShellRoot({ children, className }: ListPageShellProps) {
  const uniqueId = useId();
  // useId trả về string với ":" → không hợp với HTML id. Sanitize.
  const safeId = uniqueId.replace(/:/g, '');

  const ctx: ListPageShellContextValue = {
    uniqueId: safeId,
    titleId: `list-page-shell-${safeId}-title`,
    tableId: `list-page-shell-${safeId}-table`,
  };

  return (
    <ListPageShellContext.Provider value={ctx}>
      <section
        role="region"
        aria-labelledby={ctx.titleId}
        data-testid="list-page-shell"
        className={className ?? 'flex flex-col gap-0 bg-slate-50 min-h-screen'}
      >
        {children}
      </section>
    </ListPageShellContext.Provider>
  );
}

// Compound component object — subcomponents attached qua re-export ở index.ts.
// Tránh circular import: subcomponents import { useListPageShellContext } from './ListPageShell',
// và index.ts assemble final ListPageShell với .Header, .StatusChips, etc.
export const ListPageShell = ListPageShellRoot;
