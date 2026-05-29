import { nextWorkHoursTime, nextRetryTime } from './work-hours.util';

// All times expressed as UTC. Vietnam = UTC+7 (no DST).
// WORK_START = 07:00 VN = 00:00 UTC
// WORK_END   = 18:00 VN = 11:00 UTC
// Work days  = Mon(1)–Sat(6); Sunday(0) = off

describe('nextWorkHoursTime', () => {
  it('returns the same instant when already inside work hours (Tue 10:00 VN)', () => {
    // Tue 10:00 VN = Tue 03:00 UTC
    const input = new Date('2026-06-02T03:00:00.000Z');
    const result = nextWorkHoursTime(input);
    expect(result.getTime()).toBe(input.getTime());
  });

  it('schedules next-day 07:00 VN when called after work hours (Tue 20:00 VN)', () => {
    // Tue 20:00 VN = Tue 13:00 UTC
    const input = new Date('2026-06-02T13:00:00.000Z');
    const result = nextWorkHoursTime(input);
    // Wed 07:00 VN = Wed 00:00 UTC
    expect(result.toISOString()).toBe('2026-06-03T00:00:00.000Z');
  });

  it('schedules SAME-DAY 07:00 VN when called before work hours (Mon 06:00 VN)', () => {
    // Mon 06:00 VN = Sun 23:00 UTC (previous calendar day)
    const input = new Date('2026-06-07T23:00:00.000Z'); // Sun night UTC = Mon 06:00 VN
    const result = nextWorkHoursTime(input);
    // Mon 07:00 VN = Mon 00:00 UTC
    expect(result.toISOString()).toBe('2026-06-08T00:00:00.000Z');
  });

  it('skips Sunday: Sat 20:00 VN → Mon 07:00 VN', () => {
    // Sat 20:00 VN = Sat 13:00 UTC
    const input = new Date('2026-06-06T13:00:00.000Z');
    const result = nextWorkHoursTime(input);
    // Mon 07:00 VN = Mon 00:00 UTC
    expect(result.toISOString()).toBe('2026-06-08T00:00:00.000Z');
  });

  it('returns now when called exactly at 07:00 VN (boundary)', () => {
    // Wed 07:00 VN = Wed 00:00 UTC
    const input = new Date('2026-06-03T00:00:00.000Z');
    expect(nextWorkHoursTime(input).getTime()).toBe(input.getTime());
  });

  it('schedules next day when called exactly at 18:00 VN (end boundary, exclusive)', () => {
    // Wed 18:00 VN = Wed 11:00 UTC
    const input = new Date('2026-06-03T11:00:00.000Z');
    const result = nextWorkHoursTime(input);
    // Thu 07:00 VN = Thu 00:00 UTC
    expect(result.toISOString()).toBe('2026-06-04T00:00:00.000Z');
  });
});

describe('nextRetryTime', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('retry count 0 adds 1h — if result is outside work hours, wraps to next work window', () => {
    // Tue 20:00 VN = Tue 13:00 UTC; raw +1h = 21:00 VN = outside; wrap to Wed 07:00 VN
    jest.setSystemTime(new Date('2026-06-02T13:00:00.000Z'));
    const result = nextRetryTime(0);
    expect(result.toISOString()).toBe('2026-06-03T00:00:00.000Z');
  });

  it('retry count 1 adds 2h — if already in work hours, returns that moment', () => {
    // Tue 10:00 VN = Tue 03:00 UTC; raw +2h = Tue 12:00 VN = inside; return as-is
    jest.setSystemTime(new Date('2026-06-02T03:00:00.000Z'));
    const result = nextRetryTime(1);
    // 03:00 + 2h = 05:00 UTC = 12:00 VN → inside work hours
    expect(result.toISOString()).toBe('2026-06-02T05:00:00.000Z');
  });

  it('retry count 2 adds 4h', () => {
    // Tue 14:00 VN = Tue 07:00 UTC; raw +4h = Tue 18:00 VN = boundary (exclusive) → Wed 07:00
    jest.setSystemTime(new Date('2026-06-02T07:00:00.000Z'));
    const result = nextRetryTime(2);
    // 07:00 + 4h = 11:00 UTC = 18:00 VN = exclusive end boundary → next day
    expect(result.toISOString()).toBe('2026-06-03T00:00:00.000Z');
  });
});
