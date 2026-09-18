import { coFormDoDang } from './formDoDang';

/**
 * Đường dẫn của màn nhập liệu: `/petitions/new`, `/cases/:id/edit`, `/add-new-record`,
 * `/admin/deadline-rules/:key/propose`, `/cases/tdac-backfill`…
 * Cổng `congDuongDanForm.gate.test.ts` bắt mọi route có `<form`/`onSubmit` mà luật này bỏ sót.
 */
export const DUONG_DAN_FORM = /(^|\/)(new|edit|add-new-record|propose|[a-z-]*backfill)(\/|$)/i;

/** Hộp thoại đang mở, kể cả hộp tự dựng không khai `role` (lớp phủ `fixed inset-0`). */
const HOP_THOAI = '[role="dialog"], [role="alertdialog"], [aria-modal="true"], dialog[open], .fixed.inset-0';

/**
 * Ô cán bộ ĐÃ GÕ vào (bắt từ sự kiện `input`/`change` thật). Không so `value` với
 * `defaultValue`: React 19 đồng bộ `defaultValue` theo `value` sau mỗi lần dựng ô điều khiển,
 * nên phép so ấy luôn ra "chưa gõ" trong app thật (rà mã 18/09/2026 đo trên jsdom).
 */
const oDaGo = new Set<Element>();
let daNghe = false;

function ngheGo(doc: Document): void {
  if (daNghe) return;
  daNghe = true;
  const ghiNhan = (e: Event) => {
    if (e.target instanceof Element) oDaGo.add(e.target);
  };
  doc.addEventListener('input', ghiNhan, true);
  doc.addEventListener('change', ghiNhan, true);
}

/** Bắt đầu ghi nhận thao tác gõ. Gọi một lần ở khung ứng dụng; gọi lại vô hại. */
export function batDauTheoDoiGo(doc: Document = document): void {
  ngheGo(doc);
}

function conChuDaGo(): boolean {
  for (const o of oDaGo) {
    // Ô đã tháo khỏi trang (lưu xong, đóng hộp) thì không còn gì để mất.
    if (!o.isConnected) {
      oDaGo.delete(o);
      continue;
    }
    const giaTri =
      o instanceof HTMLInputElement || o instanceof HTMLTextAreaElement || o instanceof HTMLSelectElement
        ? o.value
        : (o.textContent ?? '');
    if (giaTri.trim() !== '') return true;
  }
  return false;
}

/**
 * Trang có đang "rảnh" để tự tải lại mà không làm mất gì của cán bộ không.
 *
 * Vướng một điều là KHÔNG rảnh:
 *  1. đang ở màn nhập liệu;
 *  2. có form tự khai đang sửa dở (`useDauHieuDangSua`);
 *  3. có hộp thoại/lớp phủ đang mở;
 *  4. còn ô cán bộ đã gõ mà vẫn đang nằm trên trang và có chữ — kể cả ô tìm kiếm: hoãn một lần
 *     cập nhật tới lần chuyển màn kế tiếp rẻ hơn nhiều so với cuốn mất chữ.
 */
export function trangDangRanh(doc: Document = document, duongDan: string = window.location.pathname): boolean {
  if (DUONG_DAN_FORM.test(duongDan)) return false;
  if (coFormDoDang()) return false;
  if (doc.querySelector(HOP_THOAI)) return false;
  if (conChuDaGo()) return false;
  return true;
}
