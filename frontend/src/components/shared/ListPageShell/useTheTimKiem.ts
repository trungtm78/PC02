import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  boGiaTri as boGiaTriKhoiThe,
  boThe as boTheKhoiDs,
  docTheTuThamSo,
  ghiTheRaUrl,
  khoaHopLe,
  khoaUrlThe,
  themGiaTri,
  type The,
  type TruongTimKiem,
} from '@/shared/tim-kiem/the';

interface Args {
  prefix: string;
  khai: readonly TruongTimKiem[];
  /**
   * Tham số trước thời thẻ → khoá thẻ, vd `{ q: '*', sender: 'nguoiGui' }`. Truyền HẰNG của
   * module: đối tượng dựng mới mỗi lần vẽ sẽ làm hook chạy lại hiệu ứng viết lại địa chỉ.
   */
  thamSoCu?: Readonly<Record<string, string>>;
  /** Cờ `TIM_KIEM_THE` tắt → hook không đọc, không ghi gì; trang dùng lại ô chữ cũ. */
  bat?: boolean;
}

const KHONG_CO: Readonly<Record<string, string>> = {};

/**
 * Thẻ tìm kiếm sống trên địa chỉ trang (`<prefix>_tk`), để lùi trang và dán đường dẫn giữ nguyên.
 *
 * Mọi thay đổi thẻ là LỌC MỚI nên xoá `<prefix>_page`: giữ trang 5 khi kết quả chỉ còn 2 trang là
 * bảng trống không lời giải thích. Mỗi thay đổi đẩy một mục lịch sử để Back quay về bộ thẻ trước.
 */
export function useTheTimKiem({ prefix, khai, thamSoCu = KHONG_CO, bat = true }: Args) {
  const [sp, setSp] = useSearchParams();

  const the = useMemo(
    () => (bat ? docTheTuThamSo(sp, prefix, thamSoCu) : []),
    [bat, sp, prefix, thamSoCu],
  );

  const tkGui = useMemo(
    () => ghiTheRaUrl(the.filter((t) => khoaHopLe(t.khoa, khai))),
    [the, khai],
  );

  const viet = useCallback(
    (bienDoi: (cu: The[]) => The[], ghiLichSu: 'push' | 'replace', veTrang1: boolean) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          const moi = bienDoi(docTheTuThamSo(prev, prefix, thamSoCu));
          next.delete(khoaUrlThe(prefix));
          for (const cu of Object.keys(thamSoCu)) next.delete(`${prefix}_${cu}`);
          for (const v of ghiTheRaUrl(moi)) next.append(khoaUrlThe(prefix), v);
          if (veTrang1) next.delete(`${prefix}_page`);
          return next;
        },
        { replace: ghiLichSu === 'replace' },
      );
    },
    [prefix, thamSoCu, setSp],
  );

  // Đường dẫn cũ: thẻ đã được đọc ngay ở lần vẽ đầu (không có lượt gọi API thiếu bộ lọc); ở đây
  // chỉ viết lại địa chỉ cho gọn, không phải lọc mới nên giữ trang và không đẩy lịch sử.
  const coThamSoCu = bat && Object.keys(thamSoCu).some((k) => sp.has(`${prefix}_${k}`));
  useEffect(() => {
    if (coThamSoCu) viet((cu) => cu, 'replace', false);
  }, [coThamSoCu, viet]);

  const them = useCallback(
    (khoa: string, giaTri: string): boolean => {
      if (!bat || themGiaTri(the, khoa, giaTri) === the) return false;
      viet((cu) => themGiaTri(cu, khoa, giaTri), 'push', true);
      return true;
    },
    [bat, the, viet],
  );

  const boGiaTri = useCallback(
    (khoa: string, giaTri: string) => {
      if (bat) viet((cu) => boGiaTriKhoiThe(cu, khoa, giaTri), 'push', true);
    },
    [bat, viet],
  );

  const boThe = useCallback(
    (khoa: string) => {
      if (bat) viet((cu) => boTheKhoiDs(cu, khoa), 'push', true);
    },
    [bat, viet],
  );

  const xoaHet = useCallback(() => {
    if (bat) viet(() => [], 'push', true);
  }, [bat, viet]);

  return { the, tkGui, them, boGiaTri, boThe, xoaHet };
}
