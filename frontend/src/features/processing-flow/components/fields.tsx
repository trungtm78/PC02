/** Small controls of the step table. A number box keeps the person's typing simple: empty is 0 (or null when allowed). */
import type { ReactNode } from 'react';

const BOX = 'rounded border border-slate-300 bg-white px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-500';

interface NumberFieldProps {
  testId: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  /** Empty means "none" (null) instead of 0. */
  nullable?: boolean;
  min?: number;
  disabled?: boolean;
  className?: string;
}

export function NumberField({ testId, label, value, onChange, nullable = false, min = 0, disabled, className = 'w-16 text-right' }: NumberFieldProps) {
  return (
    <input
      type="number"
      inputMode="numeric"
      data-testid={testId}
      aria-label={label}
      min={min}
      step={1}
      value={value === null ? '' : value}
      disabled={disabled}
      className={`${BOX} ${className}`}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') return onChange(nullable ? null : 0);
        const n = Math.floor(Number(raw));
        onChange(Number.isFinite(n) ? Math.max(min, n) : nullable ? null : 0);
      }}
    />
  );
}

interface SelectFieldProps {
  testId: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  className?: string;
}

export function SelectField({ testId, label, value, onChange, options, disabled, className = '' }: SelectFieldProps) {
  return (
    <select data-testid={testId} aria-label={label} value={value} disabled={disabled} className={`${BOX} ${className}`} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

interface TextFieldProps {
  testId: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function TextField({ testId, label, value, onChange, placeholder, disabled, className = 'w-full' }: TextFieldProps) {
  return (
    <input
      type="text"
      data-testid={testId}
      aria-label={label}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      className={`${BOX} ${className}`}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function CheckField({
  testId,
  label,
  checked,
  onChange,
  disabled,
  children,
}: {
  testId: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700">
      <input type="checkbox" data-testid={testId} aria-label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {children ?? label}
    </label>
  );
}
