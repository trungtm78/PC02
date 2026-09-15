import { useCallback, useEffect, useMemo, useRef } from 'react';
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
  /** Tham số trước thời thẻ → khoá thẻ, vd `{ q: '*', sender: 'nguoiGui' }`. Truyền HẰNG của module. */
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
 *
 * Tham số cũ chỉ ĐỌC thành thẻ, không tự viết lại địa chỉ lúc mở trang: lúc ấy cờ tính năng có thể
 * chưa nạp (mặc định bật), viết lại là xoá `q` — cờ nạp xong mà đang tắt thì ô chữ cũ mất bộ lọc.
 * Khoá cũ chỉ bị gỡ ở lần cán bộ tự sửa thẻ.
 */
export function useTheTimKiem({ prefix, khai, thamSoCu = KHONG_CO, bat = true }: Args) {
  const [sp, setSp] = useSearchParams();

  /**
   * Địa chỉ đã GHI mà trang chưa vẽ lại. `setSearchParams(prev => …)` của React Router 7 tính
   * `prev` từ tham số LÚC VẼ, không nối tiếp lần ghi trước: hai lần thêm trước khi vẽ lại thì lần
   * sau dựng từ địa chỉ chưa có thẻ trước, và thẻ ấy mất.
   */
  const choVe = useRef<URLSearchParams | null>(null);
  useEffect(() => {
    choVe.current = null;
  }, [sp]);

  const the = useMemo(
    () => (bat ? docTheTuThamSo(sp, prefix, thamSoCu) : []),
    [bat, sp, prefix, thamSoCu],
  );

  const tkGui = useMemo(
    () => ghiTheRaUrl(the.filter((t) => khoaHopLe(t.khoa, khai))),
    [the, khai],
  );

  /** Bộ thẻ MỚI NHẤT — gồm cả lần ghi chưa kịp vẽ. */
  const theMoiNhat = useCallback(
    () => (choVe.current ? docTheTuThamSo(choVe.current, prefix, thamSoCu) : the),
    [the, prefix, thamSoCu],
  );

  const viet = useCallback(
    (bienDoi: (cu: The[]) => The[]) => {
      setSp((prev) => {
        const goc = choVe.current ?? prev;
        const next = new URLSearchParams(goc);
        const moi = bienDoi(docTheTuThamSo(goc, prefix, thamSoCu));
        next.delete(khoaUrlThe(prefix));
        for (const cu of Object.keys(thamSoCu)) next.delete(`${prefix}_${cu}`);
        for (const v of ghiTheRaUrl(moi)) next.append(khoaUrlThe(prefix), v);
        next.delete(`${prefix}_page`);
        choVe.current = next;
        return next;
      });
    },
    [prefix, thamSoCu, setSp],
  );

  const them = useCallback(
    (khoa: string, giaTri: string): boolean => {
      const hienTai = theMoiNhat();
      if (!bat || themGiaTri(hienTai, khoa, giaTri) === hienTai) return false;
      viet((cu) => themGiaTri(cu, khoa, giaTri));
      return true;
    },
    [bat, theMoiNhat, viet],
  );

  const boGiaTri = useCallback(
    (khoa: string, giaTri: string) => {
      if (bat) viet((cu) => boGiaTriKhoiThe(cu, khoa, giaTri));
    },
    [bat, viet],
  );

  const boThe = useCallback(
    (khoa: string) => {
      if (bat) viet((cu) => boTheKhoiDs(cu, khoa));
    },
    [bat, viet],
  );

  const xoaHet = useCallback(() => {
    if (bat) viet(() => []);
  }, [bat, viet]);

  return { the, tkGui, them, boGiaTri, boThe, xoaHet };
}
