import { attachmentDisposition } from './attachment-disposition.util';

/**
 * Node refuses a header value with a character above U+00FF (`ERR_INVALID_CHAR`), and Vietnamese
 * letters like ệ ỉ ố are above it: a download named after a report "Thống kê vụ việc" used to answer
 * 500. The name travels in the RFC 5987 form (what browsers read), with a plain-ASCII fallback.
 */
describe('attachmentDisposition', () => {
  it('a plain ASCII name is unchanged in the fallback and also carried in the UTF-8 form', () => {
    expect(attachmentDisposition('HSLN-2026-06.xlsx')).toBe(
      `attachment; filename="HSLN-2026-06.xlsx"; filename*=UTF-8''HSLN-2026-06.xlsx`,
    );
  });

  it('a Vietnamese name keeps its letters in filename* and loses only the accents in the fallback', () => {
    const header = attachmentDisposition('Thống-kê-vụ-việc-Đội-3.xlsx');
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent('Thống-kê-vụ-việc-Đội-3.xlsx')}`);
    expect(header).toContain('filename="Thong-ke-vu-viec-Doi-3.xlsx"');
  });

  it('every character of the header is something Node accepts in a header value', () => {
    const header = attachmentDisposition('Báo cáo "đặc biệt" ệ ỉ ố — 2026/06 (v1).xlsx');
    for (const ch of header) expect(ch.charCodeAt(0)).toBeLessThanOrEqual(0x7e);
    // Node's own check.
    expect(() => {
      const res = { setHeader: (_: string, v: string) => { if (/[^\t\x20-\x7e\x80-\xff]/.test(v)) throw new Error('ERR_INVALID_CHAR'); } };
      res.setHeader('Content-Disposition', header);
    }).not.toThrow();
  });

  it('quotes, slashes and the characters RFC 5987 reserves cannot break out of the header', () => {
    const header = attachmentDisposition(`a"b\\c/d'e(f)g*h;i.xlsx`);
    const fallback = /filename="([^"]*)"/.exec(header)?.[1] as string;
    expect(fallback).not.toMatch(/["\\/;']/);
    const encoded = /filename\*=UTF-8''(.*)$/.exec(header)?.[1] as string;
    expect(encoded).not.toMatch(/['()*";\\/]/);
    expect(decodeURIComponent(encoded)).toBe(`a"b\\c/d'e(f)g*h;i.xlsx`);
  });

  it('a name with nothing usable still gets a fallback', () => {
    expect(attachmentDisposition('———.xlsx')).toMatch(/filename="[A-Za-z0-9._-]+"/);
  });

  it('control characters never reach the header', () => {
    const header = attachmentDisposition('a\r\nSet-Cookie: x=1.xlsx');
    expect(header).not.toMatch(/[\r\n]/);
  });
});
