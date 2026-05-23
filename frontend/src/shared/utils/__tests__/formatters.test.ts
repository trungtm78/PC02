import { describe, it, expect } from 'vitest';
import {
  formatVND,
  parseVND,
  formatPhone,
  parsePhone,
  hydrateLegacyPhone,
} from '../formatters';

describe('formatVND', () => {
  it('returns "0 ₫" when value is 0', () => {
    expect(formatVND(0)).toBe('0 ₫');
  });

  it('returns "1.000.000 ₫" when value is 1000000 (thousand separator)', () => {
    expect(formatVND(1000000)).toBe('1.000.000 ₫');
  });

  it('returns "" when value is null/undefined/empty', () => {
    expect(formatVND(null)).toBe('');
    expect(formatVND(undefined)).toBe('');
    expect(formatVND('')).toBe('');
  });

  it('accepts numeric string input "1000000"', () => {
    expect(formatVND('1000000')).toBe('1.000.000 ₫');
  });
});

describe('parseVND', () => {
  it('parses "1.000.000 ₫" to 1000000', () => {
    expect(parseVND('1.000.000 ₫')).toBe(1000000);
  });

  it('returns null for empty input', () => {
    expect(parseVND('')).toBeNull();
    expect(parseVND('   ')).toBeNull();
  });

  it('parses raw "1000000" to 1000000 (already-parsed input)', () => {
    expect(parseVND('1000000')).toBe(1000000);
  });
});

describe('formatPhone', () => {
  it('formats "0901234567" to "0901 234 567"', () => {
    expect(formatPhone('0901234567')).toBe('0901 234 567');
  });

  it('returns input unchanged when shorter than 10 digits', () => {
    expect(formatPhone('0901')).toBe('0901');
  });

  it('returns "" when value is null/empty', () => {
    expect(formatPhone(null)).toBe('');
    expect(formatPhone('')).toBe('');
  });
});

describe('parsePhone', () => {
  it('strips spaces from "0901 234 567" → "0901234567"', () => {
    expect(parsePhone('0901 234 567')).toBe('0901234567');
  });

  it('returns empty string for null/empty', () => {
    expect(parsePhone(null)).toBe('');
    expect(parsePhone('')).toBe('');
  });
});

describe('hydrateLegacyPhone', () => {
  it('normalizes "+84 901 234 567" → "0901234567"', () => {
    expect(hydrateLegacyPhone('+84 901 234 567')).toBe('0901234567');
  });

  it('normalizes "+84901234567" → "0901234567" (no space)', () => {
    expect(hydrateLegacyPhone('+84901234567')).toBe('0901234567');
  });

  it('normalizes "0901-234-567" → "0901234567" (dash separator)', () => {
    expect(hydrateLegacyPhone('0901-234-567')).toBe('0901234567');
  });

  it('normalizes "(090) 1234567" → "0901234567" (parens)', () => {
    expect(hydrateLegacyPhone('(090) 1234567')).toBe('0901234567');
  });

  it('returns "0901234567" unchanged when already clean', () => {
    expect(hydrateLegacyPhone('0901234567')).toBe('0901234567');
  });

  it('returns empty string for null/empty', () => {
    expect(hydrateLegacyPhone(null)).toBe('');
    expect(hydrateLegacyPhone('')).toBe('');
  });
});
