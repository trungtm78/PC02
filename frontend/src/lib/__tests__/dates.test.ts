import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { today, toDateInput } from '../dates';

describe('today()', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns YYYY-MM-DD format', () => {
    vi.setSystemTime(new Date(2026, 4, 9, 12, 0, 0)); // 2026-05-09 12:00 local
    expect(today()).toBe('2026-05-09');
  });

  it('uses local timezone (does NOT shift to UTC)', () => {
    // 2026-05-09 23:30 local — UTC date may differ depending on local TZ
    vi.setSystemTime(new Date(2026, 4, 9, 23, 30, 0));
    expect(today()).toBe('2026-05-09');
  });

  it('returns local date at early morning (before UTC midnight in -07 timezones)', () => {
    // 2026-05-10 02:00 local
    vi.setSystemTime(new Date(2026, 4, 10, 2, 0, 0));
    expect(today()).toBe('2026-05-10');
  });

  it('pads single-digit month and day', () => {
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0)); // Jan 5
    expect(today()).toBe('2026-01-05');
  });
});

describe('toDateInput()', () => {
  it('formats Date instance to YYYY-MM-DD', () => {
    expect(toDateInput(new Date(2026, 4, 9, 15, 0, 0))).toBe('2026-05-09');
  });

  it('formats ISO 8601 string to YYYY-MM-DD', () => {
    // Use noon UTC so all timezones land on the same local date
    expect(toDateInput('2026-05-09T12:00:00Z')).toMatch(/^2026-05-0[89]$/);
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
    expect(toDateInput(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
  });
});
