import { formatPhone, hydrateLegacyPhone } from '../../shared/utils/formatters';

interface PhoneDisplayProps {
  value: string | null | undefined;
  emptyFallback?: string;
  className?: string;
}

export function PhoneDisplay({
  value,
  emptyFallback = '—',
  className,
}: PhoneDisplayProps) {
  if (!value) return <span className={className}>{emptyFallback}</span>;
  const normalized = hydrateLegacyPhone(value);
  const formatted = formatPhone(normalized);
  return <span className={className}>{formatted || emptyFallback}</span>;
}
