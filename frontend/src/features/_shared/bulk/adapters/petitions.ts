import { api } from '@/lib/api';
import type { BulkAdapter, BulkAction, BulkResult } from '../types';

interface AssignParams {
  assignedToId: string;
}

interface PetitionRow {
  id: string;
  status?: string;
  stt?: string;
}

const exportAction: BulkAction<PetitionRow> = {
  key: 'export',
  label: 'Xuất Excel',
  variant: 'outline',
  permission: { resource: 'petitions', action: 'view' },
  requiresPreview: false,
  allowsAllMatchingFilter: true,
  execute: async ({ ids }) => {
    const response = await api.post(
      '/petitions/bulk-export',
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
    link.download = filenameMatch?.[1] ?? `DonThu_${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

const assignAction: BulkAction<PetitionRow> = {
  key: 'assign',
  label: 'Phân công',
  variant: 'primary',
  permission: { resource: 'petitions', action: 'edit' },
  requiresPreview: true,
  allowsAllMatchingFilter: false,
  execute: async ({ ids, reason, idempotencyKey, params }) => {
    const assignParams = params as AssignParams | undefined;
    if (!assignParams?.assignedToId) {
      throw new Error('Cần chọn người phụ trách trước khi xác nhận');
    }
    const response = await api.post('/petitions/bulk-assign', {
      ids,
      assignedToId: assignParams.assignedToId,
      reason: reason ?? 'Phân công hàng loạt',
      idempotencyKey,
    });
    return response.data as BulkResult<{ petitionId: string }>;
  },
};

const deleteAction: BulkAction<PetitionRow> = {
  key: 'delete',
  label: 'Xóa',
  variant: 'danger',
  permission: { resource: 'petitions', action: 'delete' },
  requiresPreview: true,
  allowsAllMatchingFilter: false,
  execute: async ({ ids, reason, idempotencyKey }) => {
    const response = await api.post('/petitions/bulk-delete', {
      ids,
      reason: reason ?? 'Xóa hàng loạt',
      idempotencyKey,
    });
    return response.data;
  },
};

const restoreAction: BulkAction<PetitionRow> = {
  key: 'restore',
  label: 'Khôi phục',
  variant: 'primary',
  permission: { resource: 'petitions', action: 'edit' },
  requiresPreview: true,
  allowsAllMatchingFilter: false,
  execute: async ({ ids, reason, idempotencyKey }) => {
    const response = await api.post('/petitions/bulk-restore', {
      ids,
      reason: reason ?? 'Khôi phục hàng loạt',
      idempotencyKey,
    });
    return response.data;
  },
};

export function buildPetitionsAdapter(opts?: {
  fetchAllIdsMatchingFilter?: () => Promise<string[]>;
  enableAssign?: boolean;
  enableDelete?: boolean;
  enableRestore?: boolean;
}): BulkAdapter<PetitionRow> {
  const actions: BulkAction<PetitionRow>[] = [exportAction];
  if (opts?.enableAssign) actions.push(assignAction);
  if (opts?.enableDelete) actions.push(deleteAction);
  if (opts?.enableRestore) actions.push(restoreAction);
  return {
    resource: 'petitions',
    resourceLabel: 'đơn thư',
    actions,
    fetchAllIdsMatchingFilter: opts?.fetchAllIdsMatchingFilter,
  };
}
