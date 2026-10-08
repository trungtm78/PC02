import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface BangThaoTacDuoiProps {
  mo: boolean;
  onDong: () => void;
  /** Tên bảng cho trình đọc màn hình và dòng tiêu đề, vd mã hồ sơ. */
  tieuDe: string;
  children: ReactNode;
}

const DIEM_DUNG_TIEU_DIEM =
  'button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Bảng thao tác trượt từ đáy màn hình — thay menu nổi `ActionMenuPortal` trên điện thoại (≤767px).
 *
 * Menu nổi neo theo toạ độ nút ⋮ nên trên màn 360px nó bị cắt mép hoặc che nút; bảng đáy luôn nằm trọn khung nhìn, mục
 * cao 48px bấm bằng ngón cái (Material 3 bottom sheet / iOS action sheet).
 *
 * Hành vi bắt buộc của hộp thoại:
 *  - render qua portal ra `document.body` (không bị `overflow` của bảng cắt),
 *  - nền mờ bấm vào là đóng, Escape đóng,
 *  - bẫy phím Tab trong bảng, đóng xong trả tiêu điểm về nút đã mở nó,
 *  - khoá cuộn nền khi mở và MỞ KHOÁ khi đóng/gỡ (kể cả khi bảng bị gỡ lúc đang mở, vd danh sách tải lại),
 *  - chừa vùng an toàn đáy (tai thỏ / thanh home của iPhone).
 */
export function BangThaoTacDuoi({ mo, onDong, tieuDe, children }: BangThaoTacDuoiProps) {
  const bangRef = useRef<HTMLDivElement | null>(null);
  // Giữ onDong mới nhất mà không buộc effect chạy lại (và cướp tiêu điểm) mỗi lần cha dựng lại.
  const onDongRef = useRef(onDong);
  onDongRef.current = onDong;

  useEffect(() => {
    if (!mo) return;
    const truoc = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflowCu = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const bang = bangRef.current;
    const dauTien = bang?.querySelector<HTMLElement>(DIEM_DUNG_TIEU_DIEM);
    (dauTien ?? bang)?.focus();

    return () => {
      document.body.style.overflow = overflowCu;
      if (truoc && document.contains(truoc)) truoc.focus();
    };
  }, [mo]);

  if (!mo) return null;

  const khiBamPhim = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onDongRef.current();
      return;
    }
    if (e.key !== 'Tab') return;
    const ds = Array.from(bangRef.current?.querySelectorAll<HTMLElement>(DIEM_DUNG_TIEU_DIEM) ?? []);
    if (ds.length === 0) {
      e.preventDefault();
      return;
    }
    const dau = ds[0];
    const cuoi = ds[ds.length - 1];
    const dangO = document.activeElement;
    if (e.shiftKey && (dangO === dau || dangO === bangRef.current)) {
      e.preventDefault();
      cuoi.focus();
    } else if (!e.shiftKey && dangO === cuoi) {
      e.preventDefault();
      dau.focus();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60]" data-testid="bang-thao-tac-duoi-vung">
      <div
        aria-hidden="true"
        data-testid="bang-thao-tac-duoi-nen"
        className="absolute inset-0 bg-slate-900/50"
        onClick={(e) => {
          e.stopPropagation();
          onDongRef.current();
        }}
      />
      <div
        ref={bangRef}
        role="dialog"
        aria-modal="true"
        aria-label={tieuDe}
        tabIndex={-1}
        data-testid="bang-thao-tac-duoi"
        onKeyDown={khiBamPhim}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl focus:outline-none"
      >
        <div className="sticky top-0 z-10 bg-white px-4 pt-3 pb-2 border-b border-slate-100">
          <div aria-hidden="true" className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300" />
          <p className="truncate text-sm font-semibold text-slate-700">{tieuDe}</p>
        </div>
        <div role="group" aria-label="Thao tác" className="py-1">
          {children}
        </div>
        <div className="border-t border-slate-100 p-2">
          <button
            type="button"
            data-testid="bang-thao-tac-duoi-huy"
            onClick={() => onDongRef.current()}
            className="w-full min-h-12 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Huỷ
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
