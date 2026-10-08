import { PatternFormat } from 'react-number-format';
import { useCheDoXem } from '../form/CheDoXem';
import { hydrateLegacyPhone } from '../../shared/utils/formatters';

export interface PhoneInputProps {
  value: string;
  onValueChange: (rawValue: string) => void;
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

export function PhoneInput({
  value,
  onValueChange,
  id,
  className,
  placeholder = '0XXX XXX XXX',
  disabled,
  ...rest
}: PhoneInputProps & Record<string, unknown>) {
  // Chế độ xem của form: chỉ đọc (vẫn chép được). Nơi gọi truyền readOnly riêng thì giữ (rest ghi đè).
  const chiXem = useCheDoXem();
  const normalized = hydrateLegacyPhone(value);

  return (
    <PatternFormat
      format="#### ### ###"
      value={normalized}
      onValueChange={(v) => onValueChange(v.value)}
      id={id}
      className={className}
      placeholder={placeholder}
      disabled={disabled}
      mask=""
      readOnly={chiXem || undefined}
      {...rest}
    />
  );
}
