import { type ReactNode } from 'react';
import {
  ICON_INPUT_WRAPPER,
  ICON_INPUT_POSITION,
  getInputClass,
} from '@/constants/styles';
import { IntegerInput } from '../inputs/IntegerInput';
import { FieldLabel, FieldError } from './FormField';
import { useNoiNhanO } from './useNoiNhanO';

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
  // Nhãn nối với ô + aria bắt buộc/lỗi (trình đọc màn hình).
  const { id, errorId, aria } = useNoiNhanO(required, error);

  const input = (
    <IntegerInput
      value={value}
      onValueChange={onChange}
      className={inputClass}
      placeholder={placeholder}
      min={min}
      max={max}
      data-testid={dataTestId}
      id={id}
      {...aria}
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
      <FieldError error={error} id={errorId} />
    </div>
  );
}
