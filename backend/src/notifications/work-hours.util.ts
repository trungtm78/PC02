const WORK_START_HOUR = 7;
const WORK_END_HOUR = 18;
const VN_UTC_OFFSET = 7; // Vietnam = UTC+7, no DST

function vnHourOf(utcDate: Date): number {
  return (utcDate.getUTCHours() + VN_UTC_OFFSET) % 24;
}

function vnDayOf(utcDate: Date): number {
  // If VN clock has crossed midnight ahead of UTC, the VN day is +1
  const crossed = utcDate.getUTCHours() + VN_UTC_OFFSET >= 24;
  return (utcDate.getUTCDay() + (crossed ? 1 : 0)) % 7;
}

function isWorkDay(vnDay: number): boolean {
  return vnDay >= 1 && vnDay <= 6; // Mon–Sat
}

function isWorkHour(vnHour: number): boolean {
  return vnHour >= WORK_START_HOUR && vnHour < WORK_END_HOUR;
}

/**
 * Returns the next moment that falls within work hours (07:00–18:00 VN, Mon–Sat).
 * If `from` is already in a work window, returns `from` unchanged.
 *
 * D8:  Uses getUTCHours()+7 — server may run in UTC, getHours() would be wrong.
 * D11a: Checks same-day 07:00 VN before advancing to next calendar day.
 */
export function nextWorkHoursTime(from: Date = new Date()): Date {
  const vnHour = vnHourOf(from);
  const vnDay = vnDayOf(from);

  if (isWorkDay(vnDay) && isWorkHour(vnHour)) {
    return from; // already in window
  }

  // Build a candidate: same UTC calendar day at 00:00 UTC = 07:00 VN
  const candidate = new Date(from);
  candidate.setUTCHours(0, 0, 0, 0); // 00:00 UTC = 07:00 VN

  if (candidate > from && isWorkDay(vnDayOf(candidate))) {
    // D11a: same-day 07:00 is still in the future and today is a work day
    return candidate;
  }

  // Advance one day at a time, skipping Sundays (vnDay === 0)
  candidate.setUTCDate(candidate.getUTCDate() + 1);
  while (!isWorkDay(vnDayOf(candidate))) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}

/**
 * Exponential backoff retry schedule: 1h, 2h, 4h.
 * Always warps the raw time through nextWorkHoursTime() so retries never
 * land outside the 07:00–18:00 VN window. (D11b)
 */
export function nextRetryTime(retryCount: number): Date {
  const hours = Math.pow(2, retryCount); // 1, 2, 4
  const raw = new Date(Date.now() + hours * 60 * 60 * 1000);
  return nextWorkHoursTime(raw);
}
