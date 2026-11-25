import { STRONG_PASSWORD_REGEX } from '../../auth/constants/password.constants';
import { MEMORABLE_WORDS, memorablePassword, memorablePasswords } from './memorable-password';

describe('memorable passwords for the default accounts', () => {
  it('the word list is long enough, plain ASCII, capitalised, short, and has no repeats', () => {
    expect(MEMORABLE_WORDS.length).toBeGreaterThanOrEqual(200);
    expect(new Set(MEMORABLE_WORDS.map((w) => w.toLowerCase())).size).toBe(MEMORABLE_WORDS.length);
    for (const word of MEMORABLE_WORDS) expect(word).toMatch(/^[A-Z][a-z]{2,5}$/);
  });

  it('has the shape Word-Word@1234 and satisfies the password policy of the app', () => {
    for (let i = 0; i < 500; i += 1) {
      const password = memorablePassword();
      expect(password).toMatch(/^([A-Z][a-z]{2,5})-([A-Z][a-z]{2,5})@\d{4}$/);
      expect(password.length).toBeGreaterThanOrEqual(8);
      expect(STRONG_PASSWORD_REGEX.test(password)).toBe(true);
      const [, a, b] = /^([A-Za-z]+)-([A-Za-z]+)@/.exec(password)!;
      expect(a).not.toBe(b);
      expect(MEMORABLE_WORDS).toContain(a);
      expect(MEMORABLE_WORDS).toContain(b);
    }
  });

  it('a batch of 42 is 42 different passwords', () => {
    const batch = memorablePasswords(42);
    expect(batch).toHaveLength(42);
    expect(new Set(batch).size).toBe(42);
  });

  it('is random, not a function of anything: many draws give many different passwords and digits', () => {
    const draws = Array.from({ length: 300 }, () => memorablePassword());
    expect(new Set(draws).size).toBeGreaterThan(295);
    expect(new Set(draws.map((p) => p.slice(-4))).size).toBeGreaterThan(200);
  });

  it('a batch that cannot be made different is refused instead of looping forever', () => {
    expect(() => memorablePasswords(3, () => 'Hoa-Sen@1234')).toThrow(/distinct/);
  });
});
