import { useCallback, useMemo, useState } from 'react';
import type { ColumnDef } from './Table';

/**
 * Bật/tắt cột hiển thị, kiểu treeview của Odoo. Lựa chọn lưu ở trình duyệt.
 *
 * Ba trạng thái mượn đúng ngữ nghĩa `optional` của Odoo:
 *   không khai      → luôn hiện, KHÔNG vào menu (cột định danh: Thao tác, STT)
 *   `optional:'show'` → vào menu, tích sẵn
 *   `optional:'hide'` → vào menu, chưa tích
 *
 * LƯU THỨ NGƯỜI DÙNG ĐÃ ĐỔI, KHÔNG LƯU DANH SÁCH CỘT ĐANG HIỆN. Lưu danh sách cột đang hiện
 * thì không trả lời được một câu: một cột vắng mặt trong khoá nghĩa là "người dùng đã tắt" hay
 * "cột này thêm vào mã sau khi khoá được ghi"? Hai câu trả lời cho hai kết quả ngược nhau mà
 * dữ liệu lưu y hệt. Lưu bản ghi đè thì câu hỏi biến mất: có tên là người dùng đã đổi, không
 * có tên là lấy theo `optional` khai trong mã.
 */
type BanGhiDe = Record<string, boolean>;

function khoaLuu(prefix: string): string {
  return `${prefix}_columns`;
}

/**
 * `localStorage` KHÔNG chỉ trả rỗng — nó NÉM LỖI ở chế độ riêng tư và khi trình duyệt được
 * đặt chặn dữ liệu trang. Không bọc thì cả trang danh sách trắng xoá vì một tính năng phụ.
 */
function doc(prefix: string): BanGhiDe {
  try {
    const tho = localStorage.getItem(khoaLuu(prefix));
    if (!tho) return {};
    const parsed: unknown = JSON.parse(tho);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const ket: BanGhiDe = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'boolean') ket[k] = v;
    }
    return ket;
  } catch {
    return {};
  }
}

function ghi(prefix: string, ban: BanGhiDe): void {
  try {
    localStorage.setItem(khoaLuu(prefix), JSON.stringify(ban));
  } catch {
    // Ghi hỏng thì lựa chọn chỉ sống trong phiên này. Thà vậy còn hơn vỡ trang.
  }
}

export interface ColumnVisibility<TRow> {
  /** Cột đang hiện, theo ĐÚNG thứ tự khai trong mã. */
  visibleColumns: ColumnDef<TRow>[];
  /** Cột được phép bật/tắt — chỉ cột khai `optional`. */
  toggleableColumns: ColumnDef<TRow>[];
  isVisible(key: string): boolean;
  toggle(key: string): void;
  /** Trả mọi cột về đúng mặc định khai trong mã. */
  reset(): void;
}

export function useColumnVisibility<TRow>(
  prefix: string,
  columns: ColumnDef<TRow>[],
): ColumnVisibility<TRow> {
  const [banGhiDe, setBanGhiDe] = useState<BanGhiDe>(() => doc(prefix));

  const toggleableColumns = useMemo(() => columns.filter((c) => c.optional != null), [columns]);

  const isVisible = useCallback(
    (key: string) => {
      const cot = columns.find((c) => c.key === key);
      if (!cot) return false;
      if (cot.optional == null) return true;
      // Có tên trong bản ghi đè = người dùng đã đổi; không có = lấy theo mặc định trong mã.
      return banGhiDe[key] ?? cot.optional === 'show';
    },
    [columns, banGhiDe],
  );

  // Lọc theo `columns` chứ không dựng từ bản ghi đè: khoá lưu có thể còn tên cột đã bị xoá
  // khỏi mã sau một lần cập nhật, và thứ tự cột phải là thứ tự KHAI TRONG MÃ. Lưu một mảng
  // "cột đang hiện" theo thứ tự người dùng bấm là cách làm sai kinh điển của tính năng này —
  // tích lại một cột thì nó nhảy xuống cuối bảng.
  const visibleColumns = useMemo(
    () => columns.filter((c) => isVisible(c.key)),
    [columns, isVisible],
  );

  const toggle = useCallback(
    (key: string) => {
      setBanGhiDe((truoc) => {
        const cot = columns.find((c) => c.key === key);
        if (!cot || cot.optional == null) return truoc;
        const dangHien = truoc[key] ?? cot.optional === 'show';
        const sau = { ...truoc, [key]: !dangHien };
        ghi(prefix, sau);
        return sau;
      });
    },
    [columns, prefix],
  );

  const reset = useCallback(() => {
    setBanGhiDe(() => {
      ghi(prefix, {});
      return {};
    });
  }, [prefix]);

  return { visibleColumns, toggleableColumns, isVisible, toggle, reset };
}
