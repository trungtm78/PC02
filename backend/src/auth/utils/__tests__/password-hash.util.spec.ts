import * as bcrypt from 'bcrypt';
import { hashPassword, getBcryptCost } from '../password-hash.util';

describe('password-hash util', () => {
  describe('getBcryptCost', () => {
    it('returns 4 in test environment', () => {
      // Jest sets NODE_ENV=test by default.
      expect(process.env.NODE_ENV).toBe('test');
      expect(getBcryptCost()).toBe(4);
    });

    it('returns 12 when NODE_ENV is not test', () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        expect(getBcryptCost()).toBe(12);
      } finally {
        process.env.NODE_ENV = original;
      }
    });
  });

  describe('hashPassword', () => {
    it('returns a valid bcrypt hash', async () => {
      const hash = await hashPassword('TestPass@2026');
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    });

    it('hash uses cost 4 in test env (so tests stay fast)', async () => {
      const hash = await hashPassword('TestPass@2026');
      // bcrypt hash format: $2b$<cost>$<salt+hash>
      expect(hash).toMatch(/^\$2[aby]\$04\$/);
    });

    it('produces a hash that bcrypt.compare verifies', async () => {
      const plaintext = 'TestPass@2026';
      const hash = await hashPassword(plaintext);
      expect(await bcrypt.compare(plaintext, hash)).toBe(true);
      expect(await bcrypt.compare('WrongPass@2026', hash)).toBe(false);
    });

    it('produces different hashes for the same password (salted)', async () => {
      const plaintext = 'TestPass@2026';
      const h1 = await hashPassword(plaintext);
      const h2 = await hashPassword(plaintext);
      expect(h1).not.toBe(h2);
    });
  });
});
