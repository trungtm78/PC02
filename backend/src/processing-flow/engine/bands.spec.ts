import * as fc from 'fast-check';
import { BANDS } from '../contract/processing-codes';
import {
  bandInstants,
  bandOf,
  bandWhere,
  completionClass,
  remainingDays,
  validateThresholds,
  worseBand,
  type BandRow,
  type BandWhere,
  type Thresholds,
} from './bands';
import { ProcessingEngineError } from './errors';
import type { Band } from './types';

const vn = (isoLocal: string) => new Date(`${isoLocal}+07:00`);
const T: Thresholds = { redDays: 1, yellowDays: 3, greenDays: 7 };
/** The end of 10 March 2026 in Vietnam. */
const DUE = vn('2026-03-10T23:59:59.999');

const codeOf = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (error) {
    if (error instanceof ProcessingEngineError) return error.code;
    throw error;
  }
  return undefined;
};

/** The band read off the three instants: the second definition `bandOf` must agree with. */
const bandFromInstants = (now: Date, dueAt: Date, t: Thresholds): Band => {
  const { redFrom, yellowFrom, greenFrom } = bandInstants(dueAt, t);
  if (now.getTime() > dueAt.getTime()) return 'OVERDUE';
  if (now.getTime() >= redFrom.getTime()) return 'RED';
  if (now.getTime() >= yellowFrom.getTime()) return 'YELLOW';
  if (now.getTime() >= greenFrom.getTime()) return 'GREEN';
  return 'NONE';
};

/** What a database would answer for one row: every comparison of the descriptor holds. */
const matches = (row: BandRow, where: BandWhere): boolean =>
  (Object.keys(where) as Array<keyof BandRow>).every((field) => {
    const value = row[field].getTime();
    const test = where[field] ?? {};
    return (
      (test.lt === undefined || value < test.lt.getTime()) &&
      (test.lte === undefined || value <= test.lte.getTime()) &&
      (test.gt === undefined || value > test.gt.getTime()) &&
      (test.gte === undefined || value >= test.gte.getTime())
    );
  });

const thresholds = fc
  .tuple(fc.integer({ min: 0, max: 30 }), fc.integer({ min: 0, max: 30 }), fc.integer({ min: 0, max: 60 }))
  .map(([a, b, c]): Thresholds => ({ redDays: a, yellowDays: a + b, greenDays: a + b + c }));
const instant = fc.date({ min: new Date('2025-01-01T00:00:00Z'), max: new Date('2028-12-31T00:00:00Z'), noInvalidDate: true });

describe('validateThresholds', () => {
  it.each([
    { redDays: 0, yellowDays: 0, greenDays: 0 },
    { redDays: 1, yellowDays: 1, greenDays: 1 },
    { redDays: 1, yellowDays: 3, greenDays: 7 },
  ])('%p is accepted', (t) => {
    expect(codeOf(() => validateThresholds(t))).toBeUndefined();
  });

  it.each([
    { redDays: -1, yellowDays: 3, greenDays: 7 },
    { redDays: 4, yellowDays: 3, greenDays: 7 },
    { redDays: 1, yellowDays: 8, greenDays: 7 },
    { redDays: 1.5, yellowDays: 3, greenDays: 7 },
    { redDays: 1, yellowDays: Number.NaN, greenDays: 7 },
    { redDays: 1, yellowDays: 3, greenDays: Number.POSITIVE_INFINITY },
  ])('%p is refused', (t) => {
    expect(codeOf(() => validateThresholds(t))).toBe('THRESHOLDS_NOT_ASCENDING');
    expect(codeOf(() => bandInstants(DUE, t))).toBe('THRESHOLDS_NOT_ASCENDING');
    expect(codeOf(() => bandOf(DUE, DUE, t))).toBe('THRESHOLDS_NOT_ASCENDING');
  });
});

describe('bandInstants', () => {
  it('each band starts at the first millisecond of the day (due day - its days), in Vietnam', () => {
    expect(bandInstants(DUE, T)).toEqual({
      greenFrom: vn('2026-03-03T00:00:00.000'),
      yellowFrom: vn('2026-03-07T00:00:00.000'),
      redFrom: vn('2026-03-09T00:00:00.000'),
    });
  });

  it('a threshold of 0 days starts on the due day itself', () => {
    expect(bandInstants(DUE, { redDays: 0, yellowDays: 0, greenDays: 0 }).redFrom).toEqual(vn('2026-03-10T00:00:00.000'));
  });

  it('a deadline in the middle of a day (hours) uses the day it falls on', () => {
    expect(bandInstants(vn('2026-03-10T09:30:00.000'), T).redFrom).toEqual(vn('2026-03-09T00:00:00.000'));
  });
});

describe('bandOf', () => {
  it.each([
    ['2026-03-02T23:59:59.999', 'NONE'],
    ['2026-03-03T00:00:00.000', 'GREEN'],
    ['2026-03-06T23:59:59.999', 'GREEN'],
    ['2026-03-07T00:00:00.000', 'YELLOW'],
    ['2026-03-08T23:59:59.999', 'YELLOW'],
    ['2026-03-09T00:00:00.000', 'RED'],
    ['2026-03-10T00:00:00.000', 'RED'],
    ['2026-03-10T23:59:59.999', 'RED'],
    ['2026-03-11T00:00:00.000', 'OVERDUE'],
  ] as const)('at %s the band is %s', (now, band) => {
    expect(bandOf(vn(now), DUE, T)).toBe(band);
  });

  it('remaining days EQUAL to a threshold are inside that band (<=, not <)', () => {
    expect(remainingDays(vn('2026-03-09T12:00:00.000'), DUE)).toBe(1);
    expect(bandOf(vn('2026-03-09T12:00:00.000'), DUE, T)).toBe('RED');
    expect(remainingDays(vn('2026-03-07T12:00:00.000'), DUE)).toBe(3);
    expect(bandOf(vn('2026-03-07T12:00:00.000'), DUE, T)).toBe('YELLOW');
    expect(remainingDays(vn('2026-03-03T12:00:00.000'), DUE)).toBe(7);
    expect(bandOf(vn('2026-03-03T12:00:00.000'), DUE, T)).toBe('GREEN');
  });

  it('exactly at the deadline is not overdue; one millisecond later is', () => {
    const hourly = vn('2026-03-10T09:30:00.000');
    expect(bandOf(hourly, hourly, T)).toBe('RED');
    expect(bandOf(new Date(hourly.getTime() + 1), hourly, T)).toBe('OVERDUE');
  });

  it('with all thresholds 0 only the due day is red', () => {
    const zero = { redDays: 0, yellowDays: 0, greenDays: 0 };
    expect(bandOf(vn('2026-03-09T23:59:59.999'), DUE, zero)).toBe('NONE');
    expect(bandOf(vn('2026-03-10T00:00:00.000'), DUE, zero)).toBe('RED');
  });

  it('equals the band read off bandInstants, for every instant (property)', () => {
    fc.assert(
      fc.property(instant, instant, thresholds, (now, dueAt, t) => {
        expect(bandOf(now, dueAt, t)).toBe(bandFromInstants(now, dueAt, t));
      }),
      { numRuns: 2000 },
    );
  });

  it('equals the band read off bandInstants at and next to every boundary (property)', () => {
    fc.assert(
      fc.property(instant, thresholds, fc.constantFrom(-1, 0, 1), fc.constantFrom('dueAt' as const, 'redFrom' as const, 'yellowFrom' as const, 'greenFrom' as const), (dueAt, t, delta, edge) => {
        const edges ={ dueAt, ...bandInstants(dueAt, t) };
        const now = new Date(edges[edge].getTime() + delta);
        expect(bandOf(now, dueAt, t)).toBe(bandFromInstants(now, dueAt, t));
      }),
      { numRuns: 2000 },
    );
  });
});

describe('remainingDays', () => {
  it('is the civil day of the deadline minus the civil day of now', () => {
    expect(remainingDays(vn('2026-03-10T00:00:00.000'), DUE)).toBe(0);
    expect(remainingDays(vn('2026-03-09T23:59:59.999'), DUE)).toBe(1);
    expect(remainingDays(vn('2026-02-28T08:00:00.000'), DUE)).toBe(10);
  });

  it('is negative once a day-end deadline has passed', () => {
    expect(remainingDays(vn('2026-03-11T00:00:00.000'), DUE)).toBe(-1);
    expect(remainingDays(vn('2026-03-20T15:00:00.000'), DUE)).toBe(-10);
  });

  it('is 0 on the due day of an hourly deadline even after its hour: the band says OVERDUE, not this number', () => {
    const hourly = vn('2026-03-10T09:30:00.000');
    expect(remainingDays(vn('2026-03-10T18:00:00.000'), hourly)).toBe(0);
    expect(bandOf(vn('2026-03-10T18:00:00.000'), hourly, T)).toBe('OVERDUE');
  });
});

describe('worseBand', () => {
  it('orders OVERDUE > RED > YELLOW > GREEN > NONE, whichever side it is on', () => {
    for (let i = 0; i < BANDS.length; i++) {
      for (let j = 0; j < BANDS.length; j++) {
        expect(worseBand(BANDS[i], BANDS[j])).toBe(BANDS[Math.min(i, j)]);
      }
    }
  });
});

describe('bandWhere', () => {
  const now = vn('2026-03-09T10:00:00.000');

  it('describes each band as plain comparisons with now', () => {
    expect(bandWhere('OVERDUE', now)).toEqual({ dueAt: { lt: now } });
    expect(bandWhere('RED', now)).toEqual({ dueAt: { gte: now }, redFrom: { lte: now } });
    expect(bandWhere('YELLOW', now)).toEqual({ dueAt: { gte: now }, redFrom: { gt: now }, yellowFrom: { lte: now } });
    expect(bandWhere('GREEN', now)).toEqual({ dueAt: { gte: now }, yellowFrom: { gt: now }, greenFrom: { lte: now } });
    expect(bandWhere('NONE', now)).toEqual({ dueAt: { gte: now }, greenFrom: { gt: now } });
  });

  it('every row matches exactly one band, and it is the band of bandOf (property)', () => {
    fc.assert(
      fc.property(instant, instant, thresholds, (at, dueAt, t) => {
        const row: BandRow = { dueAt, ...bandInstants(dueAt, t) };
        expect(BANDS.filter((band) => matches(row, bandWhere(band, at)))).toEqual([bandOf(at, dueAt, t)]);
      }),
      { numRuns: 2000 },
    );
  });

  it('the same at and next to every boundary (property)', () => {
    fc.assert(
      fc.property(instant, thresholds, fc.constantFrom(-1, 0, 1), fc.constantFrom('dueAt', 'redFrom', 'yellowFrom', 'greenFrom'), (dueAt, t, delta, edge) => {
        const row: BandRow = { dueAt, ...bandInstants(dueAt, t) };
        const at = new Date(row[edge as keyof BandRow].getTime() + delta);
        expect(BANDS.filter((band) => matches(row, bandWhere(band, at)))).toEqual([bandOf(at, dueAt, t)]);
      }),
      { numRuns: 2000 },
    );
  });
});

describe('completionClass', () => {
  const now = vn('2026-03-12T10:00:00.000');

  it('done at or before the deadline is on time; one millisecond after is late', () => {
    expect(completionClass(vn('2026-03-01T08:00:00.000'), DUE, now)).toBe('DONE_ON_TIME');
    expect(completionClass(DUE, DUE, now)).toBe('DONE_ON_TIME');
    expect(completionClass(new Date(DUE.getTime() + 1), DUE, now)).toBe('DONE_LATE');
  });

  it('not done: in time until the deadline, overdue after it', () => {
    expect(completionClass(null, DUE, vn('2026-03-10T23:59:59.999'))).toBe('OPEN_IN_TIME');
    expect(completionClass(null, DUE, vn('2026-03-11T00:00:00.000'))).toBe('OPEN_OVERDUE');
  });

  it('once done, the clock no longer matters', () => {
    expect(completionClass(vn('2026-03-01T08:00:00.000'), DUE, vn('2030-01-01T00:00:00.000'))).toBe('DONE_ON_TIME');
  });
});
