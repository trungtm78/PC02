import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../html-escape';

describe('escapeHtml', () => {
  it('escapes &, <, >, ", \'', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('escapes ampersand first to avoid double-encoding', () => {
    expect(escapeHtml('A & <B>')).toBe('A &amp; &lt;B&gt;');
  });

  it('passes plain text through unchanged', () => {
    expect(escapeHtml('Nguyễn Văn A — 2026')).toBe('Nguyễn Văn A — 2026');
  });

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('coerces non-string input safely', () => {
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(42 as unknown as string)).toBe('42');
  });

  it('escapes single quote', () => {
    expect(escapeHtml("O'Brien")).toBe('O&#39;Brien');
  });
});
