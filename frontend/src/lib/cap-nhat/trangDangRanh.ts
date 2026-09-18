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
/** Ô chọn tệp đã chọn tệp (chưa biết đã tải lên chưa). */
const oChonTep = new Set<Element>();
let daNghe = false;

/**
 * Chỉ ô NHẬP CHỮ mới có thứ để mất. Ô tích/nút chọn luôn mang `value="on"`, ô chọn/ngày giữ giá trị
 * đã chọn — tính chúng là "đang gõ" thì một bộ lọc bình thường chặn cập nhật mãi (codex 18/09/2026).
 */
const KIEU_O_CHU = new Set(['', 'text', 'search', 'email', 'tel', 'url', 'number', 'password']);
function laONhapChu(o: Element): boolean {
  if (o instanceof HTMLTextAreaElement) return true;
  if (o instanceof HTMLInputElement) return KIEU_O_CHU.has((o.getAttribute('type') ?? '').toLowerCase());
  // `isContentEditable` là thuộc tính tính toán (jsdom không có); đọc thẳng thuộc tính khai báo.
  const ce = o.closest('[contenteditable]')?.getAttribute('contenteditable');
  return ce === '' || ce === 'true' || ce === 'plaintext-only';
}

function ngheGo(doc: Document): void {
  if (daNghe) return;
  daNghe = true;
  const ghiNhan = (e: Event) => {
    const o = e.target;
    if (!(o instanceof Element)) return;
    if (laONhapChu(o)) oDaGo.add(o);
    // Tệp đã chọn mà chưa tải lên cũng là thứ để mất. Nhiều form đọc tệp vào state rồi XOÁ giá trị ô
    // chọn tệp, nên không dựa vào `files` lúc kiểm: đã chọn tệp thì coi là dở dang tới khi ô bị tháo
    // (codex 18/09/2026 — EntityDocumentsTab trên màn chi tiết).
    if (o instanceof HTMLInputElement && o.type === 'file' && (o.files?.length ?? 0) > 0) oChonTep.add(o);
  };
  doc.addEventListener('input', ghiNhan, true);
  doc.addEventListener('change', ghiNhan, true);
}

/** Bắt đầu ghi nhận thao tác gõ. Gọi một lần ở khung ứng dụng; gọi lại vô hại. */
export function batDauTheoDoiGo(doc: Document = document): void {
  ngheGo(doc);
}

function conTepChoTai(): boolean {
  for (const o of oChonTep) {
    if (o.isConnected) return true;
    oChonTep.delete(o);
  }
  return false;
}

function conChuDaGo(): boolean {
  for (const o of oDaGo) {
    // Ô đã tháo khỏi trang (lưu xong, đóng hộp) thì không còn gì để mất.
    if (!o.isConnected) {
      oDaGo.delete(o);
      continue;
    }
    const giaTri = o instanceof HTMLInputElement || o instanceof HTMLTextAreaElement ? o.value : (o.textContent ?? '');
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
 *     cập nhật tới lần chuyển màn kế tiếp rẻ hơn nhiều so với cuốn mất chữ;
 *  5. còn ô chọn tệp đã chọn tệp trên trang (tệp chờ tải lên).
 */
export function trangDangRanh(doc: Document = document, duongDan: string = window.location.pathname): boolean {
  if (DUONG_DAN_FORM.test(duongDan)) return false;
  if (coFormDoDang()) return false;
  if (doc.querySelector(HOP_THOAI)) return false;
  if (conChuDaGo()) return false;
  if (conTepChoTai()) return false;
  return true;
}
