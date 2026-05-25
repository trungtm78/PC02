import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { today, toDateInput, formatVNDateTime, formatVNDate, formatVNTime } from '../dates';

describe('today()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns YYYY-MM-DD format for afternoon VN time', () => {
    vi.setSystemTime(new Date('2026-05-09T14:00:00Z')); // 21:00 VN
    expect(today()).toBe('2026-05-09');
  });

  it('returns same VN date at 23:59 VN (16:59 UTC)', () => {
    vi.setSystemTime(new Date('2026-05-09T16:59:59.999Z')); // 23:59:59 VN
    expect(today()).toBe('2026-05-09');
  });

  it('rolls to next VN date at VN midnight (17:00 UTC)', () => {
    vi.setSystemTime(new Date('2026-05-09T17:00:00Z')); // 00:00 VN May 10
    expect(today()).toBe('2026-05-10');
  });

  it('pads single-digit month and day', () => {
    vi.setSystemTime(new Date('2026-01-05T05:00:00Z')); // 12:00 VN Jan 5
    expect(today()).toBe('2026-01-05');
  });
});

describe('toDateInput()', () => {
  it('formats Date instance to YYYY-MM-DD in VN timezone', () => {
    // 15:00 UTC = 22:00 VN = still May 9
    expect(toDateInput(new Date('2026-05-09T15:00:00Z'))).toBe('2026-05-09');
  });

  it('formats ISO 8601 noon UTC to VN date (same day)', () => {
    // noon UTC = 19:00 VN = same day
    expect(toDateInput('2026-05-09T12:00:00Z')).toBe('2026-05-09');
  });

  it('crosses VN midnight boundary correctly', () => {
    // 2026-05-24T17:00:00Z = 00:00 VN May 25
    expect(toDateInput('2026-05-24T17:00:00Z')).toBe('2026-05-25');
  });

  it('formats date-only ISO string', () => {
    expect(toDateInput('2026-05-09')).toBe('2026-05-09');
  });

  it('returns empty string for null', () => {
    expect(toDateInput(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(toDateInput(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(toDateInput('')).toBe('');
  });

  it('returns empty string for invalid date string', () => {
    expect(toDateInput('not-a-date')).toBe('');
  });

  it('pads single-digit month and day', () => {
    // 05:00 UTC = 12:00 VN Jan 5
    expect(toDateInput(new Date('2026-01-05T05:00:00Z'))).toBe('2026-01-05');
  });
});

describe('formatVNDateTime()', () => {
  it('formats UTC ISO string to VN local datetime', () => {
    // 2026-05-25T12:01:34Z = 19:01:34 VN
    const result = formatVNDateTime('2026-05-25T12:01:34Z');
    expect(result).toContain('25/05/2026');
    expect(result).toContain('19:01');
  });

  it('formats Date instance', () => {
    const result = formatVNDateTime(new Date('2026-05-25T12:01:34Z'));
    expect(result).toContain('25/05/2026');
    expect(result).toContain('19:01');
  });

  it('includes seconds', () => {
    const result = formatVNDateTime('2026-05-25T12:01:34Z');
    expect(result).toContain('34');
  });

  it('returns em-dash for null', () => {
    expect(formatVNDateTime(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(formatVNDateTime(undefined)).toBe('—');
  });

  it('returns em-dash for invalid string', () => {
    expect(formatVNDateTime('not-a-date')).toBe('—');
  });

  it('returns em-dash for empty string', () => {
    expect(formatVNDateTime('')).toBe('—');
  });

  it('crosses UTC midnight correctly — VN is still same evening', () => {
    // 2026-05-09T16:30:00Z = 23:30 VN May 9
    const result = formatVNDateTime('2026-05-09T16:30:00Z');
    expect(result).toContain('09/05/2026');
    expect(result).toContain('23:30');
  });

  it('shows next VN day after UTC midnight', () => {
    // 2026-05-09T17:00:00Z = 00:00 VN May 10
    const result = formatVNDateTime('2026-05-09T17:00:00Z');
    expect(result).toContain('10/05/2026');
    expect(result).toContain('00:00');
    expect(result).not.toContain('24:00');
  });
});

describe('formatVNDate()', () => {
  it('formats UTC ISO string to VN local date', () => {
    // 2026-05-25T12:00:00Z = 19:00 VN → May 25
    const result = formatVNDate('2026-05-25T12:00:00Z');
    expect(result).toContain('25/05/2026');
  });

  it('formats Date instance', () => {
    const result = formatVNDate(new Date('2026-05-25T12:00:00Z'));
    expect(result).toContain('25/05/2026');
  });

  it('crosses VN midnight boundary', () => {
    // 2026-05-24T17:00:00Z = 00:00 VN May 25
    const result = formatVNDate('2026-05-24T17:00:00Z');
    expect(result).toContain('25/05/2026');
  });

  it('returns em-dash for null', () => {
    expect(formatVNDate(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(formatVNDate(undefined)).toBe('—');
  });

  it('returns em-dash for invalid string', () => {
    expect(formatVNDate('not-a-date')).toBe('—');
  });

  it('returns em-dash for empty string', () => {
    expect(formatVNDate('')).toBe('—');
  });
});

describe('formatVNTime()', () => {
  it('formats UTC ISO string to VN local time HH:MM', () => {
    // 2026-05-25T12:01:34Z = 19:01 VN
    const result = formatVNTime('2026-05-25T12:01:34Z');
    expect(result).toContain('19:01');
  });

  it('formats Date instance', () => {
    const result = formatVNTime(new Date('2026-05-25T12:01:34Z'));
    expect(result).toContain('19:01');
  });

  it('uses 24-hour format (not AM/PM)', () => {
    // 2026-05-25T13:00:00Z = 20:00 VN
    const result = formatVNTime('2026-05-25T13:00:00Z');
    expect(result).toContain('20:00');
    expect(result).not.toContain('AM');
    expect(result).not.toContain('PM');
  });

  it('returns em-dash for null', () => {
    expect(formatVNTime(null)).toBe('—');
  });

  it('returns em-dash for undefined', () => {
    expect(formatVNTime(undefined)).toBe('—');
  });

  it('returns em-dash for invalid string', () => {
    expect(formatVNTime('not-a-date')).toBe('—');
  });

  it('returns em-dash for empty string', () => {
    expect(formatVNTime('')).toBe('—');
  });

  it('formats VN midnight as 00:00 not 24:00', () => {
    // 2026-05-09T17:00:00Z = 00:00 VN May 10
    const result = formatVNTime('2026-05-09T17:00:00Z');
    expect(result).toContain('00:00');
    expect(result).not.toContain('24:00');
  });
});
