import { readImportCellRaw } from './import-cell';

describe('readImportCellRaw (S35, PR6 slice 8)', () => {
  it('returns null for a blank cell regardless of type', () => {
    expect(readImportCellRaw({ value: null }, 'NUM')).toBeNull();
    expect(readImportCellRaw({ value: undefined }, 'TEXT')).toBeNull();
    expect(readImportCellRaw({ value: '' }, 'DATE')).toBeNull();
  });

  describe('NUM', () => {
    it('reads a numeric cell as its string form', () => {
      expect(readImportCellRaw({ value: 12.5 }, 'NUM')).toBe('12.5');
    });

    it('reads a numeric-looking string cell', () => {
      expect(readImportCellRaw({ value: ' 42 ' }, 'NUM')).toBe('42');
    });

    it('unwraps a formula cell to its cached result', () => {
      expect(
        readImportCellRaw({ value: { formula: 'A1+A2', result: 30 } }, 'NUM'),
      ).toBe('30');
    });

    it('cannot read a Date-typed cell as NUM (never guesses an Excel serial)', () => {
      expect(
        readImportCellRaw({ value: new Date('2026-10-11T00:00:00Z') }, 'NUM'),
      ).toBeUndefined();
    });
  });

  describe('TEXT', () => {
    it('reads a string cell verbatim', () => {
      expect(readImportCellRaw({ value: 'Nguyễn Văn A' }, 'TEXT')).toBe(
        'Nguyễn Văn A',
      );
    });

    it('stringifies a numeric cell', () => {
      expect(readImportCellRaw({ value: 7 }, 'TEXT')).toBe('7');
    });
  });

  describe('DATE', () => {
    it('formats a Date cell using its UTC components (dodges local-TZ shift)', () => {
      expect(
        readImportCellRaw({ value: new Date('2026-01-05T00:00:00Z') }, 'DATE'),
      ).toBe('2026-01-05');
    });

    it('passes through an ISO-looking string cell as-is', () => {
      expect(readImportCellRaw({ value: '2026-01-05' }, 'DATE')).toBe(
        '2026-01-05',
      );
    });

    it('cannot read a plain number as DATE', () => {
      expect(readImportCellRaw({ value: 46762 }, 'DATE')).toBeUndefined();
    });
  });

  describe('TIME', () => {
    it('formats a Date cell as HH:mm using UTC components', () => {
      expect(
        readImportCellRaw({ value: new Date('1899-12-31T14:30:00Z') }, 'TIME'),
      ).toBe('14:30');
    });

    it('passes through an HH:mm string cell as-is', () => {
      expect(readImportCellRaw({ value: '09:05' }, 'TIME')).toBe('09:05');
    });
  });
});
