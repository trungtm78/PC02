import { computePeriodKey } from './period-key.util';

describe('computePeriodKey', () => {
  const thu = new Date('2026-01-01T10:00:00Z'); // Thursday — ISO W01
  const mon = new Date('2026-05-25T10:00:00Z'); // Monday  — ISO W22

  describe('YEARLY', () => {
    it('returns 4-digit year string', () => {
      expect(computePeriodKey('YEARLY', thu)).toBe('2026');
      expect(computePeriodKey('YEARLY', mon)).toBe('2026');
    });
  });

  describe('MONTHLY', () => {
    it('returns YYYY-MM zero-padded', () => {
      expect(computePeriodKey('MONTHLY', thu)).toBe('2026-01');
      expect(computePeriodKey('MONTHLY', mon)).toBe('2026-05');
    });
  });

  describe('WEEKLY', () => {
    it('returns YYYY-WNN ISO week zero-padded', () => {
      expect(computePeriodKey('WEEKLY', thu)).toBe('2026-W01');
      expect(computePeriodKey('WEEKLY', mon)).toBe('2026-W22');
    });

    it('handles year boundary — Jan 5 2026 (Monday) = W02', () => {
      const jan5 = new Date('2026-01-05T10:00:00Z');
      expect(computePeriodKey('WEEKLY', jan5)).toBe('2026-W02');
    });
  });

  describe('NEVER', () => {
    it('returns "global"', () => {
      expect(computePeriodKey('NEVER', thu)).toBe('global');
    });
  });

  describe('MAX_NUMBER', () => {
    it('returns "global"', () => {
      expect(computePeriodKey('MAX_NUMBER', mon)).toBe('global');
    });
  });

  describe('unknown reset period', () => {
    it('throws on unrecognised reset period', () => {
      expect(() => computePeriodKey('DAILY' as any, thu)).toThrow(
        'Unknown resetPeriod: DAILY',
      );
    });
  });
});
