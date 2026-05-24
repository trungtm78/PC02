import { stripHtmlTags } from './sanitize.util';

describe('stripHtmlTags', () => {
  it('strips entire <script> block including its content', () => {
    expect(stripHtmlTags('<script>alert(1)</script>')).toBe('');
  });

  it('strips <img> onerror XSS payload', () => {
    expect(stripHtmlTags('<img src=x onerror=alert(1)>')).toBe('');
  });

  it('strips <iframe> tag', () => {
    expect(stripHtmlTags('<iframe src="evil.com"></iframe>')).toBe('');
  });

  it('preserves normal Vietnamese text', () => {
    expect(stripHtmlTags('Nguyễn Văn An')).toBe('Nguyễn Văn An');
  });

  it('trims surrounding whitespace', () => {
    expect(stripHtmlTags('  hello  ')).toBe('hello');
  });

  it('returns undefined for null and undefined input', () => {
    expect(stripHtmlTags(null)).toBeUndefined();
    expect(stripHtmlTags(undefined)).toBeUndefined();
  });

  it('returns non-string values as-is', () => {
    expect(stripHtmlTags(123 as any)).toBe(123);
  });
});
