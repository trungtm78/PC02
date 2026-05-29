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

// Module-load ICU probe. Node binaries built with --with-intl=small-icu silently
// fall back to UTC for non-en-US timezones — Intl.DateTimeFormat doesn't throw,
// it just returns wrong values. That would silently regress the v0.47 P0 fix
// (Jan 1 06:30 ICT would stamp documents with year 2026 again, but no test fails
// in CI because CI Node has full-icu). Fail fast at import time instead.
function assertFullIcuVnTz(): void {
  // Dec 31 2026 23:30 UTC = Jan 1 2027 06:30 ICT — VN year MUST be 2027.
  const probeDate = new Date('2026-12-31T23:30:00Z');
  const { y } = tzParts(probeDate, DEFAULT_TZ);
  if (y !== 2027) {
    throw new Error(
      `[period-key.util] ICU full data missing or Asia/Ho_Chi_Minh unsupported. ` +
        `Probe Date(2026-12-31T23:30:00Z) in VN tz returned year ${y}, expected 2027. ` +
        `Rebuild Node with --with-intl=full-icu or set NODE_ICU_DATA. ` +
        `Refusing to boot — would silently corrupt document number annual reset.`,
    );
  }
}
assertFullIcuVnTz();

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
