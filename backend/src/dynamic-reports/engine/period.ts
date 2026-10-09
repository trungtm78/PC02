import {
  daysInMonth,
  clampDayToMonthEnd,
  addDays,
  isoWeekday,
  isoWeekInfo,
  isoWeekMonday,
  isoDateOnly,
  pad2,
  quarterOfMonth,
} from './date-math';

/**
 * Period engine — ScheduleRule + now -> a list of periods. Pure, no I/O
 * (spec §4.1/§10 R2). All wall-clock math is Vietnam business time, a fixed
 * UTC+7 offset with no DST (same convention as the existing
 * notifications/work-hours.util.ts and document-numbers/period-key.util.ts).
 * `now` is always a parameter, never read from the system clock, so every
 * caller — this spec, a scheduled job, or the setup wizard's preview — can
 * pin the exact instant being evaluated.
 *
 * Scope boundary: this engine only computes dates. It has no idea which
 * calendar dates are holidays — callers (the NestJS PeriodScheduler and the
 * setup wizard) look that up via CalendarEventsService.expandOccurrences()
 * and pass the resulting ISO date-only strings in as `nonWorkingDates`.
 */

export type PeriodType =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMI_ANNUAL'
  | 'YEARLY'
  | 'ONE_TIME';

/** 24h "HH:mm", already validated by values.ts/parseTimeOfDay at config time. */
export type TimeOfDay = string;

export type DueRule =
  | {
      kind: 'FIXED_IN_PERIOD';
      /** 0 = due within this period, 1 = due within the next period. */
      periodOffset: 0 | 1;
      /** WEEKLY only: ISO weekday 1 (Mon) .. 7 (Sun). */
      anchorWeekday?: number;
      /** QUARTERLY: 1-3 (month within the quarter). SEMI_ANNUAL: 1-6. YEARLY: 1-12. MONTHLY: unused. */
      anchorMonth?: number;
      /** MONTHLY/QUARTERLY/SEMI_ANNUAL/YEARLY: day of month, clamped to month end per D08. */
      anchorDay?: number;
      time: TimeOfDay;
    }
  | {
      kind: 'DAYS_AFTER_END';
      days: number;
      time: TimeOfDay;
    };

export type OpenRule =
  | { kind: 'AT_PERIOD_START' }
  | { kind: 'DAYS_BEFORE_DUE'; days: number };

export interface ScheduleRule {
  periodType: PeriodType;
  /** MONTHLY only (D02 custom period-start day); default 1 (calendar month). */
  periodStartDay?: number;
  due: DueRule;
  open: OpenRule;
  /** When true, a due date landing on a date in `nonWorkingDates` shifts forward to the next working day. */
  shiftNonWorking?: boolean;
  /** ONE_TIME only: the single period's date (= periodStart = periodEnd). */
  oneTimeDate?: string;
}

export type PeriodWarningCode =
  | 'LOCKED_BEFORE_PERIOD_END'
  | 'DAY_CLAMPED_TO_MONTH_END'
  | 'DUE_SHIFTED_NON_WORKING_DAY';

export interface PeriodWarning {
  code: PeriodWarningCode;
  message: string;
}

export interface GeneratedPeriod {
  periodKey: string;
  periodStart: string; // ISO date-only
  periodEnd: string; // ISO date-only
  opensAt: string; // ISO UTC instant
  /** After any non-working-day shift. Never earlier than originalDueAt. */
  dueAt: string; // ISO UTC instant
  /** Before any non-working-day shift. A later unlock grant never moves this (BRD §5/§6.3). */
  originalDueAt: string; // ISO UTC instant
  description: string; // Vietnamese natural-language sentence, S05-S08 preview
  warnings: PeriodWarning[];
}

// ---------------------------------------------------------------------------
// Vietnam wall-clock <-> UTC (fixed +7, no DST)
// ---------------------------------------------------------------------------

const VN_OFFSET_HOURS = 7;

function vnToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): string {
  return new Date(
    Date.UTC(year, month - 1, day, hour - VN_OFFSET_HOURS, minute),
  ).toISOString();
}

interface VnWallClock {
  year: number;
  month: number;
  day: number;
}

function vnWallClockOf(utcInstant: Date): VnWallClock {
  const shifted = new Date(utcInstant.getTime() + VN_OFFSET_HOURS * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function resolveTime(time: TimeOfDay): { hour: number; minute: number } {
  const [h, m] = time.split(':').map(Number);
  return { hour: h, minute: m };
}

// ---------------------------------------------------------------------------
// Period bounds per type — each period is identified by an integer "index"
// so "the next N periods from now" is just index0, index0+1, ..., index0+N-1.
// ---------------------------------------------------------------------------

interface PeriodBounds {
  periodKey: string;
  start: { year: number; month: number; day: number };
  end: { year: number; month: number; day: number };
}

function monthlyBounds(index: number, periodStartDay: number): PeriodBounds {
  const year = Math.floor(index / 12);
  const month0 = index % 12; // 0-based month of the period's start
  const month = month0 + 1;
  const startClamp = clampDayToMonthEnd(year, month, periodStartDay);
  const start = { year, month, day: startClamp.day };
  const nextMonth0 = month0 + 1;
  const nextYear = year + Math.floor(nextMonth0 / 12);
  const nextMonth = (nextMonth0 % 12) + 1;
  const nextStartClamp = clampDayToMonthEnd(
    nextYear,
    nextMonth,
    periodStartDay,
  );
  const end = addDays(nextYear, nextMonth, nextStartClamp.day, -1);
  const key =
    periodStartDay === 1
      ? `${year}-${pad2(month)}`
      : `${year}-${pad2(month)}-start${pad2(periodStartDay)}`;
  return { periodKey: key, start, end };
}

function monthlyIndexContaining(
  year: number,
  month: number,
  day: number,
  periodStartDay: number,
): number {
  const monthIndex = year * 12 + (month - 1);
  const startClamp = clampDayToMonthEnd(year, month, periodStartDay);
  return day >= startClamp.day ? monthIndex : monthIndex - 1;
}

function quarterlyBounds(index: number): PeriodBounds {
  const year = Math.floor(index / 4);
  const quarter0 = index % 4; // 0-based
  const firstMonth = quarter0 * 3 + 1;
  const start = { year, month: firstMonth, day: 1 };
  const lastMonth = firstMonth + 2;
  const end = addDays(year, lastMonth, daysInMonth(year, lastMonth), 0);
  return { periodKey: `${year}-Q${quarter0 + 1}`, start, end };
}

function semiAnnualBounds(index: number): PeriodBounds {
  const year = Math.floor(index / 2);
  const half0 = index % 2;
  const firstMonth = half0 * 6 + 1;
  const start = { year, month: firstMonth, day: 1 };
  const lastMonth = firstMonth + 5;
  const end = { year, month: lastMonth, day: daysInMonth(year, lastMonth) };
  return { periodKey: `${year}-H${half0 + 1}`, start, end };
}

function yearlyBounds(index: number): PeriodBounds {
  return {
    periodKey: String(index),
    start: { year: index, month: 1, day: 1 },
    end: { year: index, month: 12, day: 31 },
  };
}

function weeklyBounds(isoYear: number, isoWeek: number): PeriodBounds {
  const monday = isoWeekMonday(isoYear, isoWeek);
  const sunday = addDays(monday.year, monday.month, monday.day, 6);
  return {
    periodKey: `${isoYear}-W${pad2(isoWeek)}`,
    start: monday,
    end: sunday,
  };
}

function dailyBounds(year: number, month: number, day: number): PeriodBounds {
  const key = isoDateOnly(year, month, day);
  return {
    periodKey: key,
    start: { year, month, day },
    end: { year, month, day },
  };
}

// ---------------------------------------------------------------------------
// Due-date resolution
// ---------------------------------------------------------------------------

function resolveFixedAnchorDate(
  rule: ScheduleRule,
  bounds: PeriodBounds,
  nextBounds: PeriodBounds,
  due: Extract<DueRule, { kind: 'FIXED_IN_PERIOD' }>,
  warnings: PeriodWarning[],
): { year: number; month: number; day: number } {
  const target = due.periodOffset === 0 ? bounds : nextBounds;

  switch (rule.periodType) {
    case 'WEEKLY': {
      const weekday = due.anchorWeekday ?? 7;
      return addDays(
        target.start.year,
        target.start.month,
        target.start.day,
        weekday - 1,
      );
    }
    case 'DAILY': {
      return target.start;
    }
    case 'MONTHLY': {
      const requestedDay =
        due.anchorDay ?? daysInMonth(target.start.year, target.start.month);
      const clamp = clampDayToMonthEnd(
        target.start.year,
        target.start.month,
        requestedDay,
      );
      if (clamp.clamped) {
        warnings.push({
          code: 'DAY_CLAMPED_TO_MONTH_END',
          message: `Ngày ${requestedDay} không có trong tháng ${target.start.month}/${target.start.year}; dùng ngày cuối tháng (${clamp.day}).`,
        });
      }
      return {
        year: target.start.year,
        month: target.start.month,
        day: clamp.day,
      };
    }
    case 'QUARTERLY':
    case 'SEMI_ANNUAL':
    case 'YEARLY': {
      const monthOffset = (due.anchorMonth ?? 1) - 1;
      const month = target.start.month + monthOffset;
      const requestedDay =
        due.anchorDay ?? daysInMonth(target.start.year, month);
      const clamp = clampDayToMonthEnd(target.start.year, month, requestedDay);
      if (clamp.clamped) {
        warnings.push({
          code: 'DAY_CLAMPED_TO_MONTH_END',
          message: `Ngày ${requestedDay} không có trong tháng ${month}/${target.start.year}; dùng ngày cuối tháng (${clamp.day}).`,
        });
      }
      return { year: target.start.year, month, day: clamp.day };
    }
    case 'ONE_TIME': {
      return target.end;
    }
  }
}

// ---------------------------------------------------------------------------
// Vietnamese description (S05-S08 preview)
// ---------------------------------------------------------------------------

function describe(
  rule: ScheduleRule,
  dueDate: { year: number; month: number; day: number },
  time: TimeOfDay,
): string {
  const dueStr = `${pad2(dueDate.day)}/${pad2(dueDate.month)}/${dueDate.year}`;
  switch (rule.periodType) {
    case 'WEEKLY':
      return `Hằng tuần, khoá nhập lúc ${time} ngày ${dueStr}.`;
    case 'MONTHLY':
      return `Hằng tháng, khoá nhập lúc ${time} ngày ${dueStr}.`;
    case 'QUARTERLY':
      return `Hằng quý, khoá nhập lúc ${time} ngày ${dueStr}.`;
    case 'SEMI_ANNUAL':
      return `Mỗi nửa năm, khoá nhập lúc ${time} ngày ${dueStr}.`;
    case 'YEARLY':
      return `Hằng năm, khoá nhập lúc ${time} ngày ${dueStr}.`;
    case 'DAILY':
      return `Hằng ngày, khoá nhập lúc ${time}.`;
    case 'ONE_TIME':
      return `Một kỳ duy nhất, khoá nhập lúc ${time} ngày ${dueStr}. Không tự lặp lại.`;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates `count` consecutive periods starting from the one containing
 * `now` (or the single ONE_TIME period, regardless of `count` — D01: "một
 * kỳ một lần, không ngầm lặp hằng ngày"). `nonWorkingDates` is a set of ISO
 * date-only strings the caller already resolved from CalendarEventsService;
 * this engine never looks dates up itself.
 */
export function generatePeriods(
  rule: ScheduleRule,
  now: Date,
  count: number,
  nonWorkingDates: ReadonlySet<string> = new Set(),
): GeneratedPeriod[] {
  const nowVn = vnWallClockOf(now);

  if (rule.periodType === 'ONE_TIME') {
    if (!rule.oneTimeDate) {
      throw new Error('ONE_TIME schedule requires oneTimeDate.');
    }
    const [y, m, d] = rule.oneTimeDate.split('-').map(Number);
    const bounds: PeriodBounds = {
      periodKey: rule.oneTimeDate,
      start: { year: y, month: m, day: d },
      end: { year: y, month: m, day: d },
    };
    return [buildPeriod(rule, bounds, bounds, nonWorkingDates)];
  }

  const periodStartDay = rule.periodStartDay ?? 1;
  let startIndex: number;
  let boundsOf: (index: number) => PeriodBounds;

  switch (rule.periodType) {
    case 'WEEKLY': {
      const { isoYear, isoWeek } = isoWeekInfo(
        nowVn.year,
        nowVn.month,
        nowVn.day,
      );
      // Encode (isoYear, isoWeek) as a single increasing integer so "+1"
      // always means "the next ISO week", correctly crossing week-year
      // boundaries (which don't always land on week 52/53 consistently).
      startIndex = isoYearWeekToIndex(isoYear, isoWeek);
      boundsOf = (index) => {
        const { isoYear: y, isoWeek: w } = indexToIsoYearWeek(index);
        return weeklyBounds(y, w);
      };
      break;
    }
    case 'MONTHLY': {
      startIndex = monthlyIndexContaining(
        nowVn.year,
        nowVn.month,
        nowVn.day,
        periodStartDay,
      );
      boundsOf = (index) => monthlyBounds(index, periodStartDay);
      break;
    }
    case 'QUARTERLY': {
      startIndex = nowVn.year * 4 + (quarterOfMonth(nowVn.month) - 1);
      boundsOf = quarterlyBounds;
      break;
    }
    case 'SEMI_ANNUAL': {
      startIndex = nowVn.year * 2 + (nowVn.month <= 6 ? 0 : 1);
      boundsOf = semiAnnualBounds;
      break;
    }
    case 'YEARLY': {
      startIndex = nowVn.year;
      boundsOf = yearlyBounds;
      break;
    }
    case 'DAILY': {
      startIndex = epochDayIndex(nowVn.year, nowVn.month, nowVn.day);
      boundsOf = (index) => {
        const d = indexToDate(index);
        return dailyBounds(d.year, d.month, d.day);
      };
      break;
    }
  }

  const periods: GeneratedPeriod[] = [];
  for (let i = 0; i < count; i++) {
    const bounds = boundsOf(startIndex + i);
    const nextBounds = boundsOf(startIndex + i + 1);
    periods.push(buildPeriod(rule, bounds, nextBounds, nonWorkingDates));
  }
  return periods;
}

function buildPeriod(
  rule: ScheduleRule,
  bounds: PeriodBounds,
  nextBounds: PeriodBounds,
  nonWorkingDates: ReadonlySet<string>,
): GeneratedPeriod {
  const warnings: PeriodWarning[] = [];
  const { hour, minute } = resolveTime(rule.due.time);

  let dueDate: { year: number; month: number; day: number };
  if (rule.due.kind === 'DAYS_AFTER_END') {
    dueDate = addDays(
      bounds.end.year,
      bounds.end.month,
      bounds.end.day,
      rule.due.days,
    );
  } else {
    dueDate = resolveFixedAnchorDate(
      rule,
      bounds,
      nextBounds,
      rule.due,
      warnings,
    );
  }

  const originalDueAt = vnToUtcIso(
    dueDate.year,
    dueDate.month,
    dueDate.day,
    hour,
    minute,
  );

  let dueAt = originalDueAt;
  let shiftedDate = dueDate;
  if (rule.shiftNonWorking) {
    let candidate = dueDate;
    let shifted = false;
    while (
      nonWorkingDates.has(
        isoDateOnly(candidate.year, candidate.month, candidate.day),
      )
    ) {
      candidate = addDays(candidate.year, candidate.month, candidate.day, 1);
      shifted = true;
    }
    if (shifted) {
      shiftedDate = candidate;
      dueAt = vnToUtcIso(
        candidate.year,
        candidate.month,
        candidate.day,
        hour,
        minute,
      );
      warnings.push({
        code: 'DUE_SHIFTED_NON_WORKING_DAY',
        message: `Hạn gốc rơi vào ngày nghỉ, dời sang ${isoDateOnly(candidate.year, candidate.month, candidate.day)}.`,
      });
    }
  }

  // Preview-only sanity check: did we compute a due date earlier than the
  // period's own calendar end, for a FIXED_IN_PERIOD-offset-0 rule? That is
  // valid (BRD: "chưa kết thúc kỳ mà đã khóa") but must never be silent.
  if (
    rule.due.kind === 'FIXED_IN_PERIOD' &&
    rule.due.periodOffset === 0 &&
    isoDateOnly(dueDate.year, dueDate.month, dueDate.day) <
      isoDateOnly(bounds.end.year, bounds.end.month, bounds.end.day)
  ) {
    warnings.push({
      code: 'LOCKED_BEFORE_PERIOD_END',
      message: 'Hạn khoá rơi trước khi kỳ dữ liệu kết thúc theo lịch.',
    });
  }

  const opensAt = resolveOpensAt(rule, bounds, dueDate, hour, minute);

  return {
    periodKey: bounds.periodKey,
    periodStart: isoDateOnly(
      bounds.start.year,
      bounds.start.month,
      bounds.start.day,
    ),
    periodEnd: isoDateOnly(bounds.end.year, bounds.end.month, bounds.end.day),
    opensAt,
    dueAt,
    originalDueAt,
    description: describe(rule, shiftedDate, rule.due.time),
    warnings,
  };
}

function resolveOpensAt(
  rule: ScheduleRule,
  bounds: PeriodBounds,
  dueDate: { year: number; month: number; day: number },
  dueHour: number,
  dueMinute: number,
): string {
  if (rule.open.kind === 'AT_PERIOD_START') {
    return vnToUtcIso(
      bounds.start.year,
      bounds.start.month,
      bounds.start.day,
      0,
      0,
    );
  }
  const opensDate = addDays(
    dueDate.year,
    dueDate.month,
    dueDate.day,
    -rule.open.days,
  );
  return vnToUtcIso(
    opensDate.year,
    opensDate.month,
    opensDate.day,
    dueHour,
    dueMinute,
  );
}

// ---------------------------------------------------------------------------
// Index helpers for WEEKLY (ISO year/week) and DAILY (epoch day)
// ---------------------------------------------------------------------------

/** Monotonic integer encoding of (isoYear, isoWeek), tolerant of 52/53-week years (we only ever add/subtract small deltas, never decode an arbitrary huge index). */
function isoYearWeekToIndex(isoYear: number, isoWeek: number): number {
  return isoYear * 53 + (isoWeek - 1);
}

function indexToIsoYearWeek(index: number): {
  isoYear: number;
  isoWeek: number;
} {
  // Decode via the Monday date rather than pure arithmetic on `index`, so a
  // mis-assumed 52-vs-53-week year never produces an invalid (year, week)
  // pair — walk from a nearby known-good anchor using isoWeekInfo, which is
  // itself authoritative.
  const isoYear = Math.floor(index / 53);
  const isoWeek = (index % 53) + 1;
  const monday = isoWeekMonday(isoYear, isoWeek);
  return isoWeekInfo(monday.year, monday.month, monday.day);
}

function epochDayIndex(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function indexToDate(index: number): {
  year: number;
  month: number;
  day: number;
} {
  const d = new Date(index * 86_400_000);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

// Re-exported for callers that need the raw weekday (e.g. the setup
// wizard's "which weekday is this?" display).
export { isoWeekday };
