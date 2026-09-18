import { useEffect, useRef } from 'react';

/**
 * Sổ đăng ký "form đang sửa dở" — nơi màn nhập liệu TỰ KHAI mình đang có dữ liệu chưa lưu.
 *
 * App tự cập nhật khi có bản mới (xem `useTuCapNhat`), nhưng không được tải lại trang giữa lúc cán
 * bộ đang gõ. Dự án dùng `<BrowserRouter>` nên không có `useBlocker`; đoán "đang gõ" chỉ bằng DOM
 * thì lọt những form giữ dữ liệu trong state mà ô nhập không còn trên màn (tab ẩn, bước khác).
 * Nên form khai tường minh ở đây, còn DOM chỉ là lưới cuối (`trangDangRanh`).
 */
const dangSua = new Set<symbol>();

/** Có ít nhất một form đang khai là sửa dở. */
export function coFormDoDang(): boolean {
  return dangSua.size > 0;
}

/**
 * Form gọi hook này với `dangSua = true` khi dữ liệu khác bản đã lưu. Tháo màn hoặc trở về
 * `false` là tự gỡ khỏi sổ — không có đường nào để một form đã đóng giữ sổ mãi.
 */
export function useDauHieuDangSua(dangSuaDo: boolean): void {
  const khoa = useRef(Symbol('form-dang-sua'));
  useEffect(() => {
    if (!dangSuaDo) return undefined;
    const k = khoa.current;
    dangSua.add(k);
    return () => {
      dangSua.delete(k);
    };
  }, [dangSuaDo]);
}
