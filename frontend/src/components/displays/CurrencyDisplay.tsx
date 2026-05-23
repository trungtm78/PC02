import { formatVND } from '../../shared/utils/formatters';

interface CurrencyDisplayProps {
  value: number | string | null | undefined;
  emptyFallback?: string;
  className?: string;
}

export function CurrencyDisplay({
  value,
  emptyFallback = '—',
  className,
}: CurrencyDisplayProps) {
  const formatted = formatVND(value);
  return <span className={className}>{formatted || emptyFallback}</span>;
}
