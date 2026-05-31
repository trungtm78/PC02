import { Eye, Pencil, Trash2 } from 'lucide-react';
import type { RowAction, ActionContext, DeleteModalOpenArgs } from './registry';

interface CommonOptions<TRow extends { id: string }> {
  basePath: string;
  resourceType?: DeleteModalOpenArgs['resourceType'];
  canDelete?: (row: TRow, ctx: ActionContext) => string | null;
}

/**
 * v0.62 PR1a — Common row actions shared across resources.
 *
 * View + Edit are identical across all 4 list shells (only path differs).
 * Delete is opt-in: pass canDelete predicate returning null=allowed,
 * string=disabled-with-reason.
 *
 * Per Claude eng review #4: -150 LOC per resource registration.
 */
export function commonResourceActions<TRow extends { id: string }>(
  opts: CommonOptions<TRow>,
): RowAction<TRow>[] {
  const list: RowAction<TRow>[] = [
    {
      key: 'view',
      label: 'Xem chi tiết',
      icon: Eye,
      position: 'inline',
      execute: (row, ctx) => ctx.navigate(`${opts.basePath}/${row.id}`),
      testid: 'btn-view',
    },
    {
      key: 'edit',
      label: 'Chỉnh sửa',
      icon: Pencil,
      position: 'inline',
      visible: (_row, ctx) => ctx.perms.canEdit !== false,
      execute: (row, ctx) => ctx.navigate(`${opts.basePath}/${row.id}/edit`),
      testid: 'btn-edit',
    },
  ];

  if (opts.canDelete) {
    const { canDelete, resourceType } = opts;
    if (!resourceType) {
      throw new Error('commonResourceActions: resourceType required when canDelete provided');
    }
    list.push({
      key: 'delete',
      label: 'Xóa',
      icon: Trash2,
      position: 'inline',
      danger: true,
      visible: (_row, ctx) => ctx.perms.canDelete !== false,
      disabled: (row, ctx) => canDelete(row, ctx),
      execute: (row, ctx) =>
        ctx.deleteModal.open({
          resourceType,
          recordId: row.id,
        }),
      testid: 'btn-delete',
    });
  }

  return list;
}
