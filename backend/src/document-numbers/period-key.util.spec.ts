import { computePeriodKey } from './period-key.util';

describe('computePeriodKey', () => {
  const thu = new Date('2026-01-01T10:00:00Z'); // Thursday — ISO W01
  const mon = new Date('2026-05-25T10:00:00Z'); // Monday  — ISO W22

  describe('YEARLY', () => {
    it('returns 4-digit year string', () => {
      expect(computePeriodKey('YEARLY', thu)).toBe('2026');
      expect(computePeriodKey('YEARLY', mon)).toBe('2026');
    });

    // v0.47 — Vietnamese timezone fix (Nghị định 30/2020)
    // Annual numbering must reset at Jan 1 00:00 ICT (UTC+7), not Jan 1 00:00 UTC.
    // Before fix: 7-hour window each Jan 1 (00:00–06:59 ICT) stamps documents with previous year.

    it('Dec 31 23:30 ICT (= Dec 31 16:30 UTC) → "2026" — same year both views', () => {
      // VN time: 2026-12-31 23:30. UTC: 2026-12-31 16:30. Both agree year=2026.
      const date = new Date('2026-12-31T16:30:00Z');
      expect(computePeriodKey('YEARLY', date, 'Asia/Ho_Chi_Minh')).toBe('2026');
    });

    it('Jan 1 06:30 ICT (= Dec 31 23:30 UTC) → "2027" — VN year is 2027, UTC year is 2026', () => {
      // VN time: 2027-01-01 06:30 (already new year). UTC: 2026-12-31 23:30 (still old year).
      // Nghị định 30/2020: counter must read VN year → "2027".
      // Current UTC-only code returns "2026" → wrong year on document = P0 bug.
      const date = new Date('2026-12-31T23:30:00Z');
      expect(computePeriodKey('YEARLY', date, 'Asia/Ho_Chi_Minh')).toBe('2027');
    });

    it('Jan 1 07:30 ICT (= Jan 1 00:30 UTC) → "2027" — both views agree', () => {
      const date = new Date('2027-01-01T00:30:00Z');
      expect(computePeriodKey('YEARLY', date, 'Asia/Ho_Chi_Minh')).toBe('2027');
    });

    it('defaults to Asia/Ho_Chi_Minh when tz omitted', () => {
      // Same boundary date as Jan 1 06:30 ICT case but no explicit tz argument.
      // Default must be VN to satisfy Nghị định 30/2020 without per-call wiring.
      const date = new Date('2026-12-31T23:30:00Z');
      expect(computePeriodKey('YEARLY', date)).toBe('2027');
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
