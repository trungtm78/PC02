import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';

/**
 * Tạo nhanh một mục danh mục ngay trên ô tìm của form.
 *
 * Vì sao cần: danh mục "Đơn vị xử lý" chỉ có 5 dòng trong khi dữ liệu cũ có ~1.868 đơn vị. Kể
 * cả sau khi nạp hết, cán bộ vẫn gặp đơn vị chưa có — trước bản này họ không có đường nào ngoài
 * việc nhờ ADMIN thêm hộ.
 *
 * Khuôn provider singleton chép từ `PrintDocumentsModalProvider`: một thể hiện ở gốc cây, mở
 * bằng lời gọi hàm.
 */
export interface QuickCreateDirectoryArgs {
  type: string;
  /** Chữ cán bộ vừa gõ ở ô tìm — điền sẵn để họ không phải gõ lại. */
  tenGoiY?: string;
  nhanTitle?: string;
  /** Gọi sau khi tạo xong (hoặc tìm thấy bản đã có) với TÊN để chọn ngay. */
  onCreated?: (ten: string) => void;
}

export interface QuickCreateDirectoryApi {
  open: (args: QuickCreateDirectoryArgs) => void;
}

const Ctx = createContext<QuickCreateDirectoryApi | null>(null);

export function QuickCreateDirectoryModalProvider({ children }: { children: ReactNode }) {
  const [args, setArgs] = useState<QuickCreateDirectoryArgs | null>(null);
  const [ten, setTen] = useState('');
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [daCoSan, setDaCoSan] = useState(false);

  useEffect(() => {
    setTen(args?.tenGoiY ?? '');
    setLoi(null);
    setDaCoSan(false);
  }, [args]);

  const open = useCallback((next: QuickCreateDirectoryArgs) => setArgs(next), []);
  const close = useCallback(() => setArgs(null), []);
  const apiObj = useMemo<QuickCreateDirectoryApi>(() => ({ open }), [open]);

  const luu = useCallback(async () => {
    if (!args) return;
    const sach = ten.trim();
    if (!sach) {
      setLoi('Tên đơn vị không được để trống');
      return;
    }
    setDangLuu(true);
    setLoi(null);
    try {
      const res = await api.post('/directories/quick', { type: args.type, name: sach });
      const d = res.data as { name: string; daCoSan?: boolean };
      // Máy chủ chặn trùng bằng cùng bộ luật đã gộp dữ liệu cũ. Nói RÕ là đã có sẵn thay vì
      // lặng lẽ chọn — im lặng thì cán bộ tưởng vừa tạo mới, lần sau lại gõ thêm một biến thể.
      if (d.daCoSan) {
        setDaCoSan(true);
        setTen(d.name);
        setDangLuu(false);
        return;
      }
      args.onCreated?.(d.name);
      setArgs(null);
    } catch (e) {
      setLoi(extractApiError(e).message);
    } finally {
      setDangLuu(false);
    }
  }, [args, ten]);

  const chonBanDaCo = useCallback(() => {
    args?.onCreated?.(ten.trim());
    setArgs(null);
  }, [args, ten]);

  return (
    <Ctx.Provider value={apiObj}>
      {children}
      {args && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          data-testid="quick-create-directory-modal"
        >
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-800">
                {args.nhanTitle ?? 'Tạo đơn vị xử lý'}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Đơn vị tạo ở đây dùng được ngay và cần quản trị duyệt lại sau.
              </p>
            </div>
            <div className="space-y-3 p-5">
              <label className="block text-sm font-medium text-slate-700">Tên đơn vị</label>
              <input
                autoFocus
                value={ten}
                onChange={(e) => {
                  setTen(e.target.value);
                  setDaCoSan(false);
                }}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ví dụ: Công an phường Bến Nghé"
                data-testid="quick-create-directory-name"
              />
              {daCoSan && (
                <p
                  className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
                  data-testid="quick-create-directory-da-co"
                >
                  Đơn vị này đã có trong danh mục với tên "{ten}". Bấm "Dùng đơn vị đã có" để
                  chọn, tránh tạo hai dòng cho cùng một đơn vị.
                </p>
              )}
              {loi && (
                <p className="text-sm text-red-600" data-testid="quick-create-directory-error">
                  {loi}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                type="button"
                onClick={close}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
                data-testid="quick-create-directory-cancel"
              >
                Huỷ
              </button>
              {daCoSan ? (
                <button
                  type="button"
                  onClick={chonBanDaCo}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                  data-testid="quick-create-directory-use-existing"
                >
                  Dùng đơn vị đã có
                </button>
              ) : (
                <button
                  type="button"
                  onClick={luu}
                  disabled={dangLuu}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  data-testid="quick-create-directory-save"
                >
                  {dangLuu ? 'Đang tạo…' : 'Tạo'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/**
 * Bản KHÔNG ném lỗi khi chưa có provider — form Đơn thư được dựng trong ca kiểm và trong vài
 * màn không bọc CompositeModalProvider. Ném ở đó là làm trắng màn hình vì một tính năng phụ.
 */
export function useQuickCreateDirectoryModalSafe(): QuickCreateDirectoryApi | null {
  return useContext(Ctx);
}
