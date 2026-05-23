import { type ReactNode } from 'react';
import {
  LABEL_BASE,
  ICON_INPUT_WRAPPER,
  ICON_INPUT_POSITION,
  FIELD_ERROR_TEXT,
  getInputClass,
} from '@/constants/styles';
import { IntegerInput } from '../inputs/IntegerInput';

interface FormIntegerProps {
  label: string;
  required?: boolean;
  error?: string;
  icon?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  colSpan?: 1 | 2 | 3;
  'data-testid'?: string;
}

function getColSpanClass(colSpan?: 1 | 2 | 3): string {
  if (!colSpan || colSpan === 1) return '';
  if (colSpan === 2) return 'md:col-span-2';
  return 'md:col-span-3';
}

export function FormInteger({
  label,
  required,
  error,
  icon,
  value,
  onChange,
  placeholder,
  min,
  max,
  colSpan,
  'data-testid': dataTestId,
}: FormIntegerProps) {
  const hasIcon = !!icon;
  const inputClass = getInputClass(!!error, hasIcon);

  const input = (
    <IntegerInput
      value={value}
      onValueChange={onChange}
      className={inputClass}
      placeholder={placeholder}
      min={min}
      max={max}
      data-testid={dataTestId}
    />
  );

  return (
    <div className={getColSpanClass(colSpan)}>
      <label className={LABEL_BASE}>
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
      {error && <p className={FIELD_ERROR_TEXT} data-testid="field-error">{error}</p>}
    </div>
  );
}
