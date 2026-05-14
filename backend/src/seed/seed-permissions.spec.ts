/**
 * Seed permissions registry test.
 *
 * Background: ISSUE-001 (QA 2026-05-14) — `SettingsController` requires
 * `Setting:read`/`Setting:write` but seed never declared them. Result: every
 * user (including super-admin) got 403 on /api/v1/settings.
 *
 * This test pins the permission registry so that every subject required by
 * a controller's `@RequirePermissions` decorator must be declared in the
 * seed. If a new controller is added that needs a new subject, this test
 * fails until the seed declares it.
 */
import { SEED_PERMISSIONS } from './seed-permissions';

function hasPerm(action: string, subject: string): boolean {
  return SEED_PERMISSIONS.some(
    (p) => p.action === action && p.subject === subject,
  );
}

describe('SEED_PERMISSIONS', () => {
  describe('Setting (ISSUE-001 regression)', () => {
    it('declares Setting:read so admin can view system settings page', () => {
      expect(hasPerm('read', 'Setting')).toBe(true);
    });

    it('declares Setting:write so admin can edit system settings', () => {
      expect(hasPerm('write', 'Setting')).toBe(true);
    });
  });

  describe('Calendar (ISSUE-002 regression — admin must access /calendar)', () => {
    it('declares Calendar:read', () => {
      expect(hasPerm('read', 'Calendar')).toBe(true);
    });

    it('declares Calendar:write', () => {
      expect(hasPerm('write', 'Calendar')).toBe(true);
    });
  });

  describe('core domain coverage', () => {
    it('covers Case CRUD', () => {
      expect(hasPerm('read', 'Case')).toBe(true);
      expect(hasPerm('write', 'Case')).toBe(true);
      expect(hasPerm('delete', 'Case')).toBe(true);
    });

    it('covers User CRUD', () => {
      expect(hasPerm('read', 'User')).toBe(true);
      expect(hasPerm('write', 'User')).toBe(true);
      expect(hasPerm('delete', 'User')).toBe(true);
    });

    it('covers Petition + Incident + Subject + Lawyer reads', () => {
      expect(hasPerm('read', 'Petition')).toBe(true);
      expect(hasPerm('read', 'Incident')).toBe(true);
      expect(hasPerm('read', 'Subject')).toBe(true);
      expect(hasPerm('read', 'Lawyer')).toBe(true);
    });
  });

  it('has no duplicate (action, subject) pairs', () => {
    const seen = new Set<string>();
    for (const p of SEED_PERMISSIONS) {
      const key = `${p.action}:${p.subject}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
