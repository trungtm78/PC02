import { parseDate, parseDob, parseNum, parseBool } from './backfill-consolidate';

describe('backfill-consolidate parsers', () => {
  describe('parseDate', () => {
    it('parses VN dd/mm/yyyy → date-only UTC', () => {
      expect(parseDate('24/10/2023')?.toISOString()).toBe('2023-10-24T00:00:00.000Z');
    });
    it('parses dd-mm-yyyy with single-digit parts', () => {
      expect(parseDate('5/6/2021')?.toISOString()).toBe('2021-06-05T00:00:00.000Z');
    });
    it('parses ISO yyyy-mm-dd', () => {
      expect(parseDate('2022-03-04')?.toISOString()).toBe('2022-03-04T00:00:00.000Z');
    });
    it('parses legacy unix epoch seconds', () => {
      expect(parseDate('1600000000')).toBeInstanceOf(Date);
    });
    it('rejects multi-value / garbage', () => {
      expect(parseDate('24/12/2024 (Thiện); 16/01/2022 (Hoàng)')).toBeNull();
      expect(parseDate('88/7 Xô Viết Nghệ Tĩnh')).toBeNull();
      expect(parseDate('')).toBeNull();
      expect(parseDate(null)).toBeNull();
    });
    it('rejects impossible day/month', () => {
      expect(parseDate('45/13/2020')).toBeNull();
    });
  });

  describe('parseDob', () => {
    it('year-only → YYYY-01-01 with precision year', () => {
      expect(parseDob('1985')).toEqual({ date: new Date(Date.UTC(1985, 0, 1)), precision: 'year' });
    });
    it('full date → precision date', () => {
      const r = parseDob('13/7/2011');
      expect(r?.precision).toBe('date');
      expect(r?.date.toISOString()).toBe('2011-07-13T00:00:00.000Z');
    });
    it('rejects multi-person values', () => {
      expect(parseDob('1980; 2000')).toBeNull();
      expect(parseDob('1964 (Thiện); 1967 (Hoàng)')).toBeNull();
    });
    it('rejects placeholder 0', () => {
      expect(parseDob('0')).toBeNull();
    });
  });

  describe('parseNum', () => {
    it('VN thousand-separator dots → full integer (không hiểu là thập phân)', () => {
      expect(parseNum('5.500.000 VND', false)).toBe(5500000);
    });
    it('passes through actual number', () => {
      expect(parseNum(5500000, false)).toBe(5500000);
    });
    it('int count parse', () => {
      expect(parseNum('12 người', true)).toBe(12);
    });
    it('rejects non-numeric', () => {
      expect(parseNum('không rõ', false)).toBeNull();
    });
  });

  describe('parseBool', () => {
    it('truthy VN tokens', () => {
      expect(parseBool('có')).toBe(true);
      expect(parseBool('1')).toBe(true);
    });
    it('falsy VN tokens', () => {
      expect(parseBool('không')).toBe(false);
      expect(parseBool('0')).toBe(false);
    });
    it('unknown → null', () => {
      expect(parseBool('maybe')).toBeNull();
    });
  });
});
