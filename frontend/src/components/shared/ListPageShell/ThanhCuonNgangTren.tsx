import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Thanh cuộn ngang ở TRÊN bảng (anh yêu cầu 18/09/2026) — bảng dài thì thanh cuộn gốc nằm tận cuối trang.
 *
 * Khuôn "sticky scrollbar" (Ant Design Table): một dải `overflow-x-auto` dính trên đầu bảng, ruột rộng
 * đúng bằng `scrollWidth` của khung bảng, đồng bộ `scrollLeft` HAI chiều. Tự ẩn khi bảng không tràn.
 *
 * Đo lại khi khung hoặc bảng đổi cỡ (đổi cột, kéo giãn cột, dòng bung "Xem thêm") qua ResizeObserver — quan
 * sát cả khung LẪN bảng bên trong: bảng nở mà khung không đổi cỡ thì chỉ bảng báo.
 *
 * `aria-hidden`: thanh cuộn gốc của khung vẫn còn cho bàn phím và trình đọc màn hình; đây chỉ là tay nắm
 * thêm cho chuột.
 */
export function ThanhCuonNgangTren({ khung }: { khung: RefObject<HTMLElement | null> }) {
  const thanhRef = useRef<HTMLDivElement>(null);
  const [rongNoiDung, setRongNoiDung] = useState(0);
  const [tran, setTran] = useState(false);

  useEffect(() => {
    const el = khung.current;
    if (!el) return;
    const doLai = () => {
      setRongNoiDung(el.scrollWidth);
      setTran(el.scrollWidth > el.clientWidth + 1);
    };
    doLai();
    // Chống vòng bằng SO GIÁ TRỊ, không bằng cờ: gán đúng giá trị đang có thì trình duyệt không bắn sự kiện
    // cuộn — cờ sẽ kẹt và nuốt mất lần cuộn thật kế tiếp.
    const theoKhung = () => {
      const thanh = thanhRef.current;
      if (thanh && thanh.scrollLeft !== el.scrollLeft) thanh.scrollLeft = el.scrollLeft;
    };
    el.addEventListener('scroll', theoKhung);
    let quanSat: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      quanSat = new ResizeObserver(doLai);
      quanSat.observe(el);
      if (el.firstElementChild) quanSat.observe(el.firstElementChild);
    }
    return () => {
      el.removeEventListener('scroll', theoKhung);
      quanSat?.disconnect();
    };
  }, [khung]);

  // Thanh chỉ có khi bảng tràn: lúc nó hiện ra thì đặt tay nắm đúng chỗ (bảng có thể đã cuộn sẵn), rồi mới
  // nghe cuộn. Nghe bằng listener gốc trong effect — gán `scrollLeft` cho khung từ handler lúc render là sửa
  // DOM của một ref nhận qua prop (luật `react-hooks/immutability`).
  useEffect(() => {
    const el = khung.current;
    const thanh = thanhRef.current;
    if (!tran || !el || !thanh) return;
    thanh.scrollLeft = el.scrollLeft;
    const theoThanh = () => {
      if (el.scrollLeft !== thanh.scrollLeft) el.scrollLeft = thanh.scrollLeft;
    };
    thanh.addEventListener('scroll', theoThanh);
    return () => thanh.removeEventListener('scroll', theoThanh);
  }, [tran, khung]);

  if (!tran) return null;

  return (
    <div
      ref={thanhRef}
      data-testid="thanh-cuon-ngang-tren"
      aria-hidden="true"
      className="sticky top-0 z-[2] overflow-x-auto overflow-y-hidden bg-white border-b border-slate-200"
    >
      <div style={{ width: `${rongNoiDung}px`, height: 1 }} />
    </div>
  );
}
