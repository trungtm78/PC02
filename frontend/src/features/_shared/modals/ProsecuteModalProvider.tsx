import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { AlertTriangle, AlertCircle, X } from 'lucide-react';
import { api } from '@/lib/api';
import {
  BTN_PRIMARY,
  BTN_OUTLINE_SLATE,
  A11Y_FOCUS_RING,
} from '@/constants/styles';
import { useModalLifecycle } from './useModalLifecycle';

/**
 * v0.67 PR1 T5 — ProsecuteModalProvider.
 *
 * Khởi tố Vụ việc → tạo Vụ án chính thức (BLTTHS).
 * Backend: POST /incidents/:id/prosecute → atomic transaction tạo Case +
 * đổi incident.status = DA_CHUYEN_VU_AN. Response includes new case.id
 * for frontend navigation.
 *
 * onSuccess callback nhận `caseId` để caller (consumer) navigate sang
 * /cases/:caseId.
 */

export interface ProsecuteArgs {
  recordId: string;
  incidentName: string;
  currentUpdatedAt?: string;
  onSuccess?: (caseId: string) => void;
}

export interface ProsecuteModalApi {
  open: (args: ProsecuteArgs) => void;
}

const ProsecuteContext = createContext<ProsecuteModalApi | null>(null);

const INPUT_BASE =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100';
const LABEL_BASE = 'block text-sm font-medium text-slate-700 mb-1';

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface ProsecuteResponse {
  incident?: { id: string };
  case?: { id: string };
}

export function ProsecuteModalProvider({ children }: { children: ReactNode }) {
  const [caseName, setCaseName] = useState<string>('');
  const [prosecutionDecision, setProsecutionDecision] = useState<string>('');
  const [prosecutionDate, setProsecutionDate] = useState<string>(todayIso());
  const [crime, setCrime] = useState<string>('');

  const lifecycle = useModalLifecycle<
    ProsecuteArgs,
    ProsecuteResponse,
    {
      caseName: string;
      prosecutionDecision: string;
      prosecutionDate?: string;
      crime?: string;
      expectedUpdatedAt?: string;
    }
  >({
    // @ts-expect-error TS2719: tsc -b (composite) sinh 2 định danh ProsecuteArgs của cùng module → báo "unrelated".
    // Type thực tế khớp, runtime đúng (đã verify test). Quirk type-checker, không phải lỗi logic.
    submitFn: async (args, payload) => {
      const response = await api.post(`/incidents/${args.recordId}/prosecute`, payload);
      const data = response.data as { data?: ProsecuteResponse } | ProsecuteResponse;
      return ('data' in data ? data.data : data) ?? {};
    },
    onSuccess: (result, args) => {
      const caseId = result?.case?.id;
      if (caseId) args.onSuccess?.(caseId);
    },
  });

  // Pre-fill caseName from incidentName when modal opens
  useEffect(() => {
    if (lifecycle.args) {
      setCaseName(lifecycle.args.incidentName ?? '');
      setProsecutionDecision('');
      setProsecutionDate(todayIso());
      setCrime('');
    }
  }, [lifecycle.args]);

  const open = useCallback(
    (args: ProsecuteArgs) => {
      lifecycle.open(args);
    },
    [lifecycle],
  );

  const close = useCallback(() => {
    lifecycle.close();
  }, [lifecycle]);

  const apiObj = useMemo<ProsecuteModalApi>(() => ({ open }), [open]);

  const canSubmit =
    caseName.trim().length > 0 && prosecutionDecision.trim().length > 0;

  const handleSubmit = async () => {
    if (!lifecycle.args || !canSubmit) return;
    await lifecycle.submit({
      caseName: caseName.trim(),
      prosecutionDecision: prosecutionDecision.trim(),
      prosecutionDate: prosecutionDate || undefined,
      crime: crime.trim() || undefined,
      expectedUpdatedAt: lifecycle.args.currentUpdatedAt,
    });
  };

  return (
    <ProsecuteContext.Provider value={apiObj}>
      {children}
      {lifecycle.isOpen && lifecycle.args && (
        <div
          data-testid="prosecute-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Khởi tố Vụ án</h2>
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

            <div className="mt-3 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                Vụ việc sẽ được chuyển thành Vụ án và{' '}
                <strong>không thể hoàn tác</strong>.
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className={LABEL_BASE} htmlFor="prosecute-case-name">
                  Tên vụ án <span className="text-red-500">*</span>
                </label>
                <input
                  id="prosecute-case-name"
                  data-testid="field-case-name"
                  type="text"
                  value={caseName}
                  onChange={(e) => setCaseName(e.target.value)}
                  className={INPUT_BASE}
                  disabled={lifecycle.isLoading}
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={LABEL_BASE} htmlFor="prosecute-decision">
                    Số quyết định khởi tố <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="prosecute-decision"
                    data-testid="field-prosecution-decision"
                    type="text"
                    value={prosecutionDecision}
                    onChange={(e) => setProsecutionDecision(e.target.value)}
                    className={INPUT_BASE}
                    disabled={lifecycle.isLoading}
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className={LABEL_BASE} htmlFor="prosecute-date">
                    Ngày quyết định
                  </label>
                  <input
                    id="prosecute-date"
                    data-testid="field-prosecution-date"
                    type="date"
                    value={prosecutionDate}
                    onChange={(e) => setProsecutionDate(e.target.value)}
                    className={INPUT_BASE}
                    disabled={lifecycle.isLoading}
                  />
                </div>
              </div>

              <div>
                <label className={LABEL_BASE} htmlFor="prosecute-crime">
                  Tội danh
                </label>
                <input
                  id="prosecute-crime"
                  data-testid="field-crime"
                  type="text"
                  value={crime}
                  onChange={(e) => setCrime(e.target.value)}
                  className={INPUT_BASE}
                  disabled={lifecycle.isLoading}
                  maxLength={255}
                  placeholder="Trộm cắp tài sản, Cướp giật, ..."
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
                data-testid="btn-cancel-prosecute"
                className={`${BTN_OUTLINE_SLATE} ${A11Y_FOCUS_RING}`}
                onClick={close}
                disabled={lifecycle.isLoading}
              >
                Hủy
              </button>
              <button
                type="button"
                data-testid="btn-confirm-prosecute"
                className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING}`}
                onClick={handleSubmit}
                disabled={!canSubmit || lifecycle.isLoading}
              >
                {lifecycle.isLoading ? 'Đang khởi tố...' : 'Khởi tố'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ProsecuteContext.Provider>
  );
}

export function useProsecuteModal(): ProsecuteModalApi {
  const ctx = useContext(ProsecuteContext);
  if (!ctx) {
    throw new Error(
      'useProsecuteModal must be used inside <ProsecuteModalProvider>',
    );
  }
  return ctx;
}
