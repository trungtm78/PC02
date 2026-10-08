/**
 * Xử lý cú bấm vào một DÒNG của danh sách — dùng chung cho `Table` và các màn tự dựng `<tr>`.
 *
 * Ba việc mà `onClick={() => navigate(...)}` trần không làm được (08/10/2026):
 *  1. Cán bộ BÔI ĐEN chữ trên danh sách để chép sang nơi khác. Nhả chuột sau khi kéo vẫn sinh sự kiện `click`
 *     trên dòng → trang nhảy đi, mất vùng bôi. Có vùng chữ đang được bôi trong dòng thì KHÔNG chuyển trang.
 *  2. Ctrl/⌘+bấm và bấm nút giữa là cử chỉ "mở tab mới" của mọi trình duyệt.
 *  3. Bấm vào nút/liên kết/ô nhập bên trong dòng là việc của chính phần tử ấy, không phải của dòng.
 */
import type { MouseEvent } from 'react';

const PHAN_TU_TUONG_TAC =
  'a,button,input,select,textarea,label,summary,[role="button"],[role="menuitem"],[role="checkbox"],[role="combobox"],[data-khong-bam-dong]';

/** Có vùng chữ đang được bôi chọn GIAO với phần tử này không (người dùng đang bôi để chép)? */
export function dangBoiChonTrong(el: Element | null): boolean {
  if (!el || typeof window === 'undefined' || typeof window.getSelection !== 'function') return false;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  // Vùng chọn toàn khoảng trắng (vd bấm đúp vào kẽ giữa hai ô) không phải ý định chép chữ.
  if (sel.toString().trim() === '') return false;
  try {
    return sel.getRangeAt(0).intersectsNode(el);
  } catch {
    return false;
  }
}

/** Cú bấm rơi vào một phần tử tương tác BÊN TRONG dòng (nút, liên kết, ô nhập…)? */
export function bamVaoPhanTuTuongTac(e: MouseEvent<HTMLElement>): boolean {
  const dich = e.target;
  if (!(dich instanceof Element) || dich === e.currentTarget) return false;
  const gan = dich.closest(PHAN_TU_TUONG_TAC);
  return gan !== null && e.currentTarget.contains(gan);
}

export interface TuyChonBamDong {
  /** Mở đích theo cấu hình. Không truyền = dòng không có hành động khi bấm. */
  mo?: () => void;
  /** Địa chỉ để mở ở TAB MỚI (Ctrl/⌘+bấm, nút giữa). Không truyền hoặc trả rỗng = không có đích. */
  href?: () => string | null | undefined;
}

function moTabMoi(href: string): void {
  window.open(href, '_blank', 'noopener,noreferrer');
}

export function xuLyClickDong(e: MouseEvent<HTMLElement>, { mo, href }: TuyChonBamDong): void {
  if (bamVaoPhanTuTuongTac(e)) return;
  if (e.ctrlKey || e.metaKey) {
    const dich = href?.();
    if (dich) {
      moTabMoi(dich);
      return;
    }
  }
  if (dangBoiChonTrong(e.currentTarget)) return;
  mo?.();
}

/** Bấm đúp: trình duyệt tự bôi một từ — xoá vùng chọn tự sinh đó trước khi mở, vì nó không phải ý định chép. */
export function xuLyDoubleClickDong(e: MouseEvent<HTMLElement>, mo: () => void): void {
  if (bamVaoPhanTuTuongTac(e)) return;
  window.getSelection?.()?.removeAllRanges();
  mo();
}

/** Nút giữa chuột trên dòng = mở tab mới (nếu có đích). */
export function xuLyAuxClickDong(e: MouseEvent<HTMLElement>, href: (() => string | null | undefined) | undefined): void {
  if (e.button !== 1 || !href || bamVaoPhanTuTuongTac(e)) return;
  const dich = href();
  if (!dich) return;
  e.preventDefault();
  moTabMoi(dich);
}
