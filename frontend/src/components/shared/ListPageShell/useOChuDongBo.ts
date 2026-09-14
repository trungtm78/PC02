import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, CompositionEvent } from 'react';

/**
 * Ô chữ có giá trị đọc từ URL (ô tìm kiếm danh sách, ô lọc chữ tự do) — giữ chữ đang gõ trong
 * state RIÊNG, không ràng thẳng vào `value`.
 *
 * React Router 7 đổi URL trong `startTransition`, nên `value` đọc từ URL về TRỄ hơn phím bấm.
 * Ràng thẳng thì mỗi phím React vẽ lại ô bằng giá trị cũ: đo trên Chrome thật 14/09/2026, gõ
 * "nguyen van a" còn "a", Telex "nguyên" thành "ngngunguynguyenguyênguyênnguyên". Cán bộ thấy
 * ô "không nhập được, bể chữ".
 *
 * Hai chiều phải phân biệt:
 *  - `value` đổi vì CHÍNH ô vừa gửi (tiếng vọng — về trễ, có khi về cả giá trị trung gian) → bỏ qua;
 *  - `value` đổi từ BÊN NGOÀI (Xoá lọc, lùi trang, bấm thẻ thống kê) → ô cập nhật theo.
 *
 * Bộ gõ đang ghép chữ (Telex/VNI của Windows, IME) thì chưa gửi: chữ còn dở, gửi đi chỉ làm
 * trang dựng lại và tra cứu một từ chưa hoàn chỉnh.
 */
export function useOChuDongBo(value: string, onChange: (v: string) => void) {
  const [draft, setDraft] = useState(value);
  /** Mọi giá trị ô đã gửi đi mà nguồn (URL) chưa bắt kịp. */
  const daGui = useRef(new Set<string>());
  const guiCuoi = useRef<string | null>(null);
  const dangGhep = useRef(false);

  useEffect(() => {
    if (daGui.current.has(value)) {
      // Tiếng vọng. Nguồn đã bắt kịp giá trị MỚI NHẤT thì dọn sổ để lần đổi từ ngoài sau nhận ra.
      if (value === guiCuoi.current) daGui.current.clear();
      return;
    }
    daGui.current.clear();
    guiCuoi.current = null;
    setDraft(value);
  }, [value]);

  const gui = (v: string) => {
    // Safari/Firefox bắn thêm một sự kiện nhập ngay sau compositionend — không gửi lặp.
    if (v === guiCuoi.current) return;
    daGui.current.add(v);
    guiCuoi.current = v;
    onChange(v);
  };

  return {
    value: draft,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      setDraft(e.target.value);
      if (!dangGhep.current) gui(e.target.value);
    },
    onCompositionStart: () => {
      dangGhep.current = true;
    },
    onCompositionEnd: (e: CompositionEvent<HTMLInputElement>) => {
      dangGhep.current = false;
      gui(e.currentTarget.value);
    },
  };
}
