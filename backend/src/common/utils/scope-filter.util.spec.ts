import { ForbiddenException } from '@nestjs/common';
import { buildScopeFilter, buildPetitionScopeFilter, assertParentInScope, assertCreatorInScope } from './scope-filter.util';

describe('buildScopeFilter', () => {
  it('returns null for null scope (admin passthrough)', () => {
    expect(buildScopeFilter(null)).toBeNull();
  });

  it('returns null for undefined scope (admin passthrough)', () => {
    expect(buildScopeFilter(undefined)).toBeNull();
  });

  it('returns null for dispatcher scope (canDispatch=true) — full read access', () => {
    expect(buildScopeFilter({ userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'], canDispatch: true })).toBeNull();
  });

  it('returns deny-all sentinel for empty scope', () => {
    expect(buildScopeFilter({ userIds: [], teamIds: [], writableTeamIds: [] })).toEqual({ id: '__no_access__' });
  });

  it('returns OR with investigatorId when only userIds present', () => {
    const result = buildScopeFilter({ userIds: ['u1', 'u2'], teamIds: [], writableTeamIds: [] });
    expect(result).toEqual({
      OR: [{ investigatorId: { in: ['u1', 'u2'] } }],
    });
  });

  it('returns OR with assignedTeamId + null when only teamIds present', () => {
    const result = buildScopeFilter({ userIds: [], teamIds: ['t1'], writableTeamIds: ['t1'] });
    expect(result).toEqual({
      OR: [
        { assignedTeamId: { in: ['t1'] } },
        { assignedTeamId: null },
      ],
    });
  });

  it('combines userIds and teamIds in OR conditions', () => {
    const result = buildScopeFilter({ userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'] });
    expect(result).toEqual({
      OR: [
        { investigatorId: { in: ['u1'] } },
        { assignedTeamId: { in: ['t1'] } },
        { assignedTeamId: null },
      ],
    });
  });
});

describe('buildPetitionScopeFilter', () => {
  it('returns null for null scope', () => {
    expect(buildPetitionScopeFilter(null)).toBeNull();
  });

  it('returns null for dispatcher scope (canDispatch=true)', () => {
    expect(buildPetitionScopeFilter({ userIds: [], teamIds: ['t1'], writableTeamIds: ['t1'], canDispatch: true })).toBeNull();
  });

  it('returns deny-all sentinel for empty scope', () => {
    expect(buildPetitionScopeFilter({ userIds: [], teamIds: [], writableTeamIds: [] })).toEqual({ id: '__no_access__' });
  });

  it('uses enteredById (not investigatorId) for ownership', () => {
    const result = buildPetitionScopeFilter({ userIds: ['u1'], teamIds: [], writableTeamIds: [] });
    expect(result).toEqual({
      OR: [{ enteredById: { in: ['u1'] } }],
    });
    expect(JSON.stringify(result)).not.toContain('investigatorId');
  });

  it('includes assignedTeamId null condition for team scope', () => {
    const result = buildPetitionScopeFilter({ userIds: [], teamIds: ['t1'], writableTeamIds: ['t1'] });
    expect(result).toEqual({
      OR: [
        { assignedTeamId: { in: ['t1'] } },
        { assignedTeamId: null },
      ],
    });
  });
});

describe('assertParentInScope', () => {
  it('passes (no-op) when scope is null — admin bypass', () => {
    expect(() =>
      assertParentInScope({ assignedTeamId: 'team-X', investigatorId: 'user-X' }, null),
    ).not.toThrow();
  });

  it('passes (no-op) when parent is null — orphan record', () => {
    expect(() =>
      assertParentInScope(null, { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'] }),
    ).not.toThrow();
  });

  it('passes when investigatorId matches userIds', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'other-team', investigatorId: 'u1' },
        { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'] },
      ),
    ).not.toThrow();
  });

  it('passes when assignedTeamId matches teamIds', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 't1', investigatorId: 'other-user' },
        { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'] },
      ),
    ).not.toThrow();
  });

  it('passes when record is unassigned (no assignedTeamId) and scope has teams', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: null, investigatorId: 'other-user' },
        { userIds: [], teamIds: ['t1'], writableTeamIds: ['t1'] },
      ),
    ).not.toThrow();
  });

  it('throws ForbiddenException when neither userId nor teamId matches', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'team-X', investigatorId: 'user-X' },
        { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'] },
      ),
    ).toThrow(ForbiddenException);
  });

  it('passes (no-op) when scope is undefined — admin bypass', () => {
    expect(() =>
      assertParentInScope({ assignedTeamId: 'team-X', investigatorId: 'user-X' }, undefined),
    ).not.toThrow();
  });

  it('throws ForbiddenException for empty scope (userIds:[], teamIds:[]) — deny-all', () => {
    expect(() =>
      assertParentInScope({ assignedTeamId: 'team-X', investigatorId: 'user-X' }, { userIds: [], teamIds: [], writableTeamIds: [] }),
    ).toThrow(ForbiddenException);
  });

  it('passes when both assignedTeamId and investigatorId are null (unassigned record, non-empty teamScope)', () => {
    expect(() =>
      assertParentInScope({ assignedTeamId: null, investigatorId: null }, { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'] }),
    ).not.toThrow();
  });

  it('passes for record outside scope when canDispatch=true — dispatcher read bypass', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'other-team', investigatorId: 'other-user' },
        { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'], canDispatch: true },
      ),
    ).not.toThrow();
  });
});

describe('assertCreatorInScope', () => {
  it('passes (no-op) when scope is null — admin bypass', () => {
    expect(() => assertCreatorInScope('user-X', null)).not.toThrow();
  });

  it('throws ForbiddenException when createdById is null (orphan record denies scoped users)', () => {
    expect(() =>
      assertCreatorInScope(null, { userIds: ['u1'], teamIds: [], writableTeamIds: [] }),
    ).toThrow(ForbiddenException);
  });

  it('passes when createdById is in userIds', () => {
    expect(() =>
      assertCreatorInScope('u1', { userIds: ['u1', 'u2'], teamIds: [], writableTeamIds: [] }),
    ).not.toThrow();
  });

  it('passes when userIds is empty but teamIds has items (team-leader sees all creator-anchored records)', () => {
    expect(() =>
      assertCreatorInScope('user-X', { userIds: [], teamIds: ['t1'], writableTeamIds: ['t1'] }),
    ).not.toThrow();
  });

  it('throws ForbiddenException for deny-all scope (userIds:[], teamIds:[]) even when createdById is set', () => {
    expect(() =>
      assertCreatorInScope('user-X', { userIds: [], teamIds: [], writableTeamIds: [] }),
    ).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when createdById not in userIds', () => {
    expect(() =>
      assertCreatorInScope('user-X', { userIds: ['u1', 'u2'], teamIds: [], writableTeamIds: [] }),
    ).toThrow(ForbiddenException);
  });

  it('passes (no-op) when scope is undefined — admin bypass', () => {
    expect(() => assertCreatorInScope('user-X', undefined)).not.toThrow();
  });

  it('throws ForbiddenException when createdById is undefined (orphan record denies scoped users)', () => {
    expect(() => assertCreatorInScope(undefined, { userIds: ['u1'], teamIds: [], writableTeamIds: [] })).toThrow(ForbiddenException);
  });

  it('passes for any createdById when canDispatch=true — dispatcher read bypass', () => {
    expect(() =>
      assertCreatorInScope('unrelated-user', { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'], canDispatch: true }),
    ).not.toThrow();
  });
});

describe('assertParentInScope (write operation)', () => {
  const writeScope = { userIds: ['u1'], teamIds: ['t1', 'read-team'], writableTeamIds: ['t1'] };

  it('passes when assignedTeamId is in writableTeamIds', () => {
    expect(() =>
      assertParentInScope({ assignedTeamId: 't1', investigatorId: 'other' }, writeScope, 'write'),
    ).not.toThrow();
  });

  it('throws when assignedTeamId is in teamIds but NOT writableTeamIds (READ-only grant)', () => {
    expect(() =>
      assertParentInScope({ assignedTeamId: 'read-team', investigatorId: 'other' }, writeScope, 'write'),
    ).toThrow(ForbiddenException);
  });

  it('passes when investigatorId is in userIds (owner can always write)', () => {
    expect(() =>
      assertParentInScope({ assignedTeamId: 'read-team', investigatorId: 'u1' }, writeScope, 'write'),
    ).not.toThrow();
  });

  it('uses teamIds as fallback when writableTeamIds is absent', () => {
    const scopeNoWritable = { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'] } as { userIds: string[]; teamIds: string[]; writableTeamIds: string[] };
    expect(() =>
      assertParentInScope({ assignedTeamId: 't1', investigatorId: 'other' }, scopeNoWritable, 'write'),
    ).not.toThrow();
  });

  it('backward compat: no operation param defaults to read using teamIds', () => {
    expect(() =>
      assertParentInScope({ assignedTeamId: 'read-team', investigatorId: 'other' }, writeScope),
    ).not.toThrow();
  });
});

describe('assertCreatorInScope (write operation)', () => {
  const writeScope = { userIds: ['u1', 'u2'], teamIds: ['t1', 'read-team'], writableTeamIds: ['t1'] };

  it('passes when createdById is in userIds and user has writable teams', () => {
    expect(() =>
      assertCreatorInScope('u1', writeScope, 'write'),
    ).not.toThrow();
  });

  it('throws when scope has teamIds but empty writableTeamIds (READ-only team bypass denied for write)', () => {
    const readOnlyScope = { userIds: [], teamIds: ['read-team'], writableTeamIds: [] };
    expect(() =>
      assertCreatorInScope('any-user', readOnlyScope, 'write'),
    ).toThrow(ForbiddenException);
  });

  it('passes team bypass when writableTeamIds is non-empty', () => {
    const teamOnlyScope = { userIds: [], teamIds: ['t1'], writableTeamIds: ['t1'] };
    expect(() =>
      assertCreatorInScope('any-user', teamOnlyScope, 'write'),
    ).not.toThrow();
  });

  it('backward compat: no operation param defaults to read using teamIds for team bypass', () => {
    const readOnlyScope = { userIds: [], teamIds: ['read-team'], writableTeamIds: [] };
    expect(() =>
      assertCreatorInScope('any-user', readOnlyScope),
    ).not.toThrow();
  });
});
