import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { taoNhanhDanhMuc } from '@/locales/vi';
import {
  QuickCreateDirectoryCtx,
  type QuickCreateDirectoryApi,
  type QuickCreateDirectoryArgs,
} from './useQuickCreateDirectoryModal';

/**
 * Tạo nhanh một mục danh mục ngay trên ô tìm của form.
 *
 * Vì sao cần: danh mục "Đơn vị xử lý" chỉ có 5 dòng trong khi dữ liệu cũ có ~1.868 đơn vị. Kể
 * cả sau khi nạp hết, cán bộ vẫn gặp đơn vị chưa có — trước bản này họ không có đường nào ngoài
 * việc nhờ ADMIN thêm hộ. Từ 14/09/2026 ô "Loại thông tin" dùng chung popup; câu chữ lấy theo
 * loại danh mục ở `taoNhanhDanhMuc`.
 *
 * Khuôn provider singleton chép từ `PrintDocumentsModalProvider`: một thể hiện ở gốc cây, mở
 * bằng lời gọi hàm (`useQuickCreateDirectoryModalSafe`).
 */
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
  // Câu chữ theo loại danh mục đang tạo — popup dùng chung cho Đơn vị xử lý và Loại thông tin.
  const cauChu = useMemo(() => taoNhanhDanhMuc(args?.type ?? ''), [args?.type]);

  const luu = useCallback(async () => {
    if (!args) return;
    const sach = ten.trim();
    if (!sach) {
      setLoi(cauChu.loiRong);
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
  }, [args, ten, cauChu]);

  const chonBanDaCo = useCallback(() => {
    args?.onCreated?.(ten.trim());
    setArgs(null);
  }, [args, ten]);

  return (
    <QuickCreateDirectoryCtx.Provider value={apiObj}>
      {children}
      {args && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          data-testid="quick-create-directory-modal"
        >
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-800">
                {args.nhanTitle ?? cauChu.tieuDe}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{cauChu.moTa}</p>
            </div>
            <div className="space-y-3 p-5">
              <label className="block text-sm font-medium text-slate-700">{cauChu.nhanTen}</label>
              <input
                autoFocus
                value={ten}
                onChange={(e) => {
                  setTen(e.target.value);
                  setDaCoSan(false);
                }}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={cauChu.goiY}
                data-testid="quick-create-directory-name"
              />
              {daCoSan && (
                <p
                  className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800"
                  data-testid="quick-create-directory-da-co"
                >
                  {cauChu.daCo(ten)}
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
                {cauChu.nutHuy}
              </button>
              {daCoSan ? (
                <button
                  type="button"
                  onClick={chonBanDaCo}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                  data-testid="quick-create-directory-use-existing"
                >
                  {cauChu.nutDungDaCo}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={luu}
                  disabled={dangLuu}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                  data-testid="quick-create-directory-save"
                >
                  {dangLuu ? cauChu.dangTao : cauChu.nutTao}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </QuickCreateDirectoryCtx.Provider>
  );
}
