import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, X } from 'lucide-react';
import { api } from '@/lib/api';
import { INCIDENT_VALID_TRANSITIONS } from '@/shared/enums/incident-transitions.generated';
import { INCIDENT_STATUS_LABEL } from '@/shared/enums/status-labels';
import { LyDoKhongKhoiTo } from '@/shared/enums/generated';
import {
  BTN_PRIMARY,
  BTN_OUTLINE_SLATE,
  A11Y_FOCUS_RING,
} from '@/constants/styles';
import { useModalLifecycle } from './useModalLifecycle';

/**
 * v0.67 PR1 T4 — StatusTransitionModalProvider (Issue I1+I2+I4 applied).
 *
 * Cán bộ ĐTV chuyển trạng thái Vụ việc theo state machine VALID_TRANSITIONS.
 * Modal hiển thị dropdown chỉ các trạng thái hợp lệ + conditional lyDoKhongKhoiTo
 * khi chọn KHONG_KHOI_TO (Điều 157 BLTTHS).
 */

export interface StatusTransitionArgs {
  recordId: string;
  currentStatus: string;
  currentUpdatedAt?: string;
  onSuccess?: () => void;
}

export interface StatusTransitionModalApi {
  open: (args: StatusTransitionArgs) => void;
}

const StatusTransitionContext = createContext<StatusTransitionModalApi | null>(null);

const INPUT_BASE =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100';
const LABEL_BASE = 'block text-sm font-medium text-slate-700 mb-1';

function getValidTransitions(currentStatus: string): string[] {
  return (
    (INCIDENT_VALID_TRANSITIONS as Record<string, readonly string[]>)[currentStatus] ?? []
  ).slice();
}

export function StatusTransitionModalProvider({ children }: { children: ReactNode }) {
  const [targetStatus, setTargetStatus] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [lyDoKhongKhoiTo, setLyDoKhongKhoiTo] = useState<string>('');

  const lifecycle = useModalLifecycle<
    StatusTransitionArgs,
    { success: boolean },
    {
      status: string;
      note?: string;
      lyDoKhongKhoiTo?: string;
      expectedUpdatedAt?: string;
    }
  >({
    submitFn: async (args, payload) => {
      const response = await api.patch(`/incidents/${args.recordId}/status`, payload);
      return (response.data as { success: boolean }) ?? { success: true };
    },
    onSuccess: (_, args) => {
      args.onSuccess?.();
    },
  });

  const reset = useCallback(() => {
    setTargetStatus('');
    setNote('');
    setLyDoKhongKhoiTo('');
  }, []);

  const open = useCallback(
    (args: StatusTransitionArgs) => {
      reset();
      lifecycle.open(args);
    },
    [lifecycle, reset],
  );

  const close = useCallback(() => {
    reset();
    lifecycle.close();
  }, [lifecycle, reset]);

  const apiObj = useMemo<StatusTransitionModalApi>(() => ({ open }), [open]);

  const requiresLyDo = targetStatus === 'KHONG_KHOI_TO';
  const canSubmit =
    targetStatus !== '' && (!requiresLyDo || lyDoKhongKhoiTo !== '');

  const handleSubmit = async () => {
    if (!lifecycle.args || !canSubmit) return;
    await lifecycle.submit({
      status: targetStatus,
      note: note || undefined,
      lyDoKhongKhoiTo: requiresLyDo ? lyDoKhongKhoiTo : undefined,
      expectedUpdatedAt: lifecycle.args.currentUpdatedAt,
    });
  };

  const validOptions = lifecycle.args
    ? getValidTransitions(lifecycle.args.currentStatus)
    : [];

  return (
    <StatusTransitionContext.Provider value={apiObj}>
      {children}
      {lifecycle.isOpen && lifecycle.args && (
        <div
          data-testid="status-transition-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Chuyển trạng thái Vụ việc</h2>
              <button
                type="button"
                onClick={close}
                disabled={lifecycle.isLoading}
                className={`p-1 rounded hover:bg-slate-100 ${A11Y_FOCUS_RING}`}
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Trạng thái hiện tại:{' '}
              <strong>
                {INCIDENT_STATUS_LABEL[
                  lifecycle.args.currentStatus as keyof typeof INCIDENT_STATUS_LABEL
                ] ?? lifecycle.args.currentStatus}
              </strong>
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className={LABEL_BASE} htmlFor="transition-status-select">
                  Chuyển sang trạng thái <span className="text-red-500">*</span>
                </label>
                <select
                  id="transition-status-select"
                  data-testid="status-transition-select"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  className={INPUT_BASE}
                  disabled={lifecycle.isLoading}
                >
                  <option value="">— Chọn trạng thái —</option>
                  {validOptions.map((s) => (
                    <option key={s} value={s}>
                      {INCIDENT_STATUS_LABEL[s as keyof typeof INCIDENT_STATUS_LABEL] ?? s}
                    </option>
                  ))}
                </select>
                {validOptions.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    Trạng thái hiện tại không có phép chuyển tiếp.
                  </p>
                )}
              </div>

              {requiresLyDo && (
                <div data-testid="field-ly-do-khong-khoi-to">
                  <label className={LABEL_BASE} htmlFor="ly-do-select">
                    Lý do không khởi tố <span className="text-red-500">*</span>
                    <span className="text-xs text-slate-500"> (Điều 157 BLTTHS)</span>
                  </label>
                  <select
                    id="ly-do-select"
                    data-testid="ly-do-khong-khoi-to-select"
                    value={lyDoKhongKhoiTo}
                    onChange={(e) => setLyDoKhongKhoiTo(e.target.value)}
                    className={INPUT_BASE}
                    disabled={lifecycle.isLoading}
                  >
                    <option value="">— Chọn lý do —</option>
                    {Object.values(LyDoKhongKhoiTo).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={LABEL_BASE} htmlFor="transition-note">
                  Ghi chú
                </label>
                <textarea
                  id="transition-note"
                  data-testid="transition-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className={INPUT_BASE}
                  disabled={lifecycle.isLoading}
                  placeholder="Ghi chú thêm (tuỳ chọn)"
                />
              </div>

              {lifecycle.error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{lifecycle.error}</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                data-testid="btn-cancel-transition"
                className={`${BTN_OUTLINE_SLATE} ${A11Y_FOCUS_RING}`}
                onClick={close}
                disabled={lifecycle.isLoading}
              >
                Hủy
              </button>
              <button
                type="button"
                data-testid="btn-confirm-transition"
                className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING}`}
                onClick={handleSubmit}
                disabled={!canSubmit || lifecycle.isLoading}
              >
                {lifecycle.isLoading ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}
    </StatusTransitionContext.Provider>
  );
}

export function useStatusTransitionModal(): StatusTransitionModalApi {
  const ctx = useContext(StatusTransitionContext);
  if (!ctx) {
    throw new Error(
      'useStatusTransitionModal must be used inside <StatusTransitionModalProvider>',
    );
  }
  return ctx;
}
