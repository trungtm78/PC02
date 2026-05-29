export type ResetPeriod = 'YEARLY' | 'MONTHLY' | 'WEEKLY' | 'NEVER' | 'MAX_NUMBER';

// v0.47 (Nghị định 30/2020): annual numbering resets at Jan 1 00:00 local time, not UTC.
// Default tz = Asia/Ho_Chi_Minh so callers don't have to remember.
const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';

function tzParts(date: Date, tz: string): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: 'year' | 'month' | 'day') =>
    Number(parts.find((p) => p.type === type)!.value);
  return { y: get('year'), m: get('month'), d: get('day') };
}

// Project date into tz, then compute ISO week. Returns { isoYear, isoWeek }.
// isoYear may differ from civil year at year edges (e.g. Jan 1 in a W53 of previous year).
function isoWeekParts(date: Date, tz: string): { isoYear: number; isoWeek: number } {
  const { y, m, d } = tzParts(date, tz);
  const utcMidnight = new Date(Date.UTC(y, m - 1, d));
  const dayNum = utcMidnight.getUTCDay() || 7; // Mon=1 ... Sun=7
  utcMidnight.setUTCDate(utcMidnight.getUTCDate() + 4 - dayNum); // shift to Thursday
  const isoYear = utcMidnight.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((utcMidnight.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return { isoYear, isoWeek };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function computePeriodKey(
  resetPeriod: ResetPeriod,
  date: Date,
  tz: string = DEFAULT_TZ,
): string {
  const { y, m } = tzParts(date, tz);

  switch (resetPeriod) {
    case 'YEARLY':
      return String(y);
    case 'MONTHLY':
      return `${y}-${pad2(m)}`;
    case 'WEEKLY': {
      const { isoYear, isoWeek } = isoWeekParts(date, tz);
      return `${isoYear}-W${pad2(isoWeek)}`;
    }
    case 'NEVER':
    case 'MAX_NUMBER':
      return 'global';
    default:
      throw new Error(`Unknown resetPeriod: ${resetPeriod}`);
  }
}
