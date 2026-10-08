import { useCallback, useMemo, type KeyboardEvent, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCauHinhGiaoDien } from './useCauHinhGiaoDien';
import { MAN_BAM_DONG, type ManBamDong } from '@/constants/giaoDienSettings';
import {
  xuLyAuxClickDong,
  xuLyClickDong,
  xuLyDoubleClickDong,
} from '@/components/shared/ListPageShell/bamDong';

export interface TuyChonUseBamDong<TRow> {
  /** Trang xem chi tiết của dòng. */
  hrefXem: (row: TRow) => string;
  /** Trang sửa. Không truyền = màn này không có trang sửa riêng (cấu hình SUA rơi về xem). */
  hrefSua?: (row: TRow) => string;
  /** Người dùng có quyền sửa dòng này không. Cấu hình SUA mà không có quyền → rơi về XEM, không vào form cụt. */
  coQuyenSua?: (row: TRow) => boolean;
}

/**
 * Hành động khi bấm vào dòng của một màn danh sách, theo cấu hình admin đặt trong Cài đặt hệ thống.
 *
 *   KHONG        → không làm gì (cán bộ bôi chữ để chép)
 *   XEM / SUA    → 1 cú bấm mở trang xem / trang sửa
 *   *_HAI_CHAM   → bấm đúp mới mở (1 cú bấm không làm gì)
 *
 * Trả `onRowClick` / `onRowDoubleClick` / `rowHref` cho `<Table>`, và `thuocTinhDong(row)` cho màn tự dựng `<tr>`.
 */
export function useBamDong<TRow>(man: ManBamDong, tuyChon: TuyChonUseBamDong<TRow>) {
  const cauHinh = useCauHinhGiaoDien()[MAN_BAM_DONG[man]];
  const navigate = useNavigate();
  const { hrefXem, hrefSua, coQuyenSua } = tuyChon;

  const muonSua = cauHinh === 'SUA' || cauHinh === 'SUA_HAI_CHAM';
  const motCham = cauHinh === 'XEM' || cauHinh === 'SUA';
  const haiCham = cauHinh === 'XEM_HAI_CHAM' || cauHinh === 'SUA_HAI_CHAM';

  const dich = useCallback(
    (row: TRow): string => {
      if (muonSua && hrefSua && (coQuyenSua ? coQuyenSua(row) : true)) return hrefSua(row);
      return hrefXem(row);
    },
    [muonSua, hrefSua, coQuyenSua, hrefXem],
  );

  const mo = useCallback((row: TRow) => navigate(dich(row)), [navigate, dich]);

  return useMemo(() => {
    const rowHref = cauHinh === 'KHONG' ? undefined : dich;
    return {
      cauHinh,
      onRowClick: motCham ? (row: TRow) => mo(row) : undefined,
      onRowDoubleClick: haiCham ? (row: TRow) => mo(row) : undefined,
      rowHref,
      /** Cho `<tr>` tự dựng: thay cho `onClick={() => navigate(...)}` trần. */
      thuocTinhDong: (row: TRow) => ({
        onClick:
          motCham || rowHref
            ? (e: MouseEvent<HTMLElement>) =>
                xuLyClickDong(e, {
                  mo: motCham ? () => mo(row) : undefined,
                  href: rowHref ? () => rowHref(row) : undefined,
                })
            : undefined,
        onDoubleClick: haiCham ? (e: MouseEvent<HTMLElement>) => xuLyDoubleClickDong(e, () => mo(row)) : undefined,
        onAuxClick: rowHref ? (e: MouseEvent<HTMLElement>) => xuLyAuxClickDong(e, () => rowHref(row)) : undefined,
        // Có hành động thì dòng nhận tiêu điểm bàn phím và Enter/Space mở nó (người không dùng chuột); KHONG thì
        // dòng là chữ thuần, các nút trong dòng vẫn là điểm dừng Tab riêng của chúng.
        tabIndex: motCham || haiCham ? 0 : undefined,
        onKeyDown:
          motCham || haiCham
            ? (e: KeyboardEvent<HTMLElement>) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  mo(row);
                }
              }
            : undefined,
        className: motCham || haiCham ? 'cursor-pointer' : '',
      }),
    };
  }, [cauHinh, motCham, haiCham, mo, dich]);
}
