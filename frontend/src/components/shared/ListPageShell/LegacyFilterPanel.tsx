import { useId, useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Search, RotateCcw, FileSpreadsheet, CalendarRange, ChevronDown } from 'lucide-react';
import {
  INPUT_BASE,
  BTN_PRIMARY,
  BTN_OUTLINE_SLATE,
  BTN_OUTLINE_BLUE,
  A11Y_FOCUS_RING,
} from '@/constants/styles';
import { DATE_RANGE_PRESETS, tinhKhoangThoiGian } from './dateRangePresets';

/**
 * Thẻ lọc hai vế theo hệ cũ — cán bộ đã quen bố cục này.
 *
 * THUẦN TRÌNH BÀY: nhận giá trị + gọi lại, không tự đụng địa chỉ trang. Trang gọi nối vào
 * `useListPageUrlState` của nó. Nhờ vậy kiểm được mà không cần dựng router, và ba trang
 * dùng chung một component thay vì ba bản sao rời nhau.
 */

export interface LegacyFilterOption {
  value: string;
  label: string;
}

export interface LegacyFilterField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select';
  placeholder?: string;
  options?: LegacyFilterOption[];
  /** Vế trái hay vế phải của thẻ lọc, theo bố cục hệ cũ. */
  side: 'left' | 'right';
}

export interface LegacyFilterPanelProps {
  fields: LegacyFilterField[];
  values: Record<string, string>;
  /**
   * Nhận NGUYÊN CỤM thay đổi thay vì từng ô một. Mốc thời gian ghi cả `fromDate` lẫn
   * `toDate`; gọi hai lần rời nhau thì ở component cha có kiểm soát, lần sau ghi đè trạng
   * thái của lần trước và một mốc biến mất mà không ai thấy.
   */
  onChange(updates: Record<string, string>): void;
  onApply(): void;
  onReset(): void;
  /** Chỉ truyền khi trang thật sự xuất được — không truyền thì nút không hiện. */
  onExportExcel?(): void;
  /** Mốc "hôm nay" cho các khoảng dựng sẵn. Tách ra để ca kiểm cố định được thời điểm. */
  today?: Date;
}

export function LegacyFilterPanel({
  fields,
  values,
  onChange,
  onApply,
  onReset,
  onExportExcel,
  today,
}: LegacyFilterPanelProps) {
  const idPrefix = useId();
  const [openPresets, setOpenPresets] = useState(false);
  const presetRef = useRef<HTMLDivElement>(null);

  // Bấm ra ngoài thì đóng danh sách mốc — bỏ qua bước này thì menu dính lại che bảng.
  useEffect(() => {
    if (!openPresets) return;
    const onDocClick = (e: MouseEvent) => {
      if (presetRef.current && !presetRef.current.contains(e.target as Node)) {
        setOpenPresets(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openPresets]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onApply();
    }
  };

  const renderField = (f: LegacyFilterField) => {
    const id = `${idPrefix}-${f.key}`;
    const value = values[f.key] ?? '';
    const common = {
      id,
      value,
      onKeyDown,
      className: INPUT_BASE,
      'data-testid': `legacy-filter-${f.key}`,
    };

    return (
      <div key={f.key} className="flex items-center gap-3">
        <label htmlFor={id} className="w-36 shrink-0 text-sm font-medium text-slate-700 text-right">
          {f.label}
        </label>
        {f.type === 'select' ? (
          <select {...common} onChange={(e) => onChange({ [f.key]: e.target.value })}>
            {(f.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            {...common}
            type={f.type === 'date' ? 'date' : 'text'}
            placeholder={f.placeholder}
            onChange={(e) => onChange({ [f.key]: e.target.value })}
          />
        )}
      </div>
    );
  };

  const left = fields.filter((f) => f.side === 'left');
  const right = fields.filter((f) => f.side === 'right');

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 shadow-sm">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
        <div data-testid="legacy-filter-left" className="space-y-3">
          {left.map(renderField)}
          <div className="flex flex-wrap items-center gap-2 pl-[9.75rem]">
            <button type="button" onClick={onReset} className={`${BTN_OUTLINE_SLATE} ${A11Y_FOCUS_RING}`}>
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Xóa bộ lọc
            </button>
            {onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                className={`${BTN_OUTLINE_BLUE} ${A11Y_FOCUS_RING}`}
              >
                <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                Xuất Excel
              </button>
            )}
          </div>
        </div>

        <div data-testid="legacy-filter-right" className="space-y-3">
          {right.map(renderField)}
          <div className="flex flex-wrap items-center gap-2 pl-[9.75rem]">
            <div className="relative" ref={presetRef}>
              <button
                type="button"
                onClick={() => setOpenPresets((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={openPresets}
                className={`${BTN_OUTLINE_SLATE} ${A11Y_FOCUS_RING}`}
              >
                <CalendarRange className="w-4 h-4" aria-hidden="true" />
                Chọn khoảng thời gian
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              {openPresets && (
                <div
                  role="menu"
                  className="absolute z-20 mt-1 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
                >
                  {DATE_RANGE_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      role="menuitem"
                      type="button"
                      className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                      onClick={() => {
                        const khoang = tinhKhoangThoiGian(p.key, today ?? new Date());
                        setOpenPresets(false);
                        if (khoang) onChange({ ...khoang });
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={onApply} className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING}`}>
              <Search className="w-4 h-4" aria-hidden="true" />
              Tìm kiếm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
