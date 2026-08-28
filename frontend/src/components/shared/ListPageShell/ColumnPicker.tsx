import { useState } from 'react';
import { Columns3, ChevronUp, ChevronDown } from 'lucide-react';
import { ActionMenuPortal } from '@/components/ActionMenuPortal';
import { BTN_OUTLINE_SLATE, A11Y_FOCUS_RING } from '@/constants/styles';
import type { ColumnDef } from './Table';

/**
 * Nút chọn cột hiển thị, kiểu treeview của Odoo.
 *
 * ĐẶT Ở THANH CÔNG CỤ, KHÔNG Ở GÓC PHẢI HÀNG TIÊU ĐỀ NHƯ ODOO. Bảng của ta cuộn ngang, nên
 * nút nằm ở góc phải hàng tiêu đề sẽ trôi khỏi màn hình đúng lúc người dùng cần nó nhất —
 * họ bật thêm cột, bảng dài ra, rồi phải cuộn đi tìm chính cái nút vừa bấm. Đây là chỗ cố ý
 * lệch khỏi Odoo, và lệch vì cơ chế của ta khác.
 *
 * Menu dùng lại `ActionMenuPortal`: render qua portal ra `document.body` nên không bị
 * `overflow-hidden` của ô hay `overflow-x-auto` của vùng cuộn cắt, và đã lo sẵn bấm-ra-ngoài
 * cùng phím Esc.
 */
export function ColumnPicker<TRow>({
  columns,
  isVisible,
  onToggle,
  onReset,
  onDoiCho,
}: {
  /** Chỉ những cột được phép bật/tắt (cột khai `optional`). */
  columns: ColumnDef<TRow>[];
  isVisible(key: string): boolean;
  onToggle(key: string): void;
  onReset(): void;
  /**
   * Đổi thứ tự cột. Không truyền = menu giữ nguyên như cũ.
   *
   * Đặt ở ĐÂY chứ không kéo tiêu đề trên bảng: bảng cuộn ngang, và tay nắm kéo giãn đã nằm ở
   * mép phải mỗi ô tiêu đề — kéo tiêu đề sang trái phải sẽ đánh nhau với cả hai. Menu cũng là
   * chỗ duy nhất thấy được cột đang ẩn.
   */
  onDoiCho?: (key: string, toiViTri: number) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (columns.length === 0) return null;

  const soDangAn = columns.filter((c) => !isVisible(c.key)).length;

  return (
    <>
      <button
        type="button"
        data-testid="btn-column-picker"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        title="Chọn cột hiển thị"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
        className={`${BTN_OUTLINE_SLATE} ${A11Y_FOCUS_RING} flex items-center gap-2`}
      >
        <Columns3 className="w-4 h-4" />
        <span>Cột</span>
        {soDangAn > 0 && (
          // Cho biết đang có cột bị ẩn. Không có dấu hiệu này thì cán bộ tưởng hệ thống
          // thiếu dữ liệu, trong khi thật ra chính họ đã tắt cột đi từ hôm trước.
          <span
            data-testid="column-picker-hidden-count"
            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-slate-500 text-white text-xs font-semibold"
          >
            {soDangAn}
          </span>
        )}
      </button>

      <ActionMenuPortal
        anchor={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
        align="left"
        minWidth={260}
      >
        <div role="menu" data-testid="column-picker-menu" className="py-1">
          {columns.map((cot, i) => {
            const hien = isVisible(cot.key);
            return (
              <label
                key={cot.key}
                data-testid={`column-toggle-${cot.key}`}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={hien}
                  onChange={() => onToggle(cot.key)}
                  className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="flex-1">{cot.header}</span>
                {onDoiCho && (
                  // Nút dời nằm TRONG `<label>`, nên phải chặn lan: không chặn thì mỗi lần dời
                  // cột là một lần bật/tắt cột ấy, và người dùng bấm "dời lên" thì cột biến mất.
                  <span className="flex shrink-0 gap-0.5">
                    <button
                      type="button"
                      data-testid={`doi-cho-len-${cot.key}`}
                      aria-label={`Dời ${cot.header} lên trước`}
                      disabled={i === 0}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDoiCho(cot.key, i - 1);
                      }}
                      className={`${A11Y_FOCUS_RING} rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent`}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      data-testid={`doi-cho-xuong-${cot.key}`}
                      aria-label={`Dời ${cot.header} xuống sau`}
                      disabled={i === columns.length - 1}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDoiCho(cot.key, i + 1);
                      }}
                      className={`${A11Y_FOCUS_RING} rounded p-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent`}
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </label>
            );
          })}

          <div className="mt-1 border-t border-slate-200 pt-1">
            <button
              type="button"
              data-testid="btn-column-reset"
              onClick={onReset}
              className={`w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 ${A11Y_FOCUS_RING}`}
            >
              Về mặc định
            </button>
          </div>
        </div>
      </ActionMenuPortal>
    </>
  );
}
