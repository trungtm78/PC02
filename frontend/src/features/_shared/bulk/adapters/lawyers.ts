/**
 * PR4 — Lawyers bulk adapter.
 *
 * Maps backend bulk endpoint (v0.51 PR4):
 * - POST /lawyers/bulk-delete (creator-or-admin gate at backend layer)
 *
 * Lawyers are NON-RESTORABLE (per v0.51 design — different from Cases/Incidents).
 * No bulk-export endpoint yet (deferred to follow-up).
 *
 * Permission gating: frontend resource 'lawyers' action 'delete' translates to
 * backend rights check at /lawyers/bulk-delete route.
 */
import { api } from '@/lib/api';
import type { BulkAdapter, BulkAction, BulkResult } from '../types';

interface LawyerRow {
  id: string;
  fullName?: string;
  caseId?: string;
}

/**
 * F5 — Bulk-export Lawyers ra xlsx.
 * Read-only — không requiresPreview, executes immediately.
 */
const exportAction: BulkAction<LawyerRow> = {
  key: 'export',
  label: 'Xuất Excel',
  variant: 'outline',
  permission: { resource: 'lawyers', action: 'view' },
  requiresPreview: false,
  allowsAllMatchingFilter: true,
  execute: async ({ ids }) => {
    const response = await api.post(
      '/lawyers/bulk-export',
      { ids },
      { responseType: 'blob' },
    );
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cd = (response.headers['content-disposition'] as string) ?? '';
    const filenameMatch = /filename="([^"]+)"/.exec(cd);
    link.download = filenameMatch?.[1] ?? `LuatSu_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

/**
 * PR4 — Bulk-delete Lawyers.
 *
 * requiresPreview=true → confirm modal với reason ≥10 chars + escalating
 * friction (10/50/200) ở BulkActionBar.
 *
 * No rowEligibility — backend handles creator-or-admin permission check
 * per-row at preflight; UI doesn't have the auth context to predict skips.
 */
const deleteAction: BulkAction<LawyerRow> = {
  key: 'delete',
  label: 'Xóa',
  variant: 'danger',
  permission: { resource: 'lawyers', action: 'delete' },
  requiresPreview: true,
  allowsAllMatchingFilter: false,
  execute: async ({ ids, reason, idempotencyKey }) => {
    const response = await api.post('/lawyers/bulk-delete', {
      ids,
      reason: reason ?? 'Xóa hàng loạt',
      idempotencyKey,
    });
    return response.data as BulkResult<{ lawyerId: string }>;
  },
};

export function buildLawyersAdapter(opts?: {
  /** Bật bulk-delete action — PR4. */
  enableDelete?: boolean;
  /** Bật bulk-export action — F5. */
  enableExport?: boolean;
}): BulkAdapter<LawyerRow> {
  const actions: BulkAction<LawyerRow>[] = [];
  if (opts?.enableExport) actions.push(exportAction);
  if (opts?.enableDelete) actions.push(deleteAction);
  return {
    resource: 'lawyers',
    resourceLabel: 'luật sư',
    actions,
  };
}
