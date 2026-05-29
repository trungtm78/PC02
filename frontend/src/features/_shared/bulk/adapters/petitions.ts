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

export function buildPetitionsAdapter(opts?: {
  fetchAllIdsMatchingFilter?: () => Promise<string[]>;
}): BulkAdapter<PetitionRow> {
  return {
    resource: 'petitions',
    resourceLabel: 'đơn thư',
    actions: [exportAction, assignAction],
    fetchAllIdsMatchingFilter: opts?.fetchAllIdsMatchingFilter,
  };
}
