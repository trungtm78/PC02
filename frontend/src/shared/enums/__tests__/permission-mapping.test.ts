/**
 * The frontend permission layer was `MOCK_ALL_PERMISSIONS`: a constant granting
 * every action on every resource to every user, consulted across 17 files
 * including bulk delete. The backend guard was the only real gate,
 * so nothing was insecure — what users got was buttons they were not allowed
 * to press, and a 403 when they pressed one.
 *
 * The two systems never shared a vocabulary. The backend stores
 * `{ action: 'read', subject: 'Case' }`; the frontend asks
 * `can('cases', 'view')`. While the answer was always true, the gap was
 * invisible. This is the translation, and these are its edges.
 */
import { describe, it, expect } from 'vitest';
// Vite's `?raw` rather than `node:fs`: the frontend tsconfig lists its `types`
// explicitly and does not include `node`, and adding it would change global
// typing for the whole app project just to read one file in one test.
import seed from '../../../../../backend/prisma/seed-permissions.ts?raw';
import permissionsSource from '../permissions.ts?raw';
import {
  toPermissionSet,
  MAPPED_SUBJECTS,
  MAPPED_ACTIONS,
  UNMAPPED_ACTIONS,
  WRITE_IMPLIES_EDIT_SUBJECTS,
} from '../permission-mapping';

describe('toPermissionSet', () => {
  it('translates the backend vocabulary into the frontend one', () => {
    expect(
      toPermissionSet([
        { action: 'read', subject: 'Case' },
        { action: 'write', subject: 'Case' },
      ]),
    ).toEqual({ cases: ['view', 'create'] });
  });

  it('maps edit and delete straight through', () => {
    expect(
      toPermissionSet([
        { action: 'edit', subject: 'Petition' },
        { action: 'delete', subject: 'Petition' },
      ]),
    ).toEqual({ petitions: ['edit', 'delete'] });
  });

  it('returns an empty set for a user with no permissions — fail closed', () => {
    // The whole point. An unhydrated session must grant nothing, not
    // everything. A control briefly hidden is correct; a forbidden control
    // briefly shown is the bug being replaced.
    expect(toPermissionSet([])).toEqual({});
    expect(toPermissionSet(null)).toEqual({});
    expect(toPermissionSet(undefined)).toEqual({});
  });

  it('drops a subject the frontend does not know rather than guessing', () => {
    expect(
      toPermissionSet([{ action: 'read', subject: 'KhongTonTai' }]),
    ).toEqual({});
  });

  it('drops an action with no frontend equivalent', () => {
    // `restore` is admin-only and its screen checks the role directly.
    expect(toPermissionSet([{ action: 'restore', subject: 'Case' }])).toEqual(
      {},
    );
  });

  it('does not duplicate an action granted twice', () => {
    expect(
      toPermissionSet([
        { action: 'read', subject: 'Case' },
        { action: 'read', subject: 'Case' },
      ]),
    ).toEqual({ cases: ['view'] });
  });

  it('keeps resources separate', () => {
    const set = toPermissionSet([
      { action: 'read', subject: 'Case' },
      { action: 'delete', subject: 'User' },
    ]);

    expect(set).toEqual({ cases: ['view'], users: ['delete'] });
  });
});

describe('mapping tables stay in step with the backend seed', () => {
  // The previous version of this suite compared the mapping against a
  // hand-written list, so it passed while eight subjects were unmapped and
  // its claim to cover "every action except restore" was simply false. It
  // reads the seed now, which is the only thing that can go out of date.
  const body = seed.split('DEFAULT_ROLE_GRANTS')[0];
  const pairs = [
    ...body.matchAll(/\{\s*action:\s*'([a-z_]+)',\s*subject:\s*'([A-Za-z]+)'/g),
  ];
  const seedSubjects = [...new Set(pairs.map((m) => m[2]))];
  const seedActions = [...new Set(pairs.map((m) => m[1]))];

  it('parses the seed at all — a silent zero would pass vacuously', () => {
    expect(seedSubjects.length).toBeGreaterThan(10);
    expect(seedActions.length).toBeGreaterThan(4);
  });

  it('maps every subject the backend seeds', () => {
    const missing = seedSubjects.filter((s) => !MAPPED_SUBJECTS.includes(s));
    expect(missing).toEqual([]);
  });

  it('accounts for every action — mapped, or named as having no UI', () => {
    const unaccounted = seedActions.filter(
      (a) => !MAPPED_ACTIONS.includes(a) && !UNMAPPED_ACTIONS.includes(a),
    );
    expect(unaccounted).toEqual([]);
  });

  it('only claims write-implies-edit for subjects the seed gives no edit row', () => {
    for (const subject of WRITE_IMPLIES_EDIT_SUBJECTS) {
      const hasEdit = pairs.some(
        (m) => m[2] === subject && m[1] === 'edit',
      );
      expect({ subject, hasEdit }).toEqual({ subject, hasEdit: false });
    }
  });
});

describe('the all-permissive mock stays deleted', () => {
  it('exports no constant that grants every action to everyone', () => {
    // `MOCK_ALL_PERMISSIONS` lived on as dead code with a doc comment still
    // announcing "Currently mock (all-permissive)" long after `usePermission`
    // stopped reading it. Dead code that advertises itself as the permission
    // source is an invitation to import it back.
    expect(permissionsSource).not.toContain('MOCK_ALL_PERMISSIONS');
    expect(permissionsSource).not.toMatch(/mock \(all-permissive\)/i);
  });
});
