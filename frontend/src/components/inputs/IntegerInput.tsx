import { NumericFormat } from 'react-number-format';

export interface IntegerInputProps {
  value: string;
  onValueChange: (rawValue: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  'data-testid'?: string;
}

export function IntegerInput({
  value,
  onValueChange,
  id,
  className,
  placeholder = '0',
  disabled,
  min,
  max,
  ...rest
}: IntegerInputProps & Record<string, unknown>) {
  return (
    <NumericFormat
      value={value}
      onValueChange={(v) => {
        let raw = v.value;
        if (raw !== '' && max !== undefined) {
          const num = Number(raw);
          if (num > max) raw = String(max);
        }
        if (raw !== '' && min !== undefined) {
          const num = Number(raw);
          if (num < min) raw = String(min);
        }
        onValueChange(raw);
      }}
      thousandSeparator=""
      decimalScale={0}
      allowNegative={false}
      id={id}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      {...rest}
    />
  );
}
