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
    let quanSat: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      quanSat = new ResizeObserver(doLai);
      quanSat.observe(el);
      if (el.firstElementChild) quanSat.observe(el.firstElementChild);
    }
    return () => quanSat?.disconnect();
  }, [khung]);

  // Đồng bộ hai chiều, chỉ khi thanh đang hiện. Lúc thanh vừa hiện thì đặt tay nắm đúng chỗ (bảng có thể đã
  // cuộn sẵn). Nghe bằng listener gốc trong effect — gán `scrollLeft` cho khung từ handler lúc render là sửa DOM
  // của một ref nhận qua prop (luật `react-hooks/immutability`).
  //
  // Chống vòng bằng NHỚ GIÁ TRỊ VỪA GÁN cho bên kia, không bằng cờ và không chỉ so hai bên:
  //  - cờ: gán đúng giá trị đang có thì trình duyệt không bắn sự kiện → cờ kẹt, nuốt lần cuộn thật kế tiếp;
  //  - chỉ so hai bên: sự kiện cuộn phát theo KHUNG HÌNH, tiếng vọng của lần gán trước tới muộn khi bảng đã cuộn
  //    tiếp (touchpad, Shift+lăn) → bị coi là cuộn thật và kéo bảng giật ngược.
  // Nhớ giá trị ĐỌC LẠI sau khi gán (trình duyệt có thể kẹp/làm tròn), tiếng vọng khớp đúng giá trị ấy thì bỏ.
  // CHỈ nhớ khi vị trí thật sự đổi: gán mà bị kẹp ở mép thì không có sự kiện nào, nhớ vào là treo và nuốt lần
  // cuộn thật sau đúng giá trị ấy.
  useEffect(() => {
    const el = khung.current;
    const thanh = thanhRef.current;
    if (!tran || !el || !thanh) return;
    let vongThanh: number | null = null;
    let vongKhung: number | null = null;
    /** Gán `scrollLeft`, trả giá trị cần nhớ làm tiếng vọng — `null` khi vị trí không đổi (không có sự kiện). */
    const gan = (dich: HTMLElement, giaTri: number): number | null => {
      const truoc = dich.scrollLeft;
      dich.scrollLeft = giaTri;
      return dich.scrollLeft !== truoc ? dich.scrollLeft : null;
    };
    vongThanh = gan(thanh, el.scrollLeft);
    const theoKhung = () => {
      if (vongKhung !== null && el.scrollLeft === vongKhung) {
        vongKhung = null;
        return;
      }
      vongKhung = null;
      if (thanh.scrollLeft === el.scrollLeft) return;
      vongThanh = gan(thanh, el.scrollLeft);
    };
    const theoThanh = () => {
      if (vongThanh !== null && thanh.scrollLeft === vongThanh) {
        vongThanh = null;
        return;
      }
      vongThanh = null;
      if (el.scrollLeft === thanh.scrollLeft) return;
      vongKhung = gan(el, thanh.scrollLeft);
    };
    el.addEventListener('scroll', theoKhung);
    thanh.addEventListener('scroll', theoThanh);
    return () => {
      el.removeEventListener('scroll', theoKhung);
      thanh.removeEventListener('scroll', theoThanh);
    };
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
