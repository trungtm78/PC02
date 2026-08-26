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
  | 'subjects'
  | 'document-templates';

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

/**
 * Tài nguyên mà máy chủ BẮT BUỘC kèm lý do khi xóa.
 *
 * `DeleteCaseDto` và `DeleteIncidentDto` đòi `reason` dài 10–500 ký tự. Hộp thoại trước nay
 * gửi lệnh xóa không kèm thân nên mọi lần xóa vụ án đều trả 400: cán bộ bấm Xóa, hộp thoại
 * đóng lại như đã xong, hồ sơ vẫn còn nguyên trong danh sách.
 */
const CAN_LY_DO: ReadonlySet<DeleteResourceType> = new Set(['cases', 'incidents']);

/** Cùng ngưỡng với DTO máy chủ — chặn tại chỗ thay vì để máy chủ trả 400. */
const LY_DO_TOI_THIEU = 10;
const LY_DO_TOI_DA = 500;

export function DeleteResourceModalProvider({ children }: { children: ReactNode }) {
  const [args, setArgs] = useState<DeleteResourceArgs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lyDo, setLyDo] = useState('');

  const canLyDo = args ? CAN_LY_DO.has(args.resourceType) : false;
  const lyDoHopLe =
    lyDo.trim().length >= LY_DO_TOI_THIEU && lyDo.trim().length <= LY_DO_TOI_DA;

  const open = useCallback((next: DeleteResourceArgs) => {
    setArgs(next);
    setError(null);
    setLyDo('');
  }, []);

  const close = useCallback(() => {
    setArgs(null);
    setError(null);
    setLyDo('');
  }, []);

  const confirm = useCallback(async () => {
    if (!args) return;
    const duong = `/${args.resourceType}/${args.recordId}`;
    setLoading(true);
    setError(null);
    try {
      if (CAN_LY_DO.has(args.resourceType)) {
        await api.delete(duong, { data: { reason: lyDo.trim() } });
      } else {
        await api.delete(duong);
      }
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
  }, [args, close, lyDo]);

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
                  {canLyDo
                    ? 'Hồ sơ sẽ bị gỡ khỏi danh sách. Lý do được ghi vào nhật ký.'
                    : 'Hành động này không thể hoàn tác.'}
                </p>
                {canLyDo && (
                  <div className="mt-3">
                    <label
                      htmlFor="ly-do-xoa"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Lý do xóa <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="ly-do-xoa"
                      data-testid="input-ly-do-xoa"
                      rows={3}
                      value={lyDo}
                      maxLength={LY_DO_TOI_DA}
                      onChange={(e) => setLyDo(e.target.value)}
                      placeholder="Vì sao gỡ hồ sơ này? (ít nhất 10 ký tự)"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-400"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {lyDo.trim().length}/{LY_DO_TOI_DA} ký tự — tối thiểu {LY_DO_TOI_THIEU}.
                    </p>
                  </div>
                )}
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
                disabled={loading || (canLyDo && !lyDoHopLe)}
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

/**
 * Biến thể KHÔNG ném lỗi — trả null nếu chưa có Provider.
 * Dùng ở nơi tính năng là tùy chọn (vd phím tắt Xóa trên form) để component vẫn render
 * được trong test/context không bọc Provider.
 */
export function useDeleteResourceModalSafe(): DeleteResourceModalApi | null {
  return useContext(DeleteResourceContext);
}
