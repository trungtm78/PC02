import { NumericFormat } from 'react-number-format';
import { useCheDoXem } from '../form/CheDoXem';

export interface CurrencyInputProps {
  value: string;
  onValueChange: (rawValue: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

export function CurrencyInput({
  value,
  onValueChange,
  id,
  className,
  placeholder = '0 ₫',
  disabled,
  ...rest
}: CurrencyInputProps & Record<string, unknown>) {
  // Chế độ xem của form: chỉ đọc (vẫn chép được). Nơi gọi truyền readOnly riêng thì giữ (rest ghi đè).
  const chiXem = useCheDoXem();
  return (
    <NumericFormat
      value={value}
      onValueChange={(v) => onValueChange(v.value)}
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={0}
      allowNegative={false}
      suffix=" ₫"
      id={id}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={chiXem || undefined}
      {...rest}
    />
  );
}
