import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import {
  BTN_DANGER,
  BTN_OUTLINE_SLATE,
  A11Y_FOCUS_RING,
} from '@/constants/styles';

/**
 * v0.62 PR1a — Singleton DeleteResourceModal provider.
 *
 * One <DeleteConfirmDialog> mounted at App root, triggered imperatively via
 * useDeleteResourceModal().open(args).
 *
 * Issues DELETE /{resource}/{id} on confirm. Calls onSuccess to refetch.
 *
 * Future: extend with delete-preflight (willUnlink banner) per legacy
 * CaseListPage.tsx:460-700. For now simple confirm + delete (matches
 * Lawyers/Subjects v0.51 pattern).
 */

export type DeleteResourceType =
  | 'cases'
  | 'incidents'
  | 'petitions'
  | 'lawyers'
  | 'subjects';

export interface DeleteResourceArgs {
  resourceType: DeleteResourceType;
  recordId: string;
  recordLabel?: string;
  onSuccess?: () => void;
}

export interface DeleteResourceModalApi {
  open: (args: DeleteResourceArgs) => void;
}

const DeleteResourceContext = createContext<DeleteResourceModalApi | null>(null);

export function DeleteResourceModalProvider({ children }: { children: ReactNode }) {
  const [args, setArgs] = useState<DeleteResourceArgs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((next: DeleteResourceArgs) => {
    setArgs(next);
    setError(null);
  }, []);

  const close = useCallback(() => {
    setArgs(null);
    setError(null);
  }, []);

  const confirm = useCallback(async () => {
    if (!args) return;
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/${args.resourceType}/${args.recordId}`);
      args.onSuccess?.();
      close();
    } catch (e) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Xóa thất bại',
      );
    } finally {
      setLoading(false);
    }
  }, [args, close]);

  const apiObj = useMemo<DeleteResourceModalApi>(() => ({ open }), [open]);

  return (
    <DeleteResourceContext.Provider value={apiObj}>
      {children}
      {args && (
        <div
          data-testid="delete-confirm-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" aria-hidden="true" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900">Xác nhận xóa</h2>
                <p className="mt-1 text-sm text-slate-700">
                  Bạn có chắc muốn xóa{' '}
                  <strong>{args.recordLabel ?? args.recordId}</strong>?
                </p>
                <p className="mt-2 text-xs text-red-600">
                  Hành động này không thể hoàn tác.
                </p>
                {error && (
                  <p
                    role="alert"
                    className="mt-2 rounded bg-red-50 px-2 py-1 text-xs text-red-700"
                  >
                    {error}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                data-testid="btn-cancel-delete"
                className={`${BTN_OUTLINE_SLATE} ${A11Y_FOCUS_RING}`}
                onClick={close}
                disabled={loading}
              >
                Hủy
              </button>
              <button
                type="button"
                data-testid="btn-confirm-delete"
                className={`${BTN_DANGER} ${A11Y_FOCUS_RING} inline-flex items-center gap-1.5`}
                onClick={confirm}
                disabled={loading}
              >
                <Trash2 className="w-4 h-4" />
                {loading ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DeleteResourceContext.Provider>
  );
}

export function useDeleteResourceModal(): DeleteResourceModalApi {
  const ctx = useContext(DeleteResourceContext);
  if (!ctx) {
    throw new Error(
      'useDeleteResourceModal must be used inside <DeleteResourceModalProvider>',
    );
  }
  return ctx;
}
