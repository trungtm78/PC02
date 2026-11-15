import { describe, it, expect } from 'vitest';
import { buildGantt } from '../gantt';
import type { SchedulePreviewRow } from '../types';

const DAY = 86_400_000;
/** 2026-12-01 00:00 in Vietnam (+07:00). */
const D0 = Date.UTC(2026, 11, 1) - 7 * 3_600_000;
const at = (days: number): string => new Date(D0 + days * DAY).toISOString();

const row = (over: Partial<SchedulePreviewRow> & { stepIndex: number }): SchedulePreviewRow => ({
  stepKey: null,
  startAt: null,
  dueAt: null,
  provisional: false,
  greenFrom: null,
  yellowFrom: null,
  redFrom: null,
  variant: null,
  problem: null,
  ...over,
});

const ROWS: SchedulePreviewRow[] = [
  row({ stepIndex: 0, startAt: at(0), dueAt: at(10), greenFrom: at(5), yellowFrom: at(7), redFrom: at(9) }),
  row({ stepIndex: 1, startAt: at(10), dueAt: at(30), greenFrom: at(25), yellowFrom: at(27), redFrom: at(29), provisional: true }),
];

describe('the Gantt geometry, from the instants the server computed', () => {
  it('puts the axis origin on the Vietnam midnight of the earliest start and leaves room after the last deadline', () => {
    const g = buildGantt(ROWS, null);
    expect(g.originMs).toBe(D0);
    // 30 days of schedule + max(3, ceil(30 * 0.14)) = 5 days of room.
    expect(g.totalDays).toBe(35);
  });

  it('places each bar by its start and its deadline, as a share of the axis', () => {
    const [a, b] = buildGantt(ROWS, null).bars;
    expect(a.startPct).toBeCloseTo(0, 5);
    expect(a.widthPct).toBeCloseTo((10 / 35) * 100, 5);
    expect(b.startPct).toBeCloseTo((10 / 35) * 100, 5);
    expect(b.widthPct).toBeCloseTo((20 / 35) * 100, 5);
  });

  it('splits the tail of a bar into base, green, yellow and red by the thresholds the server gave', () => {
    const [a] = buildGantt(ROWS, null).bars;
    expect(a.segments.map((s) => s.kind)).toEqual(['base', 'green', 'yellow', 'red']);
    expect(a.segments.map((s) => Math.round(s.size / DAY))).toEqual([5, 2, 2, 1]);
  });

  it('a band that begins before the bar starts is clipped to the bar (no negative segment)', () => {
    const [bar] = buildGantt([row({ stepIndex: 0, startAt: at(0), dueAt: at(4), greenFrom: at(-3), yellowFrom: at(1), redFrom: at(3) })], null).bars;
    expect(bar.segments.every((s) => s.size >= 0)).toBe(true);
    expect(bar.segments.reduce((sum, s) => sum + s.size, 0)).toBe(4 * DAY);
    expect(bar.segments.find((s) => s.kind === 'base')?.size).toBe(0);
  });

  it('carries the provisional mark of a deadline that leans on an unconfirmed calendar year', () => {
    const [a, b] = buildGantt(ROWS, null).bars;
    expect(a.provisional).toBe(false);
    expect(b.provisional).toBe(true);
  });

  it('draws the record deadline line where the server says the record deadline is', () => {
    expect(buildGantt(ROWS, at(10)).recordDeadlinePct).toBeCloseTo((10 / 35) * 100, 5);
    expect(buildGantt(ROWS, null).recordDeadlinePct).toBeNull();
  });

  it('a step the server could not schedule is not drawn and carries the reason', () => {
    const g = buildGantt([ROWS[0], row({ stepIndex: 1, problem: 'ANCHOR_DATE_MISSING' })], null);
    expect(g.bars[0].drawn).toBe(true);
    expect(g.bars[1]).toMatchObject({ drawn: false, problem: 'ANCHOR_DATE_MISSING', segments: [] });
  });

  it('nothing to draw at all gives an empty axis, not NaN', () => {
    const g = buildGantt([row({ stepIndex: 0, problem: 'ANCHOR_DATE_MISSING' })], null);
    expect(g.ticks).toEqual([]);
    expect(g.totalDays).toBe(0);
    expect(g.bars[0].drawn).toBe(false);
  });

  it('ticks are labelled day/month in Vietnam time and spaced by the length of the axis', () => {
    const g = buildGantt(ROWS, null);
    expect(g.ticks[0]).toEqual({ pct: 0, label: '01/12' });
    // 35 days: a tick every 5 days.
    expect(g.ticks[1].label).toBe('06/12');
    expect(g.ticks.length).toBe(7);
  });

  it('a short schedule gets a tick every 2 days, a long one every 30', () => {
    const short = buildGantt([row({ stepIndex: 0, startAt: at(0), dueAt: at(3), greenFrom: at(1), yellowFrom: at(2), redFrom: at(3) })], null);
    expect(short.ticks[1].label).toBe('03/12');
    const long = buildGantt([row({ stepIndex: 0, startAt: at(0), dueAt: at(200), greenFrom: at(190), yellowFrom: at(195), redFrom: at(199) })], null);
    expect(long.ticks[1].label).toBe('31/12');
  });
});
