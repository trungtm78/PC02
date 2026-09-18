import { coFormDoDang } from './formDoDang';

/** Đường dẫn của màn nhập liệu: `/petitions/new`, `/cases/:id/edit`, `/add-new-record`… */
const DUONG_DAN_FORM = /(^|\/)(new|edit|add-new-record)(\/|$)/i;

/** Hộp thoại đang mở — có thể đang chứa chữ cán bộ gõ (lý do xoá, chuyển tổ, tạo nhanh). */
const HOP_THOAI = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open]';

function oNhapCoChuDaGo(goc: ParentNode): boolean {
  const oNhap = goc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea',
  );
  for (const o of oNhap) {
    if (o.value !== o.defaultValue) return true;
  }
  for (const o of goc.querySelectorAll<HTMLElement>('[contenteditable="true"]')) {
    if ((o.textContent ?? '').trim()) return true;
  }
  return false;
}

/**
 * Trang có đang "rảnh" để tự tải lại mà không làm mất gì của cán bộ không.
 *
 * Bốn điều, vướng một là KHÔNG rảnh:
 *  1. đang ở màn nhập liệu;
 *  2. có form tự khai đang sửa dở (`useDauHieuDangSua`);
 *  3. có hộp thoại đang mở;
 *  4. có ô nhập mang chữ khác giá trị ban đầu — lưới cuối cho hộp tự dựng không khai `role`.
 *
 * Ô tìm kiếm trên thanh công cụ có `value` khác `defaultValue` cũng tính là "đang gõ": hoãn một
 * lần cập nhật đến lần chuyển màn kế tiếp rẻ hơn nhiều so với cuốn mất chữ.
 */
export function trangDangRanh(doc: Document = document, duongDan: string = window.location.pathname): boolean {
  if (DUONG_DAN_FORM.test(duongDan)) return false;
  if (coFormDoDang()) return false;
  if (doc.querySelector(HOP_THOAI)) return false;
  if (oNhapCoChuDaGo(doc)) return false;
  return true;
}
