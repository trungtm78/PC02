import { escapeXlsxCell, escapeXlsxRow } from './xlsx-formula-escape.util';

describe('xlsx-formula-escape', () => {
  describe('escapeXlsxCell', () => {
    it('returns null/undefined unchanged', () => {
      expect(escapeXlsxCell(null)).toBeNull();
      expect(escapeXlsxCell(undefined)).toBeUndefined();
    });

    it('returns numbers/dates unchanged', () => {
      expect(escapeXlsxCell(42)).toBe(42);
      const d = new Date('2026-05-29T00:00:00Z');
      expect(escapeXlsxCell(d)).toBe(d);
    });

    it('returns empty string unchanged', () => {
      expect(escapeXlsxCell('')).toBe('');
    });

    it('returns benign strings unchanged', () => {
      expect(escapeXlsxCell('Nguyễn Văn A')).toBe('Nguyễn Văn A');
      expect(escapeXlsxCell('Đội 1, Tổ 2')).toBe('Đội 1, Tổ 2');
    });

    it('prefixes formula triggers =, +, -, @ with apostrophe', () => {
      expect(escapeXlsxCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
      expect(escapeXlsxCell('+rich')).toBe("'+rich");
      expect(escapeXlsxCell('-Trần Văn B')).toBe("'-Trần Văn B");
      expect(escapeXlsxCell('@mention')).toBe("'@mention");
    });

    it('prefixes tab/carriage-return-leading strings', () => {
      expect(escapeXlsxCell('\tdata')).toBe("'\tdata");
      expect(escapeXlsxCell('\rdata')).toBe("'\rdata");
    });

    it('prefixes the classic HYPERLINK exfil payload', () => {
      const payload = '=HYPERLINK("https://evil.example.com","Click")';
      expect(escapeXlsxCell(payload)).toBe("'" + payload);
    });

    it('does not double-prefix already-quoted strings', () => {
      // After first pass: "'=foo". After second pass: starts with "'" not "=", no prefix.
      expect(escapeXlsxCell("'=already")).toBe("'=already");
    });
  });

  describe('escapeXlsxRow', () => {
    it('escapes only string cells starting with triggers', () => {
      const row = {
        stt: 1,
        name: '=HYPERLINK("evil")',
        date: new Date('2026-05-29'),
        notes: 'OK',
        empty: '',
        nothing: null,
      };
      const escaped = escapeXlsxRow(row);
      expect(escaped.stt).toBe(1);
      expect(escaped.name).toBe("'=HYPERLINK(\"evil\")");
      expect(escaped.date).toBeInstanceOf(Date);
      expect(escaped.notes).toBe('OK');
      expect(escaped.empty).toBe('');
      expect(escaped.nothing).toBeNull();
    });
  });
});
