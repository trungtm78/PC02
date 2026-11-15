/** Pure moves on the working calendar of one year, as the editor holds it. Days are `YYYY-MM-DD`, never instants. */
import type { CalendarDayKind, CalendarExpectation, CalendarYearDto, SaveCalendarYearBody } from './types';

export interface CalendarEditDay {
  date: string;
  kind: CalendarDayKind;
  label: string | null;
}

export interface CalendarEditState {
  /** JavaScript weekday numbers off every week: 0 = Sunday ... 6 = Saturday. */
  weekendDays: number[];
  days: CalendarEditDay[];
  note: string;
}

export const DEFAULT_WEEKEND_DAYS: number[] = [0, 6];

/** The largest range the helper expands: a whole leap year. */
const MAX_RANGE = 366;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The UTC epoch of a day, or null when it is not a real calendar day (`2026-02-30`). */
function epochOf(day: string): number | null {
  const m = ISO_DAY.exec(day);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const back = new Date(t);
  return back.getUTCFullYear() === Number(m[1]) && back.getUTCMonth() === Number(m[2]) - 1 && back.getUTCDate() === Number(m[3]) ? t : null;
}

const isoOf = (epoch: number): string => new Date(epoch).toISOString().slice(0, 10);

/** Every day from `from` to `to`, both included; empty when either is not a day or `to` is before `from`. */
export function expandRange(from: string, to: string): string[] {
  const a = epochOf(from);
  const b = epochOf(to);
  if (a === null || b === null || b < a) return [];
  const out: string[] = [];
  for (let t = a; t <= b && out.length < MAX_RANGE; t += 86_400_000) out.push(isoOf(t));
  return out;
}

export function emptyEditState(): CalendarEditState {
  return { weekendDays: [...DEFAULT_WEEKEND_DAYS], days: [], note: '' };
}

export function editStateFrom(stored: CalendarYearDto | null): CalendarEditState {
  if (!stored) return emptyEditState();
  return {
    weekendDays: [...stored.weekendDays].sort((x, y) => x - y),
    days: stored.days.map((d) => ({ date: d.date, kind: d.kind, label: d.label })),
    note: stored.note ?? '',
  };
}

/** Puts days into the year's list (a day already there is replaced), in date order; days of other years are counted and left out. */
export function addDaysInYear(
  days: CalendarEditDay[],
  year: number,
  dates: string[],
  kind: CalendarDayKind,
  label: string,
): { days: CalendarEditDay[]; skipped: number } {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cleaned = label.trim() === '' ? null : label.trim();
  let skipped = 0;
  for (const date of dates) {
    if (epochOf(date) === null || !date.startsWith(`${year}-`)) {
      skipped += 1;
      continue;
    }
    byDate.set(date, { date, kind, label: cleaned });
  }
  return { days: [...byDate.values()].sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0)), skipped };
}

export function removeDay(days: CalendarEditDay[], date: string): CalendarEditDay[] {
  return days.filter((d) => d.date !== date);
}

export function toggleWeekendDay(weekend: number[], weekday: number, on: boolean): number[] {
  const rest = weekend.filter((d) => d !== weekday);
  return (on ? [...rest, weekday] : rest).sort((x, y) => x - y);
}

export function toSaveBody(state: CalendarEditState, expected: CalendarExpectation | null): SaveCalendarYearBody {
  const note = state.note.trim();
  return {
    weekendDays: state.weekendDays,
    days: state.days.map((d) => ({ date: d.date, kind: d.kind, ...(d.label ? { label: d.label } : {}) })),
    ...(note ? { note } : {}),
    expected,
  };
}

/** Whether what would be saved differs from what was last read. */
export function calendarDirty(state: CalendarEditState, stored: CalendarYearDto | null): boolean {
  return JSON.stringify(toSaveBody(state, null)) !== JSON.stringify(toSaveBody(editStateFrom(stored), null));
}
