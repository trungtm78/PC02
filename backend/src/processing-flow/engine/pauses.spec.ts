import * as fc from 'fast-check';
import { ProcessingEngineError } from './errors';
import { shiftForPauses } from './pauses';

const vn = (isoLocal: string) => new Date(`${isoLocal}+07:00`);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const DUE = vn('2026-03-10T23:59:59.999');
const NOW = vn('2026-03-05T10:00:00.000');
const later = (from: Date, ms: number) => new Date(from.getTime() + ms);

describe('shiftForPauses', () => {
  it('no pause: the deadline stays, and nothing is paused', () => {
    expect(shiftForPauses(DUE, [], NOW)).toEqual({ dueAt: DUE, paused: false });
  });

  it('one closed pause before the deadline moves it later by the length of the pause', () => {
    const pauses = [{ from: vn('2026-03-02T08:00:00.000'), to: vn('2026-03-04T08:00:00.000') }];
    expect(shiftForPauses(DUE, pauses, NOW)).toEqual({ dueAt: later(DUE, 2 * DAY), paused: false });
  });

  it('two pauses add up', () => {
    const pauses = [
      { from: vn('2026-03-02T08:00:00.000'), to: vn('2026-03-03T08:00:00.000') },
      { from: vn('2026-03-04T00:00:00.000'), to: vn('2026-03-04T06:00:00.000') },
    ];
    expect(shiftForPauses(DUE, pauses, NOW)).toEqual({ dueAt: later(DUE, DAY + 6 * HOUR), paused: false });
  });

  it('the order of the list does not matter', () => {
    const a = { from: vn('2026-03-02T08:00:00.000'), to: vn('2026-03-03T08:00:00.000') };
    const b = { from: vn('2026-03-04T00:00:00.000'), to: vn('2026-03-04T06:00:00.000') };
    expect(shiftForPauses(DUE, [b, a], NOW)).toEqual(shiftForPauses(DUE, [a, b], NOW));
  });

  it('overlapping pauses are merged: the shared time counts once', () => {
    const pauses = [
      { from: vn('2026-03-02T00:00:00.000'), to: vn('2026-03-04T00:00:00.000') },
      { from: vn('2026-03-03T00:00:00.000'), to: vn('2026-03-05T00:00:00.000') },
      { from: vn('2026-03-02T12:00:00.000'), to: vn('2026-03-02T18:00:00.000') },
    ];
    expect(shiftForPauses(DUE, pauses, NOW)).toEqual({ dueAt: later(DUE, 3 * DAY), paused: false });
  });

  it('pauses that touch end to start are one pause', () => {
    const pauses = [
      { from: vn('2026-03-02T00:00:00.000'), to: vn('2026-03-03T00:00:00.000') },
      { from: vn('2026-03-03T00:00:00.000'), to: vn('2026-03-04T00:00:00.000') },
    ];
    expect(shiftForPauses(DUE, pauses, NOW).dueAt).toEqual(later(DUE, 2 * DAY));
  });

  it('a pause that started after the deadline does not move it', () => {
    const pauses = [{ from: vn('2026-03-11T08:00:00.000'), to: vn('2026-03-15T08:00:00.000') }];
    expect(shiftForPauses(DUE, pauses, vn('2026-03-20T00:00:00.000'))).toEqual({ dueAt: DUE, paused: false });
  });

  it('a pause that starts exactly at the deadline does not move it; one millisecond earlier does, in full', () => {
    expect(shiftForPauses(DUE, [{ from: DUE, to: later(DUE, DAY) }], later(DUE, 5 * DAY)).dueAt).toEqual(DUE);
    expect(shiftForPauses(DUE, [{ from: later(DUE, -1), to: later(DUE, DAY) }], later(DUE, 5 * DAY)).dueAt).toEqual(later(DUE, DAY + 1));
  });

  it('a pause after the ORIGINAL deadline still counts when an earlier pause already pushed the deadline past it', () => {
    const pauses = [
      { from: vn('2026-03-09T00:00:00.000'), to: vn('2026-03-12T00:00:00.000') },
      // After 10 March, but before the deadline as it stands after the first pause (13 March).
      { from: vn('2026-03-12T12:00:00.000'), to: vn('2026-03-13T12:00:00.000') },
    ];
    expect(shiftForPauses(DUE, pauses, vn('2026-03-20T00:00:00.000')).dueAt).toEqual(later(DUE, 4 * DAY));
  });

  it('an open pause means paused now: the deadline has moved by the time paused so far', () => {
    const pauses = [{ from: vn('2026-03-04T10:00:00.000'), to: null }];
    expect(shiftForPauses(DUE, pauses, NOW)).toEqual({ dueAt: later(DUE, DAY), paused: true });
    expect(shiftForPauses(DUE, pauses, later(NOW, HOUR))).toEqual({ dueAt: later(DUE, DAY + HOUR), paused: true });
  });

  it('while an open pause lasts the deadline keeps its distance from now', () => {
    const pauses = [{ from: vn('2026-03-04T10:00:00.000'), to: null }];
    const distance = (now: Date) => shiftForPauses(DUE, pauses, now).dueAt.getTime() - now.getTime();
    expect(distance(later(NOW, 40 * DAY))).toBe(distance(NOW));
  });

  it('an open pause after a closed one adds to it', () => {
    const pauses = [
      { from: vn('2026-03-02T08:00:00.000'), to: vn('2026-03-03T08:00:00.000') },
      { from: vn('2026-03-05T04:00:00.000'), to: null },
    ];
    expect(shiftForPauses(DUE, pauses, NOW)).toEqual({ dueAt: later(DUE, DAY + 6 * HOUR), paused: true });
  });

  it('an open pause that began after the deadline: paused, and the deadline stays where it was missed', () => {
    const pauses = [{ from: vn('2026-03-12T00:00:00.000'), to: null }];
    expect(shiftForPauses(DUE, pauses, vn('2026-03-20T00:00:00.000'))).toEqual({ dueAt: DUE, paused: true });
  });

  it('an open pause that starts later than now has not begun: nothing moves, nothing is paused', () => {
    const pauses = [{ from: later(NOW, DAY), to: null }];
    expect(shiftForPauses(DUE, pauses, NOW)).toEqual({ dueAt: DUE, paused: false });
  });

  it('a pause of no length changes nothing', () => {
    const at = vn('2026-03-02T08:00:00.000');
    expect(shiftForPauses(DUE, [{ from: at, to: at }], NOW)).toEqual({ dueAt: DUE, paused: false });
  });

  it.each([
    [{ from: vn('2026-03-04T00:00:00.000'), to: vn('2026-03-03T00:00:00.000') }],
    [{ from: new Date(Number.NaN), to: null }],
    [{ from: vn('2026-03-04T00:00:00.000'), to: new Date(Number.NaN) }],
  ])('a pause that ends before it starts, or is not a date, is refused', (pause) => {
    let code: string | undefined;
    try {
      shiftForPauses(DUE, [pause], NOW);
    } catch (error) {
      code = error instanceof ProcessingEngineError ? error.code : 'OTHER';
    }
    expect(code).toBe('PAUSE_INVALID');
  });

  it('does not change its arguments', () => {
    const pauses = [{ from: vn('2026-03-04T00:00:00.000'), to: vn('2026-03-05T00:00:00.000') }];
    const before = JSON.stringify({ DUE, pauses });
    shiftForPauses(DUE, pauses, NOW);
    expect(JSON.stringify({ DUE, pauses })).toBe(before);
  });

  it('closed pauses that all end before the deadline shift it by the length of their union (property)', () => {
    const base = vn('2026-01-01T00:00:00.000').getTime();
    const pause = fc.tuple(fc.integer({ min: 0, max: 999 }), fc.integer({ min: 0, max: 200 })).map(([start, length]) => ({
      from: new Date(base + start * HOUR),
      to: new Date(base + (start + length) * HOUR),
    }));
    fc.assert(
      fc.property(fc.array(pause, { maxLength: 12 }), (pauses) => {
        // Hour by hour: an hour is paused when any pause covers it.
        let union = 0;
        for (let hour = 0; hour < 1200; hour++) {
          const at = base + hour * HOUR;
          if (pauses.some((p) => p.from.getTime() <= at && at < p.to.getTime())) union++;
        }
        const dueAt = new Date(base + 1300 * HOUR);
        expect(shiftForPauses(dueAt, pauses, new Date(base + 5000 * HOUR))).toEqual({ dueAt: later(dueAt, union * HOUR), paused: false });
      }),
    );
  });

  it('a pause never moves a deadline earlier (property)', () => {
    const base = vn('2026-01-01T00:00:00.000').getTime();
    const pause = fc.tuple(fc.integer({ min: 0, max: 3000 }), fc.option(fc.integer({ min: 0, max: 500 }), { nil: null })).map(([start, length]) => ({
      from: new Date(base + start * HOUR),
      to: length === null ? null : new Date(base + (start + length) * HOUR),
    }));
    fc.assert(
      fc.property(fc.array(pause, { maxLength: 8 }), fc.integer({ min: 0, max: 3000 }), fc.integer({ min: 0, max: 4000 }), (pauses, dueHour, nowHour) => {
        const dueAt = new Date(base + dueHour * HOUR);
        expect(shiftForPauses(dueAt, pauses, new Date(base + nowHour * HOUR)).dueAt.getTime()).toBeGreaterThanOrEqual(dueAt.getTime());
      }),
    );
  });
});
