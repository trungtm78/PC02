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
import { resolveFilename } from '@/features/document-templates/export.api';
import type { BulkAdapter, BulkAction, BulkResult } from '../types';

interface SubjectRow {
  id: string;
  fullName?: string;
  type?: string;
  caseId?: string;
}

/**
 * F5 — Bulk-export Subjects ra xlsx (polymorphic SUSPECT/VICTIM/WITNESS,
 * type column trong xlsx).
 */
const exportAction: BulkAction<SubjectRow> = {
  key: 'export',
  label: 'Xuất Excel',
  variant: 'outline',
  permission: { resource: 'objects', action: 'view' },
  requiresPreview: false,
  allowsAllMatchingFilter: true,
  execute: async ({ ids }) => {
    const response = await api.post(
      '/subjects/bulk-export',
      { ids },
      { responseType: 'blob' },
    );
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = resolveFilename(
      response.headers as Record<string, unknown>,
      `DoiTuong_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

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
  /** Bật bulk-export action — F5. */
  enableExport?: boolean;
  /** Resource label override per subjectType (bị can / bị hại / nhân chứng). */
  resourceLabel?: string;
}): BulkAdapter<SubjectRow> {
  const actions: BulkAction<SubjectRow>[] = [];
  if (opts?.enableExport) actions.push(exportAction);
  if (opts?.enableDelete) actions.push(deleteAction);
  return {
    resource: 'objects',
    resourceLabel: opts?.resourceLabel ?? 'đối tượng',
    actions,
  };
}
