/**
 * PR5 — Subjects bulk adapter.
 *
 * Maps backend bulk endpoint (v0.51 PR4):
 * - POST /subjects/bulk-delete (creator-or-admin gate at backend per row)
 *
 * Subjects are NON-RESTORABLE (same as lawyers — different from cases/incidents).
 * No bulk-export endpoint yet (deferred).
 *
 * Permission gating: frontend resource 'objects' (Subjects use 'objects' resource
 * per shared/enums/permissions.ts) action 'delete' translates to backend gate.
 */
import { api } from '@/lib/api';
import type { BulkAdapter, BulkAction, BulkResult } from '../types';

interface SubjectRow {
  id: string;
  fullName?: string;
  type?: string;
  caseId?: string;
}

/**
 * PR5 — Bulk-delete Subjects.
 *
 * requiresPreview=true → ConfirmModal với reason ≥10 chars + escalating
 * friction (10/50/200) ở BulkActionBar.
 *
 * No rowEligibility — backend handles creator-or-admin per-row at preflight.
 */
const deleteAction: BulkAction<SubjectRow> = {
  key: 'delete',
  label: 'Xóa',
  variant: 'danger',
  permission: { resource: 'objects', action: 'delete' },
  requiresPreview: true,
  allowsAllMatchingFilter: false,
  execute: async ({ ids, reason, idempotencyKey }) => {
    const response = await api.post('/subjects/bulk-delete', {
      ids,
      reason: reason ?? 'Xóa hàng loạt',
      idempotencyKey,
    });
    return response.data as BulkResult<{ subjectId: string }>;
  },
};

export function buildSubjectsAdapter(opts?: {
  /** Bật bulk-delete action — PR5. */
  enableDelete?: boolean;
  /** Resource label override per subjectType (bị can / bị hại / nhân chứng). */
  resourceLabel?: string;
}): BulkAdapter<SubjectRow> {
  const actions: BulkAction<SubjectRow>[] = [];
  if (opts?.enableDelete) actions.push(deleteAction);
  return {
    resource: 'objects',
    resourceLabel: opts?.resourceLabel ?? 'đối tượng',
    actions,
  };
}
