import type { ReactNode } from 'react';
import {
  FILTER_PANEL,
  FILTER_GRID,
  BTN_PRIMARY,
  BTN_OUTLINE_SLATE,
  A11Y_FOCUS_RING,
  INPUT_BASE,
  LABEL_BASE,
} from '@/constants/styles';
import type { ListFilterRegistry, FilterField, EnumOption } from './registry';

interface FiltersProps<TValue extends object> {
  registry: ListFilterRegistry<TValue>;
  value: TValue;
  onChange: <K extends keyof TValue & string>(key: K, value: string) => void;
  onApply: () => void;
  onReset: () => void;
  hasUnappliedChanges: boolean;
  /**
   * Lựa chọn nạp lúc chạy cho ô `enumSelect`, khoá theo `field.key`.
   *
   * Ô như "Cán bộ nhập" lấy danh sách từ máy chủ nên không khai cứng trong registry được.
   * Mở rộng chính primitive này thay vì dựng một mặt lọc thứ hai — hai mặt lọc trên một
   * màn hình thì không có cách nào đúng để trả lời "ô nào đang có hiệu lực".
   */
  dynamicOptions?: Record<string, EnumOption[]>;
  /** Nội dung phụ chèn dưới lưới ô lọc (vd chip khoảng thời gian). */
  children?: ReactNode;
}

/**
 * v0.62 PR1a — Smart filter panel.
 *
 * Reads filter registry → renders responsive 3-col (mobile: 1-col) grid.
 * Bind value/onChange directly to driver hook (useListFilters draft state).
 * Áp dụng + Xóa buttons at bottom-right.
 *
 * Per Claude eng review #7: reuse existing FILTER_PANEL + FILTER_GRID tokens.
 */
export function Filters<TValue extends object>({
  registry,
  value,
  onChange,
  onApply,
  onReset,
  hasUnappliedChanges,
  dynamicOptions,
  children,
}: FiltersProps<TValue>) {
  const fields = registry.all();
  const v = value as Record<string, string | undefined>;
  return (
    <div className={FILTER_PANEL}>
      <div className={FILTER_GRID}>
        {fields.map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            value={v[field.key] ?? ''}
            onChange={(val) => onChange(field.key, val)}
            options={dynamicOptions?.[field.key] ?? field.options}
          />
        ))}
      </div>
      {children}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          data-testid="btn-clear-filters"
          className={`${BTN_OUTLINE_SLATE} ${A11Y_FOCUS_RING}`}
          onClick={onReset}
        >
          Xóa lọc
        </button>
        <button
          type="button"
          data-testid="btn-apply-filters"
          disabled={!hasUnappliedChanges}
          className={`${BTN_PRIMARY} ${A11Y_FOCUS_RING}`}
          onClick={onApply}
        >
          Áp dụng
        </button>
      </div>
    </div>
  );
}

interface FieldInputProps<TValue> {
  field: FilterField<TValue>;
  value: string;
  onChange: (value: string) => void;
  options?: EnumOption[];
}

function FieldInput<TValue>({ field, value, onChange, options }: FieldInputProps<TValue>) {
  if (field.type === 'enumSelect') {
    return (
      <div>
        <label className={LABEL_BASE} htmlFor={`filter-${field.key}-input`}>
          {field.label}
        </label>
        <select
          id={`filter-${field.key}-input`}
          data-testid={field.testid}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT_BASE}
        >
          <option value="">— Tất cả —</option>
          {(options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  const inputType = field.type === 'date' ? 'date' : 'text';
  return (
    <div>
      <label className={LABEL_BASE} htmlFor={`filter-${field.key}-input`}>
        {field.label}
      </label>
      <input
        id={`filter-${field.key}-input`}
        data-testid={field.testid}
        type={inputType}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_BASE}
      />
    </div>
  );
}
