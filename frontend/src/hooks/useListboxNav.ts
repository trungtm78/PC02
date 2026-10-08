import { useCallback, useEffect, useId, useState, type KeyboardEvent } from 'react';

/**
 * Bàn phím cho danh sách chọn (listbox) — MỘT nơi duy nhất, theo mẫu Combobox của WAI-ARIA APG.
 *
 * Trích ra từ `FKSelect` (đã chạy trên dữ liệu thật) để `CrimeSelect` và `ONhapGoiY` dùng chung,
 * thay vì mỗi ô tự viết một bản và lệch nhau ở đúng những chỗ khó:
 *
 * 1. Enter CHỈ chọn mục đang được tô. Trước đây Enter không tô tự lấy mục đầu danh sách: cán bộ
 *    gõ để LỌC rồi bấm Enter là bị gán bừa mục đầu tiên. Một lựa chọn phải do người ta chỉ đích danh.
 *    Enter luôn bị chặn mặc định để không gửi form đang chứa ô này.
 * 2. Bộ gõ tiếng Việt dùng Enter/mũi tên để CHỐT chữ đang bỏ dấu, và trình duyệt vẫn bắn keydown.
 *    `isComposing` là dấu hiệu chuẩn; `keyCode === 229` là đường lùi cho trình duyệt không đặt cờ ấy.
 * 3. Bỏ tô khi DANH SÁCH đổi (`resetKey`), không chỉ khi chữ tìm đổi: chỉ số là con số, mà danh sách
 *    đổi được dưới chân nó. Giữ chỉ số cũ thì Enter chọn NGƯỜI KHÁC, im lặng.
 * 4. Tab không bị chặn: tiêu điểm phải đi tiếp được, hộp chỉ đóng lại.
 */

/**
 * Đang gõ dấu tiếng Việt (bộ gõ chưa chốt chữ). `isComposing` là dấu hiệu chuẩn; `keyCode === 229` là
 * đường lùi cho trình duyệt không đặt cờ ấy. Dùng chung để mọi ô chọn bỏ qua phím đúng một cách.
 */
export function laDangGoDau(e: { nativeEvent: unknown }): boolean {
  const ne = e.nativeEvent as { isComposing?: boolean; keyCode?: number } | undefined;
  return Boolean(ne?.isComposing) || ne?.keyCode === 229;
}

/** Số mục PageUp/PageDown nhảy mỗi lần. */
export const BUOC_TRANG = 10;

export interface UseListboxNavOptions {
  /** Số mục đang hiện. */
  count: number;
  /** Đổi giá trị này thì bỏ tô — dùng khóa nhận dạng danh sách đang hiện. */
  resetKey: string;
  /** Chọn mục ở chỉ số này. Chỉ gọi khi có mục đang tô. */
  onSelect: (index: number) => void;
  onEscape?: () => void;
  onTab?: () => void;
  /** Tiền tố id của từng mục; mặc định sinh từ `useId`. */
  idPrefix?: string;
  /**
   * Enter khi CHƯA tô mục nào có bị chặn mặc định không. Mặc định có (ô CHỌN: Enter không được gửi
   * form). Ô CHỮ TỰ DO như `ONhapGoiY` đặt `false`: Enter khi chưa chọn gợi ý nào phải đi tiếp như
   * trước — gửi form — vì cán bộ đang gõ một giá trị riêng chứ không chọn từ danh sách.
   */
  chanEnterKhiChuaTo?: boolean;
}

export interface UseListboxNavResult {
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  reset: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  /** id DOM của mục ở chỉ số i — gắn vào mục và vào `aria-activedescendant`. */
  optionId: (index: number) => string;
  activeDescendantId: string | undefined;
}

export function useListboxNav({
  count,
  resetKey,
  onSelect,
  onEscape,
  onTab,
  idPrefix,
  chanEnterKhiChuaTo = true,
}: UseListboxNavOptions): UseListboxNavResult {
  const sinh = useId();
  const goc = idPrefix ?? `lb${sinh.replace(/:/g, '')}`;
  /**
   * Chỉ số đang tô là trạng thái DẪN XUẤT, gắn với khoá của danh sách lúc nó được đặt.
   *
   * Bản đầu giữ một con số rồi bỏ tô bằng `useEffect` theo `resetKey`. Cách đó hở một lượt vẽ trung gian
   * mang chỉ số CŨ cùng khoá MỚI, và effect chạy muộn có thể ghi đè -1 lên phím ↓ vừa bấm đúng lúc
   * danh sách mới về — phím biến mất. Đo được: 3/16 lượt chạy đỏ khi máy bận (CI cũng đỏ một lần).
   * Nay chỉ số hợp lệ CHỈ khi khoá đã lưu khớp khoá hiện tại, nên khoá đổi là ngay trong chính lượt vẽ
   * ấy đã là -1, và không còn effect nào để chạy sai thứ tự.
   */
  const [trang, setTrang] = useState({ chiSo: -1, khoa: resetKey });
  // Khoá đổi thì HUỶ hẳn chỉ số đã lưu ngay trong lượt vẽ này (mẫu "điều chỉnh state lúc vẽ" của React:
  // vẽ lại tức thì, không có lượt trung gian được commit). Chỉ che chứ không huỷ thì khoá quay về giá trị
  // cũ (A -> B -> A: mở/đóng/mở lại hộp, gõ rồi xoá bộ lọc) làm dòng tô cũ SỐNG LẠI — Codex bắt được.
  if (trang.khoa !== resetKey) setTrang({ chiSo: -1, khoa: resetKey });
  const activeIndex = trang.khoa === resetKey ? trang.chiSo : -1;

  const setActiveIndex = useCallback(
    (chiSo: number) => setTrang({ chiSo, khoa: resetKey }),
    [resetKey],
  );
  /** Đổi chỉ số dựa trên chỉ số HIỆN CÓ (đã loại chỉ số của khoá cũ). */
  const dichChiSo = useCallback(
    (f: (hienCo: number) => number) =>
      setTrang((p) => ({ chiSo: f(p.khoa === resetKey ? p.chiSo : -1), khoa: resetKey })),
    [resetKey],
  );

  const optionId = useCallback((index: number) => `${goc}-muc-${index}`, [goc]);
  const reset = useCallback(() => setTrang({ chiSo: -1, khoa: resetKey }), [resetKey]);

  // Giữ mục đang tô trong tầm nhìn khi cuộn danh sách dài.
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, optionId]);

  // Chỉ số có thể vượt số mục nếu danh sách co lại mà khoá chưa đổi.
  const hopLe = activeIndex >= 0 && activeIndex < count;

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (laDangGoDau(e)) return;

      // Phím điều hướng kèm Shift/Ctrl/Alt/Meta là phím của Ô NHẬP CHỮ (bôi chọn chữ, nhảy từ…), không phải
      // của danh sách: để nguyên cho trình duyệt. Home/End cũng vậy — chúng đưa con trỏ về đầu/cuối ô, nên
      // hook KHÔNG xử lý (mẫu combobox của APG chỉ dùng ↑ ↓ và PageUp/PageDown để đi trong danh sách).
      const coPhimBoTro = e.shiftKey || e.ctrlKey || e.altKey || e.metaKey;
      const laPhimDieuHuong =
        e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp';
      if (coPhimBoTro && laPhimDieuHuong) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (count > 0) dichChiSo((p) => (p >= 0 && p < count - 1 ? p + 1 : 0));
          return;
        case 'ArrowUp':
          e.preventDefault();
          if (count > 0) dichChiSo((p) => (p > 0 && p < count ? p - 1 : count - 1));
          return;
        case 'PageDown':
          e.preventDefault();
          if (count > 0) dichChiSo((p) => Math.min(count - 1, (p < 0 ? -1 : p) + BUOC_TRANG));
          return;
        case 'PageUp':
          e.preventDefault();
          if (count > 0) dichChiSo((p) => Math.max(0, (p < 0 ? count : p) - BUOC_TRANG));
          return;
        case 'Enter':
          // Có chọn thì luôn chặn; chưa chọn thì chặn trừ khi đây là ô chữ tự do (xem `chanEnterKhiChuaTo`).
          if (hopLe) {
            e.preventDefault();
            onSelect(activeIndex);
          } else if (chanEnterKhiChuaTo) {
            e.preventDefault();
          }
          return;
        case 'Escape':
          // Tiêu thụ: hộp đang mở thì Escape chỉ đóng hộp, không được lọt ra đóng luôn cửa sổ chứa ô này.
          // (Hook chỉ nhận phím khi hộp mở; ô đang đóng thì Escape đi tiếp để cửa sổ tự đóng.)
          e.stopPropagation();
          onEscape?.();
          return;
        case 'Tab':
          onTab?.();
          return;
        default:
          return;
      }
    },
    [count, hopLe, activeIndex, dichChiSo, setActiveIndex, onSelect, onEscape, onTab, chanEnterKhiChuaTo],
  );

  return {
    activeIndex: hopLe ? activeIndex : -1,
    setActiveIndex,
    reset,
    onKeyDown,
    optionId,
    activeDescendantId: hopLe ? optionId(activeIndex) : undefined,
  };
}
