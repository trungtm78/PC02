import { api } from '@/lib/api';
import { resolveFilename } from '@/features/document-templates/export.api';
import type { BulkAdapter, BulkAction, BulkResult } from '../types';

interface AssignParams {
  assignedTeamId?: string;
  investigatorId?: string;
}

interface IncidentRow {
  id: string;
  status?: string;
  code?: string;
}

const exportAction: BulkAction<IncidentRow> = {
  key: 'export',
  label: 'Xuất Excel',
  variant: 'outline',
  permission: { resource: 'incidents', action: 'view' },
  requiresPreview: false,
  allowsAllMatchingFilter: true,
  execute: async ({ ids }) => {
    const response = await api.post(
      '/incidents/bulk-export',
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
      `VuViec_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

const assignAction: BulkAction<IncidentRow> = {
  key: 'assign',
  label: 'Phân công',
  variant: 'primary',
  permission: { resource: 'incidents', action: 'edit' },
  requiresPreview: true,
  allowsAllMatchingFilter: false,
  execute: async ({ ids, reason, idempotencyKey, params }) => {
    const assignParams = params as AssignParams | undefined;
    if (!assignParams?.assignedTeamId && !assignParams?.investigatorId) {
      throw new Error('Cần chọn tổ hoặc điều tra viên trước khi xác nhận');
    }
    const response = await api.post('/incidents/bulk-assign', {
      ids,
      assignedTeamId: assignParams.assignedTeamId,
      investigatorId: assignParams.investigatorId,
      reason: reason ?? 'Phân công hàng loạt',
      idempotencyKey,
    });
    return response.data as BulkResult<{ incidentId: string }>;
  },
};

const deleteAction: BulkAction<IncidentRow> = {
  key: 'delete',
  label: 'Xóa',
  variant: 'danger',
  permission: { resource: 'incidents', action: 'delete' },
  requiresPreview: true,
  allowsAllMatchingFilter: false,
  rowEligibility: (row) =>
    row.status === 'TIEP_NHAN' ? null : 'Chỉ xóa được vụ việc ở trạng thái Tiếp nhận',
  execute: async ({ ids, reason, idempotencyKey }) => {
    const response = await api.post('/incidents/bulk-delete', {
      ids,
      reason: reason ?? 'Xóa hàng loạt',
      idempotencyKey,
    });
    return response.data;
  },
};

const restoreAction: BulkAction<IncidentRow> = {
  key: 'restore',
  label: 'Khôi phục',
  variant: 'primary',
  permission: { resource: 'incidents', action: 'edit' },
  requiresPreview: true,
  allowsAllMatchingFilter: false,
  execute: async ({ ids, reason, idempotencyKey }) => {
    const response = await api.post('/incidents/bulk-restore', {
      ids,
      reason: reason ?? 'Khôi phục hàng loạt',
      idempotencyKey,
    });
    return response.data;
  },
};

export function buildIncidentsAdapter(opts?: {
  fetchAllIdsMatchingFilter?: () => Promise<string[]>;
  enableAssign?: boolean;
  enableDelete?: boolean;
  enableRestore?: boolean;
}): BulkAdapter<IncidentRow> {
  const actions: BulkAction<IncidentRow>[] = [exportAction];
  if (opts?.enableAssign) actions.push(assignAction);
  if (opts?.enableDelete) actions.push(deleteAction);
  if (opts?.enableRestore) actions.push(restoreAction);
  return {
    resource: 'incidents',
    resourceLabel: 'vụ việc',
    actions,
    fetchAllIdsMatchingFilter: opts?.fetchAllIdsMatchingFilter,
  };
}
