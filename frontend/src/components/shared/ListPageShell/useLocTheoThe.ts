import { useMemo } from 'react';
import { locTheoThe, type TruongLoc } from '@/shared/tim-kiem/loc-theo-the';
import type { BangMaChon } from '@/shared/tim-kiem/the';
import { useTheTimKiem } from './useTheTimKiem';

interface Args<R> {
  prefix: string;
  /** Khai của màn: khoá · nhãn · kiểu · cách lấy giá trị ô. Truyền HẰNG của module. */
  khai: readonly TruongLoc<R>[];
  giaTriChon?: BangMaChon;
  thamSoCu?: Readonly<Record<string, string>>;
  /** Dòng đã tải về đủ — lọc tại chỗ. */
  dong: readonly R[];
  /** Cờ `TIM_KIEM_THE` tắt → không đọc thẻ, `dongLoc` là nguyên `dong` (màn dùng ô chữ cũ). */
  bat?: boolean;
}

/**
 * Ô tìm dạng thẻ cho màn TẢI HẾT dòng về rồi lọc tại chỗ: thẻ sống trên URL `<prefix>_tk` như màn
 * lọc máy chủ (lùi trang, dán đường dẫn giữ nguyên), dòng hiện ra đã qua `locTheoThe` — cùng ngữ
 * nghĩa máy chủ. Chỉ thẻ hợp lệ lọc; thẻ đỏ vẫn tính `coThe` để màn nói "lọc không ra".
 */
export function useLocTheoThe<R>({ prefix, khai, giaTriChon, thamSoCu, dong, bat = true }: Args<R>) {
  const timKiem = useTheTimKiem({ prefix, khai, giaTriChon, thamSoCu, bat });
  const { theHopLe } = timKiem;
  const dongLoc = useMemo(() => locTheoThe(dong, theHopLe, khai), [dong, theHopLe, khai]);
  return { ...timKiem, dongLoc, coThe: timKiem.the.length > 0 };
}
