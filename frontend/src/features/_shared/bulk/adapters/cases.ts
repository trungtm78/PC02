import { api } from '@/lib/api';
import type { BulkAdapter, BulkAction, BulkResult } from '../types';

/**
 * v0.48 PR1 F3 — Cases bulk adapter.
 *
 * Maps backend endpoints (B3a+B3b) → frontend BulkAction shape.
 * Permission gating: frontend resource 'cases', actions 'view'/'edit' (translate
 * sang backend 'read'/'edit' ở backend layer — adapter chỉ care frontend names).
 *
 * Actions:
 * - export: read-only, allowsAllMatchingFilter=true, không preview.
 * - assign: write, requires preview (reason 10-500), không cho all-matching-filter
 *   (plan v2 F4 risk guard).
 */

interface AssignParams {
  assignedTeamId: string;
  investigatorId?: string;
}

interface CaseRow {
  id: string;
  status?: string;
  caseCode?: string;
  deletedAt?: string | null;
}

const exportAction: BulkAction<CaseRow> = {
  key: 'export',
  label: 'Xuất Excel',
  variant: 'outline',
  permission: { resource: 'cases', action: 'view' },
  requiresPreview: false,
  allowsAllMatchingFilter: true,
  execute: async ({ ids }) => {
    const response = await api.post(
      '/cases/bulk-export',
      { ids },
      { responseType: 'blob' },
    );
    // Trigger download
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cd = (response.headers['content-disposition'] as string) ?? '';
    const filenameMatch = /filename="([^"]+)"/.exec(cd);
    link.download = filenameMatch?.[1] ?? `VuAn_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

const assignAction: BulkAction<CaseRow> = {
  key: 'assign',
  label: 'Phân công',
  variant: 'primary',
  permission: { resource: 'cases', action: 'edit' },
  requiresPreview: true,
  allowsAllMatchingFilter: false,
  execute: async ({ ids, reason, idempotencyKey, params }) => {
    const assignParams = params as AssignParams | undefined;
    if (!assignParams?.assignedTeamId) {
      // Adapter pass-through; UI sẽ open modal nhập teamId trước khi call execute.
      // V0.48 PR1 chấp nhận: nếu chưa wire team picker, alert + return empty result.
      // Phase wiring (F4) sẽ thêm team picker.
      throw new Error('Thiếu mã tổ điều tra — UI cần mở modal chọn tổ trước khi xác nhận');
    }
    const response = await api.post('/cases/bulk-assign', {
      ids,
      assignedTeamId: assignParams.assignedTeamId,
      investigatorId: assignParams.investigatorId,
      reason: reason ?? 'Phân công hàng loạt',
      idempotencyKey,
    });
    return response.data as BulkResult<{ caseId: string }>;
  },
};

/**
 * v0.49 PR2 — Bulk-delete Cases.
 *
 * Per-row eligibility (UI-side hint, backend enforce):
 * - status TIEP_NHAN only.
 * - rowEligibility chỉ hint cho UI (checkbox disabled + tooltip). Backend chính
 *   xác là source of truth (preflight TIEP_NHAN + no linked + creator-or-admin).
 *
 * requiresPreview=true → confirm modal với reason 10-500 chars + escalating
 * friction (10/50/200) ở BulkActionBar.
 */
const deleteAction: BulkAction<CaseRow> = {
  key: 'delete',
  label: 'Xóa',
  variant: 'danger',
  permission: { resource: 'cases', action: 'delete' },
  requiresPreview: true,
  allowsAllMatchingFilter: false,
  rowEligibility: (row) =>
    row.status === 'TIEP_NHAN'
      ? null
      : 'Chỉ xóa được vụ án ở trạng thái Tiếp nhận',
  execute: async ({ ids, reason, idempotencyKey }) => {
    const response = await api.post('/cases/bulk-delete', {
      ids,
      reason: reason ?? 'Xóa hàng loạt',
      idempotencyKey,
    });
    return response.data as BulkResult<{ caseId: string }>;
  },
};

/**
 * v0.49 PR2 — Bulk-restore Cases (admin-only at backend).
 * Frontend permission gate dùng action 'edit' (mock layer); backend gate 'restore'.
 */
const restoreAction: BulkAction<CaseRow> = {
  key: 'restore',
  label: 'Khôi phục',
  variant: 'primary',
  permission: { resource: 'cases', action: 'edit' },
  requiresPreview: true,
  allowsAllMatchingFilter: false,
  execute: async ({ ids, reason, idempotencyKey }) => {
    const response = await api.post('/cases/bulk-restore', {
      ids,
      reason: reason ?? 'Khôi phục hàng loạt',
      idempotencyKey,
    });
    return response.data as BulkResult<{ caseId: string }>;
  },
};

export function buildCasesAdapter(opts?: {
  fetchAllIdsMatchingFilter?: () => Promise<string[]>;
  /** Bật assign action (cần team picker modal). v0.49 vẫn defer. */
  enableAssign?: boolean;
  /** Bật bulk-delete action — v0.49 PR2. */
  enableDelete?: boolean;
  /** Bật bulk-restore action (admin admin-deleted list page). */
  enableRestore?: boolean;
}): BulkAdapter<CaseRow> {
  const actions: BulkAction<CaseRow>[] = [exportAction];
  if (opts?.enableAssign) actions.push(assignAction);
  if (opts?.enableDelete) actions.push(deleteAction);
  if (opts?.enableRestore) actions.push(restoreAction);
  return {
    resource: 'cases',
    resourceLabel: 'vụ án',
    actions,
    fetchAllIdsMatchingFilter: opts?.fetchAllIdsMatchingFilter,
  };
}
