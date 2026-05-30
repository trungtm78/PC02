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
}): BulkAdapter<LawyerRow> {
  const actions: BulkAction<LawyerRow>[] = [];
  if (opts?.enableDelete) actions.push(deleteAction);
  return {
    resource: 'lawyers',
    resourceLabel: 'luật sư',
    actions,
  };
}
