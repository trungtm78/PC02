import type { ReportDetailView } from './types';

const PERIOD_TYPE_TEXT: Record<string, string> = {
  DAILY: 'Hằng ngày',
  WEEKLY: 'Hằng tuần',
  MONTHLY: 'Hằng tháng',
  QUARTERLY: 'Hằng quý',
  SEMI_ANNUAL: 'Nửa năm',
  YEARLY: 'Hằng năm',
  ONE_TIME: 'Một lần',
};

const WEEKDAY_TEXT = ['', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];

type Rule = Record<string, unknown>;
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** When a period is due, in words an officer reads at a glance. */
export function describeDueRule(due: Rule): string {
  const time = str(due.time) ?? '';
  const at = time ? ` lúc ${time}` : '';
  if (due.kind === 'DAYS_AFTER_END') {
    return `${num(due.days) ?? '?'} ngày sau khi kết thúc kỳ${at}`;
  }
  if (due.kind === 'FIXED_IN_PERIOD') {
    const where = num(due.periodOffset) === 1 ? 'kỳ kế tiếp' : 'chính kỳ';
    const weekday = num(due.anchorWeekday);
    const day = num(due.anchorDay);
    const month = num(due.anchorMonth);
    const parts = [
      weekday ? WEEKDAY_TEXT[weekday] : null,
      day ? `ngày ${day}` : null,
      month ? `tháng thứ ${month}` : null,
    ].filter(Boolean);
    return `${parts.join(' ')} ${where}${at}`.trim();
  }
  return 'Chưa xác định';
}

/** When a period opens for typing. */
export function describeOpenRule(open: Rule): string {
  if (open.kind === 'DAYS_BEFORE_DUE') return `${num(open.days) ?? '?'} ngày trước hạn`;
  return 'Từ đầu kỳ';
}

export function describePeriodType(periodType: string): string {
  return PERIOD_TYPE_TEXT[periodType] ?? periodType;
}

/** One-sentence summary of a report's schedule, e.g. "Hằng tháng · hạn 5 ngày sau khi kết thúc kỳ lúc 17:00 · mở từ đầu kỳ". */
export function describeSchedule(schedule: NonNullable<ReportDetailView['schedule']>): string {
  const parts = [
    describePeriodType(schedule.periodType),
    `hạn ${describeDueRule(schedule.dueRule)}`,
    `mở ${describeOpenRule(schedule.openRule).toLowerCase()}`,
  ];
  if (schedule.periodType === 'MONTHLY' && schedule.periodStartDay && schedule.periodStartDay !== 1) {
    parts.splice(1, 0, `kỳ bắt đầu ngày ${schedule.periodStartDay}`);
  }
  if (schedule.shiftNonWorking) parts.push('dời hạn nếu rơi vào ngày nghỉ');
  return parts.join(' · ');
}
