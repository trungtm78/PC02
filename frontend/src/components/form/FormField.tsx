import { type ReactNode, useId } from "react";
import {
  LABEL_BASE,
  ICON_INPUT_WRAPPER,
  ICON_INPUT_POSITION,
  FIELD_ERROR_TEXT,
  getInputClass,
  getSelectClass,
  TEXTAREA_BASE,
} from "@/constants/styles";

// ─── Types ──────────────────────────────────────────────────────────────────

interface BaseFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  icon?: ReactNode;
  className?: string;
  colSpan?: 1 | 2 | 3;
}

interface InputFieldProps extends BaseFieldProps {
  type?: "text" | "date" | "time" | "tel" | "email" | "number";
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: string | number;
  "data-testid"?: string;
}

interface SelectFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  "data-testid"?: string;
  autoFocus?: boolean;
}

interface TextareaFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  "data-testid"?: string;
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function getColSpanClass(colSpan?: 1 | 2 | 3): string {
  if (!colSpan || colSpan === 1) return "";
  if (colSpan === 2) return "md:col-span-2";
  return "md:col-span-3";
}

// ─── Label ──────────────────────────────────────────────────────────────────

// BUG-008 (UAT 2026-08-23): nhãn phải TRỎ tới ô nhập, không chỉ nằm cạnh về mặt thị giác.
// Thiếu liên kết này thì người dùng trình đọc màn hình không biết đang nhập gì
// (WCAG 2.2 — 1.3.1, 3.3.2, 4.1.2), và công cụ kiểm thử buộc phải đoán nhãn theo vị trí.
function FieldLabel({
  label,
  required,
  htmlFor,
}: {
  label: string;
  required?: boolean;
  htmlFor?: string;
}) {
  return (
    <label className={LABEL_BASE} htmlFor={htmlFor}>
      {label} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

// ─── Error Message ──────────────────────────────────────────────────────────

function FieldError({ error, id }: { error?: string; id?: string }) {
  if (!error) return null;
  return (
    <p className={FIELD_ERROR_TEXT} id={id} data-testid="field-error">
      {error}
    </p>
  );
}

// ─── FormInput ──────────────────────────────────────────────────────────────

export function FormInput({
  label,
  required,
  error,
  icon,
  type = "text",
  value,
  onChange,
  placeholder,
  min,
  colSpan,
  "data-testid": dataTestId,
}: InputFieldProps) {
  const hasIcon = !!icon;
  const inputClass = getInputClass(!!error, hasIcon);
  const fieldId = useId();
  const errorId = error ? `${fieldId}-error` : undefined;

  const input = (
    <input
      id={fieldId}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
      placeholder={placeholder}
      min={min}
      aria-invalid={error ? true : undefined}
      aria-describedby={errorId}
      data-testid={dataTestId}
    />
  );

  return (
    <div className={getColSpanClass(colSpan)}>
      <FieldLabel label={label} required={required} htmlFor={fieldId} />
      {hasIcon ? (
        <div className={ICON_INPUT_WRAPPER}>
          <span className={ICON_INPUT_POSITION}>{icon}</span>
          {input}
        </div>
      ) : (
        input
      )}
      <FieldError error={error} id={errorId} />
    </div>
  );
}

// ─── FormSelect ─────────────────────────────────────────────────────────────

export function FormSelect({
  label,
  required,
  error,
  icon,
  value,
  onChange,
  options,
  placeholder = "-- Chon --",
  colSpan,
  "data-testid": dataTestId,
  autoFocus,
}: SelectFieldProps) {
  const hasIcon = !!icon;
  const selectClass = getSelectClass(!!error, hasIcon);
  const fieldId = useId();
  const errorId = error ? `${fieldId}-error` : undefined;

  const select = (
    <select
      id={fieldId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={selectClass}
      aria-invalid={error ? true : undefined}
      aria-describedby={errorId}
      data-testid={dataTestId}
      autoFocus={autoFocus}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className={getColSpanClass(colSpan)}>
      <FieldLabel label={label} required={required} htmlFor={fieldId} />
      {hasIcon ? (
        <div className={ICON_INPUT_WRAPPER}>
          <span className={ICON_INPUT_POSITION}>{icon}</span>
          {select}
        </div>
      ) : (
        select
      )}
      <FieldError error={error} id={errorId} />
    </div>
  );
}

// ─── FormTextarea ───────────────────────────────────────────────────────────

export function FormTextarea({
  label,
  required,
  error,
  icon,
  value,
  onChange,
  placeholder,
  rows = 4,
  colSpan,
  "data-testid": dataTestId,
}: TextareaFieldProps) {
  const hasIcon = !!icon;
  const fieldId = useId();
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <div className={getColSpanClass(colSpan)}>
      <FieldLabel label={label} required={required} htmlFor={fieldId} />
      {hasIcon ? (
        <div className={ICON_INPUT_WRAPPER}>
          <span className="absolute left-3 top-3 w-4 h-4 text-slate-400">{icon}</span>
          <textarea
            id={fieldId}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            className={`${TEXTAREA_BASE} pl-9`}
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            data-testid={dataTestId}
          />
        </div>
      ) : (
        <textarea
          id={fieldId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={TEXTAREA_BASE}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          data-testid={dataTestId}
        />
      )}
      <FieldError error={error} id={errorId} />
    </div>
  );
}
