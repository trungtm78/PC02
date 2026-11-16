import { wardAssignmentAlerts as t } from '@/locales/wardAssignmentAlerts.vi';

/**
 * The deadline alert of a ward assignment request ("Hạn báo kết quả" coloured): yellow ≤ 7 days, red ≤ 3 days,
 * "Quá hạn N ngày" once past, grey once completed. The level comes from the server (the same rule as the list filter),
 * never recomputed here.
 */
export interface AlertBadgeProps {
  alert: { level: string; dueOn: string | null; daysLeft: number | null };
}

const STYLE: Record<string, string> = {
  NONE: 'bg-slate-50 text-slate-600 border-slate-200',
  YELLOW: 'bg-yellow-50 text-yellow-800 border-yellow-300',
  RED: 'bg-red-50 text-red-700 border-red-300',
  OVERDUE: 'bg-red-600 text-white border-red-700',
  DONE: 'bg-green-50 text-green-700 border-green-200',
};

/** `YYYY-MM-DD` → `DD/MM/YYYY`, as written (a calendar day has no time zone). */
export function dayText(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return '';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

export function alertText(alert: AlertBadgeProps['alert']): string {
  const days = alert.daysLeft ?? 0;
  switch (alert.level) {
    case 'YELLOW':
      return t.alert.YELLOW(days);
    case 'RED':
      return t.alert.RED(days);
    case 'OVERDUE':
      return t.alert.OVERDUE(Math.abs(days));
    case 'DONE':
      return t.alert.DONE;
    default:
      return alert.dueOn ? dayText(alert.dueOn) : t.alert.noDue;
  }
}

export function AlertBadge({ alert }: AlertBadgeProps) {
  const text = alertText(alert);
  const title = alert.dueOn ? t.alert.dueOn(dayText(alert.dueOn)) : t.alert.noDue;
  return (
    <span
      data-testid="ward-alert-badge"
      data-level={alert.level}
      title={title}
      className={`inline-flex items-center whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium ${STYLE[alert.level] ?? STYLE.NONE}`}
    >
      {text}
    </span>
  );
}

export default AlertBadge;
