const DAY_MS = 86400000;
const HCM_OFFSET_MS = 7 * 3600000;
const hcmDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function caseCivilDay(date: Date): number {
  if (!Number.isFinite(date.getTime())) return Number.NaN;
  const values = Object.fromEntries(
    hcmDay.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
  );
}
export function caseCivilDayStart(clock: Date): Date {
  return new Date(caseCivilDay(clock) - HCM_OFFSET_MS);
}
export function caseCivilOverdue(deadline: Date, clock: Date): boolean {
  return caseCivilDay(deadline) < caseCivilDay(clock);
}
export function caseCivilDue(deadline: Date, clock: Date, days = 7): boolean {
  const day = caseCivilDay(deadline),
    current = caseCivilDay(clock);
  return day >= current && day <= current + days * DAY_MS;
}
