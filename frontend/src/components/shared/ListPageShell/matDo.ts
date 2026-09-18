import { createContext } from 'react';
import type { MatDo } from '@/lib/api';

export type { MatDo };

/** Mặc định "Đọc" — Tóm tắt 5 dòng, đúng yêu cầu anh 18/09/2026. */
export const MAT_DO_MAC_DINH: MatDo = 'doc';

/**
 * Mật độ dòng của bảng đang vẽ — `Table` cung cấp, `SummaryCell` đọc. Qua context để mọi ô Tóm tắt (kể cả
 * bảng tự dựng như Đơn thư phường) theo đúng một lựa chọn mà không phải truyền prop qua từng khai cột.
 */
export const MatDoContext = createContext<MatDo>(MAT_DO_MAC_DINH);

/** Số dòng ô Tóm tắt được kẹp theo mật độ; `null` = không kẹp. */
export const SO_DONG_TOM_TAT: Record<MatDo, 1 | 5 | null> = {
  gon: 1,
  doc: 5,
  'day-du': null,
};

/** Lớp kẹp dòng — viết TRỌN tên lớp để Tailwind quét được (không ghép chuỗi `line-clamp-${n}`). */
export const LOP_KEP: Record<1 | 5, string> = {
  1: 'line-clamp-1',
  5: 'line-clamp-5',
};
