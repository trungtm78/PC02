/**
 * v0.48 PR1 F2 — Shared types cho bulk action infrastructure.
 * Match backend BulkResult shape (backend/src/common/bulk/run-bulk.ts).
 */
import type { PermissionAction, PermissionResource } from '@/hooks/usePermission';

export type BulkSkipReason =
  | 'INELIGIBLE'
  | 'PERMISSION'
  | 'NOT_FOUND'
  | 'CONCURRENT_MODIFICATION'
  | 'SERVER_ERROR';

export interface BulkSkippedItem {
  id: string;
  reason: BulkSkipReason;
  message?: string;
}

export interface BulkFailedItem {
  id: string;
  error: string;
}

export interface BulkResult<T = unknown> {
  succeeded: Array<{ id: string; data?: T }>;
  skipped: BulkSkippedItem[];
  failed: BulkFailedItem[];
}

/**
 * 1 action trong BulkActionBar (vd "Xuất Excel", "Phân công", "Đổi trạng thái").
 *
 * Permission gating:
 * - `permission`: `{ resource, action }` để check qua `usePermission().hasPermission`.
 *   Frontend `view` → backend `read` translate ở adapter execute layer.
 *
 * Preview gate (D-C5 plan v2):
 * - `requiresPreview: true` → action cần PreviewModal 2-step (assign/transfer/status).
 * - `requiresPreview: false` → execute trực tiếp (export).
 *
 * Escalating friction (D-H6):
 * - Count > frictionThreshold → confirm dialog phải có typed reason hoặc checkbox.
 *   Default thresholds: 10, 50, 200 (xem BulkActionBar component).
 */
export interface BulkAction<TRow = unknown, TResult = unknown> {
  key: string; // unique per adapter, vd 'export', 'assign'
  label: string; // Vietnamese ≤2 words, vd "Xuất Excel"
  variant: 'primary' | 'danger' | 'outline';
  permission: { resource: PermissionResource; action: PermissionAction };
  requiresPreview: boolean;
  /**
   * Per-row eligibility check (vd Case status ≠ TIEP_NHAN khi delete).
   * Return null = eligible; return reason string = ineligible (tooltip).
   */
  rowEligibility?: (row: TRow) => string | null;
  /**
   * Allow 'all-matching-filter' mode cho action này.
   * Plan v2 design F5 (revised): chỉ export = true; delete/status/assign/transfer = false.
   */
  allowsAllMatchingFilter: boolean;
  /**
   * Execute action với selected ids + optional reason. Returns BulkResult (read-from-API).
   * Export action có thể return void (xlsx stream downloaded directly).
   */
  execute: (input: BulkActionExecuteInput) => Promise<BulkResult<TResult> | void>;
}

export interface BulkActionExecuteInput {
  ids: string[];
  reason?: string;
  idempotencyKey?: string;
  /** Extra per-action params (assignedTeamId, targetUnitId, etc.). */
  params?: Record<string, unknown>;
}

/**
 * Adapter per resource — khai báo các actions có thể bulk + identity của resource.
 */
export interface BulkAdapter<TRow = unknown> {
  resource: PermissionResource;
  /** Tên tiếng Việt số nhiều, vd "vụ án", "vụ việc", "đơn thư". */
  resourceLabel: string;
  actions: BulkAction<TRow>[];
  /**
   * Optional: fetch tất cả ids khớp filter hiện tại (cho 'all-matching-filter' mode).
   * Caller list page implement và pass qua adapter.
   */
  fetchAllIdsMatchingFilter?: () => Promise<string[]>;
}
