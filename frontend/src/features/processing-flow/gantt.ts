/**
 * Geometry of the read-only Gantt chart. Everything is DRAWN from the instants the server computed (`startAt`,
 * `dueAt`, `greenFrom`, `yellowFrom`, `redFrom`): the browser never works out a deadline, it only turns instants into
 * positions on a day axis.
 */
import type { SchedulePreviewRow } from './types';

const DAY = 86_400_000;
const VN_OFFSET = 7 * 3_600_000;

export type SegmentKind = 'base' | 'green' | 'yellow' | 'red';

export interface GanttSegment {
  kind: SegmentKind;
  /** Milliseconds; only the proportions matter (used as `flex-grow`). */
  size: number;
}

export interface GanttBar {
  stepIndex: number;
  drawn: boolean;
  startPct: number;
  widthPct: number;
  /** Where the deadline is, as a share of the axis. */
  duePct: number;
  segments: GanttSegment[];
  provisional: boolean;
  /** Why the step has no bar (an error code of the contract); null when it is drawn. */
  problem: string | null;
  startAt: string | null;
  dueAt: string | null;
}

export interface GanttTick {
  pct: number;
  label: string;
}

export interface GanttModel {
  bars: GanttBar[];
  ticks: GanttTick[];
  /** Midnight (Vietnam) of the day the axis starts on, in epoch milliseconds. */
  originMs: number;
  totalDays: number;
  recordDeadlinePct: number | null;
}

const vnDayStart = (ms: number): number => Math.floor((ms + VN_OFFSET) / DAY) * DAY - VN_OFFSET;
const ms = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

function tickLabel(epochMs: number): string {
  const d = new Date(epochMs + VN_OFFSET);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Days between two ticks: more days on the axis, fewer labels. */
const tickEvery = (totalDays: number): number => (totalDays <= 20 ? 2 : totalDays <= 45 ? 5 : totalDays <= 130 ? 10 : 30);

export function buildGantt(rows: readonly SchedulePreviewRow[], recordDeadline: string | null): GanttModel {
  const drawable = rows.filter((r) => ms(r.startAt) !== null && ms(r.dueAt) !== null);
  if (drawable.length === 0) {
    return {
      bars: rows.map((r) => emptyBar(r)),
      ticks: [],
      originMs: 0,
      totalDays: 0,
      recordDeadlinePct: null,
    };
  }
  const originMs = vnDayStart(Math.min(...drawable.map((r) => ms(r.startAt) as number)));
  const lastDue = Math.max(...drawable.map((r) => ms(r.dueAt) as number));
  const span = Math.max(1, Math.ceil((lastDue - originMs) / DAY));
  const totalDays = span + Math.max(3, Math.ceil(span * 0.14));
  const axis = totalDays * DAY;
  const pct = (t: number): number => ((t - originMs) / axis) * 100;

  const bars = rows.map((r): GanttBar => {
    const start = ms(r.startAt);
    const due = ms(r.dueAt);
    if (start === null || due === null) return emptyBar(r);
    const clamp = (t: number | null, fallback: number): number => Math.min(Math.max(t ?? fallback, start), Math.max(due, start));
    // A band that begins before the bar (a threshold longer than the step) is clipped to the bar.
    const green = clamp(ms(r.greenFrom), due);
    const yellow = Math.max(green, clamp(ms(r.yellowFrom), due));
    const red = Math.max(yellow, clamp(ms(r.redFrom), due));
    return {
      stepIndex: r.stepIndex,
      drawn: true,
      startPct: pct(start),
      widthPct: Math.max(0, pct(due) - pct(start)),
      duePct: pct(due),
      segments: [
        { kind: 'base', size: green - start },
        { kind: 'green', size: yellow - green },
        { kind: 'yellow', size: red - yellow },
        { kind: 'red', size: Math.max(due, start) - red },
      ],
      provisional: r.provisional,
      problem: r.problem,
      startAt: r.startAt,
      dueAt: r.dueAt,
    };
  });

  const every = tickEvery(totalDays);
  const ticks: GanttTick[] = [];
  for (let d = 0; d < totalDays; d += every) ticks.push({ pct: pct(originMs + d * DAY), label: tickLabel(originMs + d * DAY) });

  const deadline = ms(recordDeadline);
  return { bars, ticks, originMs, totalDays, recordDeadlinePct: deadline === null ? null : pct(deadline) };
}

/** Where an instant falls on the axis of a built model, as a share of it; `null` when the model has no axis or the instant is unreadable. */
export function axisPct(model: Pick<GanttModel, 'originMs' | 'totalDays'>, iso: string | null): number | null {
  const t = ms(iso);
  if (t === null || model.totalDays === 0) return null;
  return ((t - model.originMs) / (model.totalDays * DAY)) * 100;
}

function emptyBar(r: SchedulePreviewRow): GanttBar {
  return {
    stepIndex: r.stepIndex,
    drawn: false,
    startPct: 0,
    widthPct: 0,
    duePct: 0,
    segments: [],
    provisional: r.provisional,
    problem: r.problem,
    startAt: r.startAt,
    dueAt: r.dueAt,
  };
}
