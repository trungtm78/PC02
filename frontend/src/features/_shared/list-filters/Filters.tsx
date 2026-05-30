import {
  FILTER_PANEL,
  FILTER_GRID,
  BTN_PRIMARY,
  BTN_OUTLINE_SLATE,
  A11Y_FOCUS_RING,
} from '@/constants/styles';
import type { ListFilterRegistry, FilterField } from './registry';

interface FiltersProps<TValue extends object> {
  registry: ListFilterRegistry<TValue>;
  value: TValue;
  onChange: <K extends keyof TValue & string>(key: K, value: string) => void;
  onApply: () => void;
  onReset: () => void;
  hasUnappliedChanges: boolean;
}

const INPUT_BASE =
  'block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100';
const LABEL_BASE = 'block text-sm font-medium text-slate-700 mb-1';

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
          />
        ))}
      </div>
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
}

function FieldInput<TValue>({ field, value, onChange }: FieldInputProps<TValue>) {
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
          {(field.options ?? []).map((opt) => (
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
