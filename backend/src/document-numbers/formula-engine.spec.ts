import { formatValue } from './formula-engine';

describe('formatValue', () => {
  const date = new Date('2026-05-03T08:30:00Z');

  describe('date patterns from NOW source', () => {
    it('YYYY → 4-digit year', () => {
      expect(formatValue(date, 'YYYY')).toBe('2026');
    });

    it('YY → 2-digit year', () => {
      expect(formatValue(date, 'YY')).toBe('26');
    });

    it('MM → zero-padded month', () => {
      expect(formatValue(date, 'MM')).toBe('05');
    });

    it('DD → zero-padded day', () => {
      expect(formatValue(date, 'DD')).toBe('03');
    });

    it('YYYYMM → 6-char year-month', () => {
      expect(formatValue(date, 'YYYYMM')).toBe('202605');
    });

    it('YYYYMMDD → 8-char full date', () => {
      expect(formatValue(date, 'YYYYMMDD')).toBe('20260503');
    });
  });

  describe('zero-pad pattern (N zeros)', () => {
    it('pads integer with leading zeros to length equal to pattern length', () => {
      expect(formatValue(42, '00000')).toBe('00042');
      expect(formatValue(1, '000')).toBe('001');
      expect(formatValue(9999, '0000')).toBe('9999');
    });

    it('number larger than pad width: keeps full number', () => {
      expect(formatValue(123456, '000')).toBe('123456');
    });
  });

  describe('empty pattern (raw value)', () => {
    it('returns string representation of value as-is', () => {
      expect(formatValue('PC02', '')).toBe('PC02');
      expect(formatValue(42, '')).toBe('42');
      expect(formatValue(date, '')).toBe(date.toISOString());
    });
  });

  describe('string passthrough', () => {
    it('returns string value unchanged when no matching pattern', () => {
      expect(formatValue('T01', 'YYYY')).toBe('T01'); // string, not a Date — passthrough
    });
  });

  describe('unknown date pattern on a Date value', () => {
    it('falls back to ISO string when pattern is unrecognised for Date', () => {
      expect(formatValue(date, 'HH')).toBe(date.toISOString());
    });
  });
});
