import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/**
 * Đo xem chữ trong một khung bị KẸP dòng (CSS `line-clamp`) có TRÀN thật không — để chỉ hiện nút "Xem thêm"
 * khi có gì để xem thêm.
 *
 * Trích ra từ `SummaryCell` (ô Tóm tắt nội dung của danh sách) để ô gợi ý tên ở form Đơn thư dùng đúng phép đo
 * ấy, thay vì chép lại một bản và lệch ở những chỗ khó:
 *
 * - "Tràn" là cao nội dung > cao khung (`scrollHeight > clientHeight + 1`), không phải đếm ký tự: 5 dòng là
 *   5 dòng thật theo bề rộng cột; cắt theo số ký tự thì cột rộng vẫn hụt, cột hẹp vẫn tràn.
 * - Đo lại khi khung đổi cỡ (ResizeObserver) VÀ khi FONT WEB nạp xong: font có chân rộng hơn làm chữ dài thêm
 *   dòng, nhưng khung bị kẹp nên không đổi cỡ — ResizeObserver không báo, ô tràn mà mất nút (UAT Chrome 18/09/2026).
 * - Khi `kep` là false (đang bung, hoặc không kẹp) thì KHÔNG đo và giữ nguyên kết quả cũ, để nút "Thu gọn" còn đó.
 */
export function useChuTran<T extends HTMLElement>(
  text: string,
  kep: boolean,
): { ref: RefObject<T | null>; coTran: boolean } {
  const ref = useRef<T>(null);
  const [coTran, setCoTran] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !kep) return;
    let huy = false;
    const doLai = () => {
      if (!huy) setCoTran(el.scrollHeight > el.clientHeight + 1);
    };
    doLai();
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    void fonts?.ready.then(doLai);
    fonts?.addEventListener('loadingdone', doLai);
    const quanSat = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(doLai);
    quanSat?.observe(el);
    return () => {
      huy = true;
      fonts?.removeEventListener('loadingdone', doLai);
      quanSat?.disconnect();
    };
  }, [text, kep]);

  return { ref, coTran };
}
