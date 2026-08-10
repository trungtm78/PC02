/**
 * The frontend permission layer was `MOCK_ALL_PERMISSIONS`: a constant granting
 * every action on every resource to every user, consulted in 48 files and 252
 * call sites including bulk delete. The backend guard was the only real gate,
 * so nothing was insecure — what users got was buttons they were not allowed
 * to press, and a 403 when they pressed one.
 *
 * The two systems never shared a vocabulary. The backend stores
 * `{ action: 'read', subject: 'Case' }`; the frontend asks
 * `can('cases', 'view')`. While the answer was always true, the gap was
 * invisible. This is the translation, and these are its edges.
 */
import { describe, it, expect } from 'vitest';
import {
  toPermissionSet,
  MAPPED_SUBJECTS,
  MAPPED_ACTIONS,
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
      toPermissionSet([{ action: 'read', subject: 'FeatureFlag' }]),
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

describe('mapping tables', () => {
  it('covers every action the backend seeds except restore', () => {
    // If the backend gains an action, this list is where it has to be
    // acknowledged — otherwise that permission silently maps to nothing.
    expect(MAPPED_ACTIONS.sort()).toEqual(
      ['delete', 'edit', 'read', 'write'].sort(),
    );
  });

  it('maps every resource the frontend can render', () => {
    for (const subject of [
      'Case',
      'Petition',
      'Incident',
      'Subject',
      'User',
      'Setting',
      'Lawyer',
      'Directory',
      'Report',
      'Calendar',
    ]) {
      expect(MAPPED_SUBJECTS).toContain(subject);
    }
  });
});
