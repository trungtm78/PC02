export type ResetPeriod = 'YEARLY' | 'MONTHLY' | 'WEEKLY' | 'NEVER' | 'MAX_NUMBER';

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1 ... Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // shift to Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function computePeriodKey(resetPeriod: ResetPeriod, date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;

  switch (resetPeriod) {
    case 'YEARLY':
      return String(y);
    case 'MONTHLY':
      return `${y}-${pad2(m)}`;
    case 'WEEKLY':
      return `${y}-W${pad2(isoWeekNumber(date))}`;
    case 'NEVER':
    case 'MAX_NUMBER':
      return 'global';
    default:
      throw new Error(`Unknown resetPeriod: ${resetPeriod}`);
  }
}
