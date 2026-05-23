import { PatternFormat } from 'react-number-format';
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
      {...rest}
    />
  );
}
