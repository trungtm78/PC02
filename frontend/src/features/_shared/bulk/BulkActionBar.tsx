import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { ConfirmModal } from '@/components/shared/Modal';
import { usePermission } from '@/hooks/usePermission';
import type { UseBulkSelectionResult } from './useBulkSelection';
import type { BulkAdapter, BulkAction, BulkResult } from './types';

/**
 * v0.48 PR1 F2 — Bulk action bar, sticky-bottom.
 *
 * Layout (plan v2 D-H7): `flex items-center justify-between h-14 px-4`,
 *   left = "Đã chọn N / total · [Bỏ chọn]", right = action buttons gap-2.
 * Z-index: z-30 (above content, below modal z-40, below FormActionBar z-50).
 * Animation: slide-up `transition-transform duration-200 ease-out translate-y-0`.
 *
 * Escalating friction (D-H6):
 * - 1–10 items: simple confirm + reason.
 * - 11–50: confirm + reason (UI nhấn mạnh count).
 * - 51–200: + checkbox "Tôi đã xem danh sách N mục".
 * - > 200: blocked, hiện thông báo phải refine filter (chỉ all-matching-filter mới đạt được).
 *
 * Permission gating: filter actions theo `usePermission().hasPermission(resource, perm)`.
 * Nếu sau filter 0 action → hiện greyed message "Không có thao tác nào khả dụng với quyền hiện tại."
 */

interface Props<TRow = unknown> {
  selection: UseBulkSelectionResult;
  adapter: BulkAdapter<TRow>;
  pageRows: TRow[];
  onSuccess?: (result: BulkResult | void, action: BulkAction<TRow>) => void;
  onError?: (error: unknown, action: BulkAction<TRow>) => void;
}

export function BulkActionBar<TRow = unknown>({
  selection,
  adapter,
  pageRows,
  onSuccess,
  onError,
}: Props<TRow>) {
  const { hasPermission } = usePermission();
  const [pendingAction, setPendingAction] = useState<BulkAction<TRow> | null>(null);
  const [reason, setReason] = useState('');
  const [acknowledgedLargeSet, setAcknowledgedLargeSet] = useState(false);
  const [executing, setExecuting] = useState(false);

  if (selection.count === 0) return null;

  // Frontend 'view' → backend 'read' translate (plan eng E-C3).
  const translateAction = (a: BulkAction<TRow>['permission']['action']) =>
    a === 'view' ? 'view' : a;
  const visibleActions = adapter.actions.filter((a) =>
    hasPermission(a.permission.resource, translateAction(a.permission.action)),
  );

  const count = selection.count;
  const ids = Array.from(selection.selectedIds);

  const handleExecute = async () => {
    if (!pendingAction) return;
    setExecuting(true);
    try {
      const result = await pendingAction.execute({
        ids,
        reason: reason.trim() || undefined,
      });
      selection.clear();
      onSuccess?.(result, pendingAction);
    } catch (err) {
      onError?.(err, pendingAction);
    } finally {
      setExecuting(false);
      setPendingAction(null);
      setReason('');
      setAcknowledgedLargeSet(false);
    }
  };

  const openConfirm = (action: BulkAction<TRow>) => {
    setPendingAction(action);
    setReason('');
    setAcknowledgedLargeSet(false);
  };

  // Escalating friction thresholds.
  const requiresReason = pendingAction != null && pendingAction.requiresPreview;
  const requiresLargeAck = count > 50 && pendingAction != null && pendingAction.requiresPreview;
  const blocked = count > 200 && pendingAction != null && pendingAction.requiresPreview;

  const canConfirm =
    !!pendingAction &&
    !executing &&
    !blocked &&
    (!requiresReason || reason.trim().length >= 10) &&
    (!requiresLargeAck || acknowledgedLargeSet);

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 shadow-lg"
      >
        <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-4 sm:px-6 gap-3">
          {/* Left: count + clear */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={selection.clear}
              aria-label="Bỏ chọn"
              className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <X size={16} />
            </button>
            <span className="text-sm font-medium text-slate-700 truncate">
              Đã chọn <strong className="text-blue-600">{count}</strong> {adapter.resourceLabel}
              {selection.mode === 'all-matching-filter' && (
                <span className="ml-1 text-xs text-slate-500">(tất cả khớp lọc)</span>
              )}
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {visibleActions.length === 0 ? (
              <span className="text-xs text-slate-500">
                Không có thao tác nào khả dụng với quyền hiện tại.
              </span>
            ) : (
              visibleActions.map((action) => {
                const isAllMatchingMode = selection.mode === 'all-matching-filter';
                const disabledForMode = isAllMatchingMode && !action.allowsAllMatchingFilter;
                return (
                  <button
                    key={action.key}
                    type="button"
                    onClick={() => openConfirm(action)}
                    disabled={disabledForMode}
                    aria-disabled={disabledForMode}
                    title={
                      disabledForMode
                        ? 'Chỉ áp dụng cho Xuất Excel khi chọn tất cả theo lọc'
                        : undefined
                    }
                    className={[
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                      action.variant === 'primary' &&
                        'bg-blue-600 text-white hover:bg-blue-700',
                      action.variant === 'danger' &&
                        'bg-red-600 text-white hover:bg-red-700',
                      action.variant === 'outline' &&
                        'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                      disabledForMode && 'opacity-50 cursor-not-allowed',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {action.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Confirm modal — escalating friction */}
      {pendingAction && (
        <ConfirmModal
          open
          onClose={() => {
            setPendingAction(null);
            setReason('');
            setAcknowledgedLargeSet(false);
          }}
          onConfirm={() => {
            if (canConfirm) handleExecute();
          }}
          title={`${pendingAction.label} ${count} ${adapter.resourceLabel}`}
          confirmLabel={executing ? 'Đang xử lý...' : 'Xác nhận'}
          cancelLabel="Hủy"
          variant={pendingAction.variant === 'danger' ? 'danger' : 'default'}
          message={
            <div className="space-y-3">
              {blocked && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    Số mục đã chọn vượt 200. Vui lòng thu hẹp bộ lọc hoặc chia thành
                    nhiều đợt nhỏ hơn.
                  </div>
                </div>
              )}
              {!blocked && (
                <div className="text-sm text-slate-700">
                  Thao tác sẽ áp dụng cho <strong>{count}</strong>{' '}
                  {adapter.resourceLabel} đã chọn.
                </div>
              )}
              {requiresReason && !blocked && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Lý do <span className="text-red-500">*</span> (tối thiểu 10 ký tự)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    maxLength={500}
                    placeholder="Vd: Phân công lại đợt mới theo công văn..."
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <div className="mt-1 text-xs text-slate-500 text-right">
                    {reason.length}/500
                  </div>
                </div>
              )}
              {requiresLargeAck && !blocked && (
                <label className="flex items-start gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={acknowledgedLargeSet}
                    onChange={(e) => setAcknowledgedLargeSet(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>
                    Tôi đã xem danh sách <strong>{count}</strong>{' '}
                    {adapter.resourceLabel} sắp bị áp dụng và xác nhận thao tác.
                  </span>
                </label>
              )}
            </div>
          }
        />
      )}
    </>
  );
}

// Export pageRows-aware sub-helpers for adapters that need per-row eligibility checks.
// (Currently unused — wired via BulkSelectionRowCell directly.)
export type { BulkAdapter, BulkAction, BulkResult };
