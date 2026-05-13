import { generateTempPassword } from '../temp-password.util';
import { STRONG_PASSWORD_REGEX } from '../../constants/password.constants';

describe('generateTempPassword', () => {
  it('generates a string of exactly the requested length', () => {
    expect(generateTempPassword(16)).toHaveLength(16);
    expect(generateTempPassword(20)).toHaveLength(20);
  });

  it('defaults to 16 characters', () => {
    expect(generateTempPassword()).toHaveLength(16);
  });

  it('throws when length is less than 4 (cannot satisfy regex with shorter)', () => {
    expect(() => generateTempPassword(3)).toThrow();
    expect(() => generateTempPassword(0)).toThrow();
  });

  it('always satisfies STRONG_PASSWORD_REGEX (1 upper, 1 digit, 1 special)', () => {
    // 100 iterations to catch random-output edge cases. The naive
    // randomBytes-mapping would fail this if all-lowercase happened to be
    // generated (~probability (62/70)^16 per call).
    for (let i = 0; i < 100; i++) {
      const pw = generateTempPassword(16);
      expect(pw).toMatch(STRONG_PASSWORD_REGEX);
      expect(pw.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('contains at least one uppercase, one digit, and one allowed special char', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTempPassword(16);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[!@#$%^&*]/);
    }
  });

  it('excludes ambiguous characters (I/O/l/0/1) for handover legibility', () => {
    // Aggregate over many calls — any leak of these chars is a bug.
    let aggregate = '';
    for (let i = 0; i < 200; i++) {
      aggregate += generateTempPassword(16);
    }
    expect(aggregate).not.toMatch(/[IOl01]/);
  });

  it('produces different outputs across calls (entropy sanity)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seen.add(generateTempPassword(16));
    }
    // Out of 50 calls we expect 50 unique 16-char passwords with overwhelming probability.
    expect(seen.size).toBe(50);
  });
});
