import { sanitizeFilename } from './filename.util';

describe('sanitizeFilename', () => {
  it('strips path separators / and \\', () => {
    expect(sanitizeFilename('5931/ĐX-PC02-Đ1.docx')).not.toContain('/');
    expect(sanitizeFilename('a\\b\\c.docx')).not.toContain('\\');
  });

  it('collapses .. traversal', () => {
    const out = sanitizeFilename('../../evil.docx');
    expect(out).not.toContain('..');
  });

  it('strips control characters and Windows-reserved characters', () => {
    for (const ch of ['?', '%', '*', ':', '|', '"', '<', '>', '\x00', '\x1f']) {
      expect(sanitizeFilename(`bad${ch}file.docx`)).not.toContain(ch);
    }
  });

  it('preserves Vietnamese diacritics (NFC normalized)', () => {
    expect(sanitizeFilename('Đơn-thư-Nguyễn-Văn-A.docx')).toBe(
      'Đơn-thư-Nguyễn-Văn-A.docx',
    );
  });

  it('caps length at 200 chars after sanitization', () => {
    const huge = 'a'.repeat(500) + '.docx';
    const out = sanitizeFilename(huge);
    expect(out.length).toBeLessThanOrEqual(200);
  });

  it('prefixes Excel formula characters to defeat CSV/Excel injection in archive listings', () => {
    for (const ch of ['=', '+', '-', '@', '\t', '\r']) {
      const out = sanitizeFilename(`${ch}cmd|calc.docx`);
      expect(out.startsWith("'")).toBe(true);
    }
  });

  it('returns a safe fallback for empty or pure-junk input', () => {
    expect(sanitizeFilename('')).toBe('untitled');
    expect(sanitizeFilename('///')).toBe('untitled');
    expect(sanitizeFilename('\x00\x01\x02')).toBe('untitled');
  });

  it('keeps a single dot for extension separation', () => {
    expect(sanitizeFilename('phieu-de-xuat.docx')).toBe('phieu-de-xuat.docx');
  });
});
