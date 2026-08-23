import { type ReactNode, useId } from 'react';
import {
  LABEL_BASE,
  ICON_INPUT_WRAPPER,
  ICON_INPUT_POSITION,
  FIELD_ERROR_TEXT,
  getInputClass,
} from '@/constants/styles';
import { CurrencyInput } from '../inputs/CurrencyInput';

interface FormCurrencyProps {
  label: string;
  required?: boolean;
  error?: string;
  icon?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  colSpan?: 1 | 2 | 3;
  'data-testid'?: string;
}

function getColSpanClass(colSpan?: 1 | 2 | 3): string {
  if (!colSpan || colSpan === 1) return '';
  if (colSpan === 2) return 'md:col-span-2';
  return 'md:col-span-3';
}

export function FormCurrency({
  label,
  required,
  error,
  icon,
  value,
  onChange,
  placeholder,
  colSpan,
  'data-testid': dataTestId,
}: FormCurrencyProps) {
  const hasIcon = !!icon;
  // BUG-008 (UAT 2026-08-23): nhãn phải trỏ tới ô nhập (WCAG 2.2 — 1.3.1/3.3.2/4.1.2).
  const fieldId = useId();
  const errorId = error ? `${fieldId}-error` : undefined;
  const inputClass = getInputClass(!!error, hasIcon);

  const input = (
    <CurrencyInput
      id={fieldId}
      value={value}
      onValueChange={onChange}
      className={inputClass}
      placeholder={placeholder}
      data-testid={dataTestId}
    />
  );

  return (
    <div className={getColSpanClass(colSpan)}>
      <label className={LABEL_BASE} htmlFor={fieldId}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {hasIcon ? (
        <div className={ICON_INPUT_WRAPPER}>
          <span className={ICON_INPUT_POSITION}>{icon}</span>
          {input}
        </div>
      ) : (
        input
      )}
      {error && <p className={FIELD_ERROR_TEXT} id={errorId} data-testid="field-error">{error}</p>}
    </div>
  );
}
