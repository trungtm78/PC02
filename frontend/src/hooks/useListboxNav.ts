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
  const [activeIndex, setActiveIndex] = useState(-1);

  const optionId = useCallback((index: number) => `${goc}-muc-${index}`, [goc]);
  const reset = useCallback(() => setActiveIndex(-1), []);

  // Đổi danh sách → bỏ tô (mục 3 ở chú thích đầu tệp).
  useEffect(() => {
    setActiveIndex(-1);
  }, [resetKey]);

  // Giữ mục đang tô trong tầm nhìn khi cuộn danh sách dài.
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, optionId]);

  // Chỉ số có thể vượt số mục nếu danh sách co lại trước khi `resetKey` kịp đổi.
  const hopLe = activeIndex >= 0 && activeIndex < count;

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const ne = e.nativeEvent as { isComposing?: boolean; keyCode?: number };
      if (ne.isComposing || ne.keyCode === 229) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (count > 0) setActiveIndex((p) => (p >= 0 && p < count - 1 ? p + 1 : 0));
          return;
        case 'ArrowUp':
          e.preventDefault();
          if (count > 0) setActiveIndex((p) => (p > 0 && p < count ? p - 1 : count - 1));
          return;
        case 'Home':
          e.preventDefault();
          if (count > 0) setActiveIndex(0);
          return;
        case 'End':
          e.preventDefault();
          if (count > 0) setActiveIndex(count - 1);
          return;
        case 'PageDown':
          e.preventDefault();
          if (count > 0) setActiveIndex((p) => Math.min(count - 1, (p < 0 ? -1 : p) + BUOC_TRANG));
          return;
        case 'PageUp':
          e.preventDefault();
          if (count > 0) setActiveIndex((p) => Math.max(0, (p < 0 ? count : p) - BUOC_TRANG));
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
          onEscape?.();
          return;
        case 'Tab':
          onTab?.();
          return;
        default:
          return;
      }
    },
    [count, hopLe, activeIndex, onSelect, onEscape, onTab, chanEnterKhiChuaTo],
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
