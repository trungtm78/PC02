import { useId, type ReactNode } from "react";
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

/**
 * Nhãn NỐI với ô nhập bằng `htmlFor`.
 *
 * Trước đây nhãn và ô chỉ là hai thẻ cạnh nhau: bấm vào nhãn không đưa con trỏ vào ô, và
 * trình đọc màn hình không biết nhãn ấy thuộc ô nào. Với form vụ án dài hơn 200 ô thì đó
 * không phải chi tiết nhỏ.
 */
function FieldLabel({ label, required, htmlFor }: { label: string; required?: boolean; htmlFor: string }) {
  return (
    <label className={LABEL_BASE} htmlFor={htmlFor}>
      {label} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

// ─── Error Message ──────────────────────────────────────────────────────────

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className={FIELD_ERROR_TEXT} data-testid="field-error">{error}</p>;
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
  const id = useId();

  const input = (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
      placeholder={placeholder}
      min={min}
      data-testid={dataTestId}
    />
  );

  return (
    <div className={getColSpanClass(colSpan)}>
      <FieldLabel label={label} required={required} htmlFor={id} />
      {hasIcon ? (
        <div className={ICON_INPUT_WRAPPER}>
          <span className={ICON_INPUT_POSITION}>{icon}</span>
          {input}
        </div>
      ) : (
        input
      )}
      <FieldError error={error} />
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
  const id = useId();

  const select = (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={selectClass}
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
      <FieldLabel label={label} required={required} htmlFor={id} />
      {hasIcon ? (
        <div className={ICON_INPUT_WRAPPER}>
          <span className={ICON_INPUT_POSITION}>{icon}</span>
          {select}
        </div>
      ) : (
        select
      )}
      <FieldError error={error} />
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
  const id = useId();

  return (
    <div className={getColSpanClass(colSpan)}>
      <FieldLabel label={label} required={required} htmlFor={id} />
      {hasIcon ? (
        <div className={ICON_INPUT_WRAPPER}>
          <span className="absolute left-3 top-3 w-4 h-4 text-slate-400">{icon}</span>
          <textarea
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            className={`${TEXTAREA_BASE} pl-9`}
            placeholder={placeholder}
            data-testid={dataTestId}
          />
        </div>
      ) : (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={TEXTAREA_BASE}
          placeholder={placeholder}
          data-testid={dataTestId}
        />
      )}
      <FieldError error={error} />
    </div>
  );
}
