import { api } from '@/lib/api';
import { resolveFilename } from '@/features/document-templates/export.api';
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
    link.download = resolveFilename(
      response.headers as Record<string, unknown>,
      `DonThu_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

/**
 * Xuất Word chứng từ cho các đơn đã tích. Chỉ CHỤP ids rồi mở modal chọn mẫu —
 * việc gọi API do trang danh sách làm (nó giữ banner kết quả + trạng thái đang xuất).
 *
 * `allowsAllMatchingFilter: false` — KHÔNG như Xuất Excel: xuất Word CẤP SỐ VĂN BẢN,
 * mà số đã vào sổ thì không rút lại được. Đây chỉ là lớp chắn thứ nhất và KHÔNG đủ:
 * `toggleOne` đặt lại mode='page' nhưng giữ nguyên selectedIds, nên chọn-tất-cả rồi bỏ
 * tick 1 dòng vẫn lọt. Chặn thật nằm ở modal (trần N×M) + backend (cap 100).
 */
function buildExportWordAction(
  onPick: (ids: string[]) => void,
): BulkAction<PetitionRow> {
  return {
    key: 'export-word',
    label: 'Xuất Word',
    variant: 'outline',
    permission: { resource: 'petitions', action: 'view' },
    requiresPreview: false,
    allowsAllMatchingFilter: false,
    skipConfirm: true,
    execute: async ({ ids }) => {
      onPick(ids);
    },
  };
}

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
  /** Bật "Xuất Word": nhận ids đã chụp để trang danh sách mở modal chọn mẫu. */
  onExportWord?: (ids: string[]) => void;
}): BulkAdapter<PetitionRow> {
  const actions: BulkAction<PetitionRow>[] = [exportAction];
  if (opts?.onExportWord) actions.push(buildExportWordAction(opts.onExportWord));
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
