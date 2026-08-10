import {
  sanitizePII,
  computeFieldDiff,
  PII_PATTERN,
  sanitizeMetadataRecursive,
} from './audit.utils';

describe('audit.utils', () => {
  describe('PII_PATTERN', () => {
    it('matches PII field names', () => {
      const piiFields = [
        'passwordHash',
        'refreshTokenHash',
        'totpSecret',
        'enrollmentTokenHash',
        'backupCodes',
        'backupCodeSalts',
        'magicLinkTokenHash',
        'passwordResetTokenHash',
        'sessionTokenHash',
        'recoveryCodes',
        'lastOtpCode',
        'twoFaSecret',
        '2faPendingToken',
      ];
      for (const field of piiFields) {
        expect(PII_PATTERN.test(field)).toBe(true);
      }
    });

    it('does not match non-PII field names', () => {
      const safeFields = [
        'email',
        'workId',
        'phone',
        'firstName',
        'lastName',
        'username',
        'isActive',
        'roleId',
        'createdAt',
      ];
      for (const field of safeFields) {
        expect(PII_PATTERN.test(field)).toBe(false);
      }
    });
  });

  describe('sanitizePII', () => {
    it('removes PII fields from flat object', () => {
      const input = {
        email: 'admin@pc02.local',
        passwordHash: '$2b$12$xxxxx',
        workId: '277-001',
        refreshTokenHash: 'abc123',
        totpSecret: 'XYZ',
      };
      const result = sanitizePII(input);
      expect(result).toEqual({ email: 'admin@pc02.local', workId: '277-001' });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('refreshTokenHash');
      expect(result).not.toHaveProperty('totpSecret');
    });

    it('returns empty object for null input', () => {
      expect(sanitizePII(null)).toEqual({});
    });

    it('returns empty object for undefined input', () => {
      expect(sanitizePII(undefined)).toEqual({});
    });

    it('preserves nested PII fields are removed too', () => {
      const input = {
        email: 'admin@pc02.local',
        backupCodes: ['code1', 'code2'],
      };
      const result = sanitizePII(input);
      expect(result).not.toHaveProperty('backupCodes');
    });
  });

  describe('computeFieldDiff', () => {
    it('returns empty array when before === after', () => {
      const obj = { email: 'admin@pc02.local', workId: '277-001' };
      expect(computeFieldDiff(obj, obj)).toEqual([]);
    });

    it('detects ADDED fields (before=null, after=value)', () => {
      const before = null;
      const after = { email: 'admin@pc02.local', workId: '277-001' };
      const diff = computeFieldDiff(before, after);
      expect(diff).toHaveLength(2);
      expect(diff[0].changeType).toBe('added');
      expect(diff.find((d) => d.field === 'email')?.newValue).toBe(
        'admin@pc02.local',
      );
    });

    it('detects REMOVED fields (after=null)', () => {
      const before = { email: 'admin@pc02.local', workId: '277-001' };
      const after = null;
      const diff = computeFieldDiff(before, after);
      expect(diff).toHaveLength(2);
      expect(diff.every((d) => d.changeType === 'removed')).toBe(true);
    });

    it('detects MODIFIED fields', () => {
      const before = { email: 'old@pc02.local', workId: '277-001' };
      const after = { email: 'new@pc02.local', workId: '277-001' };
      const diff = computeFieldDiff(before, after);
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({
        field: 'email',
        oldValue: 'old@pc02.local',
        newValue: 'new@pc02.local',
        changeType: 'modified',
      });
    });

    it('skips PII fields entirely (even if both before and after have them)', () => {
      const before = { email: 'admin@pc02.local', passwordHash: 'old_hash' };
      const after = { email: 'admin@pc02.local', passwordHash: 'new_hash' };
      const diff = computeFieldDiff(before, after);
      expect(diff).toEqual([]);
    });

    it('skips metadata fields (id, createdAt, updatedAt)', () => {
      const before = {
        id: 'u1',
        email: 'admin@pc02.local',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      };
      const after = {
        id: 'u1',
        email: 'new@pc02.local',
        createdAt: '2026-01-01',
        updatedAt: '2026-05-20',
      };
      const diff = computeFieldDiff(before, after);
      expect(diff).toHaveLength(1);
      expect(diff[0].field).toBe('email');
    });

    it('handles nested objects via JSON.stringify equality', () => {
      const before = { permissions: { read: true, write: false } };
      const after = { permissions: { read: true, write: true } };
      const diff = computeFieldDiff(before, after);
      expect(diff).toHaveLength(1);
      expect(diff[0].field).toBe('permissions');
      expect(diff[0].changeType).toBe('modified');
    });
  });

  describe('sanitizeMetadataRecursive (v0.29 codex fix)', () => {
    it('returns null/undefined as-is', () => {
      expect(sanitizeMetadataRecursive(null)).toBe(null);
      expect(sanitizeMetadataRecursive(undefined)).toBe(undefined);
    });

    it('returns primitives as-is', () => {
      expect(sanitizeMetadataRecursive('foo')).toBe('foo');
      expect(sanitizeMetadataRecursive(42)).toBe(42);
      expect(sanitizeMetadataRecursive(true)).toBe(true);
    });

    it('strips PII keys recursively in nested before/after objects', () => {
      const input = {
        before: {
          email: 'a@b.com',
          passwordHash: 'old_hash',
          totpSecret: 'secret',
        },
        after: {
          email: 'a@b.com',
          passwordHash: 'new_hash',
          totpSecret: 'secret2',
        },
        identifier: '277-001',
      };
      const result = sanitizeMetadataRecursive(input) as any;
      expect(result.before).toEqual({ email: 'a@b.com' });
      expect(result.after).toEqual({ email: 'a@b.com' });
      expect(result.identifier).toBe('277-001');
      expect(JSON.stringify(result)).not.toContain('passwordHash');
      expect(JSON.stringify(result)).not.toContain('totpSecret');
    });

    it('walks arrays', () => {
      const input = {
        history: [
          { event: 'login', passwordHash: 'hash1' },
          { event: 'logout', refreshTokenHash: 'token1' },
        ],
      };
      const result = sanitizeMetadataRecursive(input) as any;
      expect(result.history[0]).toEqual({ event: 'login' });
      expect(result.history[1]).toEqual({ event: 'logout' });
    });

    // v0.30.0.1 hot-fix: Date is typeof 'object' but Object.entries() returns []
    // → previously corrupted to `{}`, breaking audit metadata for date fields
    // (updatedAt, createdAt, deadline). Should serialize as ISO string.
    it('v0.30.0.1: serializes Date instances as ISO string (not {})', () => {
      const date = new Date('2026-05-20T07:00:00.000Z');
      expect(sanitizeMetadataRecursive(date)).toBe('2026-05-20T07:00:00.000Z');
    });

    it('v0.30.0.1: Date inside nested object serialized correctly', () => {
      const input = {
        before: { name: 'A', deadline: new Date('2026-06-01T00:00:00.000Z') },
        after: { name: 'B', deadline: new Date('2026-07-01T00:00:00.000Z') },
      };
      const result = sanitizeMetadataRecursive(input) as any;
      expect(result.before.deadline).toBe('2026-06-01T00:00:00.000Z');
      expect(result.after.deadline).toBe('2026-07-01T00:00:00.000Z');
      // Critical: Date must NOT become empty object {}
      expect(result.before.deadline).not.toEqual({});
      expect(result.after.deadline).not.toEqual({});
    });
  });
});
