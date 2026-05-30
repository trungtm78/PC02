import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { ActionMenuPortal } from '@/components/ActionMenuPortal';
import { BTN_ICON_BLUE, BTN_ICON_SLATE, BTN_ICON_RED } from '@/constants/styles';
import type { ActionContext, RowActionRegistry, RowAction } from './registry';

interface RowActionsProps<TRow extends { id: string }> {
  registry: RowActionRegistry<TRow>;
  row: TRow;
  ctx: ActionContext;
}

/**
 * v0.62 PR1a — Smart row-actions component.
 *
 * Reads action registry + applies visible/disabled guards per row + ctx.
 * Renders inline icon buttons + (if any menu items) ⋮ kebab opening
 * ActionMenuPortal with keyboard-nav menu items.
 *
 * All button clicks stopPropagation to prevent row navigation.
 */
export function RowActions<TRow extends { id: string }>({
  registry,
  row,
  ctx,
}: RowActionsProps<TRow>) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const visible = registry.all().filter((a) => (a.visible ? a.visible(row, ctx) : true));
  const inline = visible.filter((a) => a.position === 'inline');
  const menu = visible.filter((a) => a.position === 'menu');

  return (
    <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {inline.map((action) => (
        <InlineButton key={action.key} action={action} row={row} ctx={ctx} />
      ))}
      {menu.length > 0 && (
        <>
          <button
            type="button"
            data-testid={`btn-action-menu-${row.id}`}
            title="Thao tác khác"
            aria-label="Thao tác khác"
            className={BTN_ICON_SLATE}
            onClick={(e) => {
              e.stopPropagation();
              setMenuAnchor(menuAnchor ? null : e.currentTarget);
            }}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          <ActionMenuPortal
            anchor={menuAnchor}
            open={menuAnchor !== null}
            onClose={() => setMenuAnchor(null)}
            align="left"
          >
            {menu.map((action) => (
              <MenuItem
                key={action.key}
                action={action}
                row={row}
                ctx={ctx}
                onAfterExecute={() => setMenuAnchor(null)}
              />
            ))}
          </ActionMenuPortal>
        </>
      )}
    </div>
  );
}

interface ActionItemProps<TRow extends { id: string }> {
  action: RowAction<TRow>;
  row: TRow;
  ctx: ActionContext;
}

function InlineButton<TRow extends { id: string }>({
  action,
  row,
  ctx,
}: ActionItemProps<TRow>) {
  const Icon = action.icon;
  const disabledReason = action.disabled ? action.disabled(row, ctx) : null;
  const colorClass = action.danger ? BTN_ICON_RED : BTN_ICON_BLUE;
  return (
    <button
      type="button"
      data-testid={`${action.testid}-${row.id}`}
      title={disabledReason ?? action.label}
      aria-label={action.label}
      disabled={disabledReason != null}
      className={colorClass}
      onClick={(e) => {
        e.stopPropagation();
        if (disabledReason) return;
        action.execute(row, ctx);
      }}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

interface MenuItemProps<TRow extends { id: string }> extends ActionItemProps<TRow> {
  onAfterExecute: () => void;
}

function MenuItem<TRow extends { id: string }>({
  action,
  row,
  ctx,
  onAfterExecute,
}: MenuItemProps<TRow>) {
  const Icon = action.icon;
  const disabledReason = action.disabled ? action.disabled(row, ctx) : null;
  const baseClass =
    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
  const stateClass = disabledReason
    ? 'text-slate-400 cursor-not-allowed'
    : action.danger
      ? 'text-red-700 hover:bg-red-50'
      : 'text-slate-700 hover:bg-slate-100';
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={`${action.testid}-${row.id}`}
      title={disabledReason ?? action.label}
      disabled={disabledReason != null}
      className={`${baseClass} ${stateClass}`}
      onClick={(e) => {
        e.stopPropagation();
        if (disabledReason) return;
        action.execute(row, ctx);
        onAfterExecute();
      }}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{action.label}</span>
    </button>
  );
}
