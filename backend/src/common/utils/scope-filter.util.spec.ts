import { ForbiddenException } from '@nestjs/common';
import { buildScopeFilter, buildPetitionScopeFilter, assertParentInScope, assertCreatorInScope } from './scope-filter.util';

describe('buildScopeFilter', () => {
  it('returns null for null scope (admin passthrough)', () => {
    expect(buildScopeFilter(null)).toBeNull();
  });

  it('returns null for undefined scope (admin passthrough)', () => {
    expect(buildScopeFilter(undefined)).toBeNull();
  });

  it('returns deny-all sentinel for empty scope', () => {
    expect(buildScopeFilter({ userIds: [], teamIds: [] })).toEqual({ id: '__no_access__' });
  });

  it('returns OR with investigatorId when only userIds present', () => {
    const result = buildScopeFilter({ userIds: ['u1', 'u2'], teamIds: [] });
    expect(result).toEqual({
      OR: [{ investigatorId: { in: ['u1', 'u2'] } }],
    });
  });

  it('returns OR with assignedTeamId + null when only teamIds present', () => {
    const result = buildScopeFilter({ userIds: [], teamIds: ['t1'] });
    expect(result).toEqual({
      OR: [
        { assignedTeamId: { in: ['t1'] } },
        { assignedTeamId: null },
      ],
    });
  });

  it('combines userIds and teamIds in OR conditions', () => {
    const result = buildScopeFilter({ userIds: ['u1'], teamIds: ['t1'] });
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

  it('returns deny-all sentinel for empty scope', () => {
    expect(buildPetitionScopeFilter({ userIds: [], teamIds: [] })).toEqual({ id: '__no_access__' });
  });

  it('uses enteredById (not investigatorId) for ownership', () => {
    const result = buildPetitionScopeFilter({ userIds: ['u1'], teamIds: [] });
    expect(result).toEqual({
      OR: [{ enteredById: { in: ['u1'] } }],
    });
    expect(JSON.stringify(result)).not.toContain('investigatorId');
  });

  it('includes assignedTeamId null condition for team scope', () => {
    const result = buildPetitionScopeFilter({ userIds: [], teamIds: ['t1'] });
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
      assertParentInScope(null, { userIds: ['u1'], teamIds: ['t1'] }),
    ).not.toThrow();
  });

  it('passes when investigatorId matches userIds', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'other-team', investigatorId: 'u1' },
        { userIds: ['u1'], teamIds: ['t1'] },
      ),
    ).not.toThrow();
  });

  it('passes when assignedTeamId matches teamIds', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 't1', investigatorId: 'other-user' },
        { userIds: ['u1'], teamIds: ['t1'] },
      ),
    ).not.toThrow();
  });

  it('passes when record is unassigned (no assignedTeamId) and scope has teams', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: null, investigatorId: 'other-user' },
        { userIds: [], teamIds: ['t1'] },
      ),
    ).not.toThrow();
  });

  it('throws ForbiddenException when neither userId nor teamId matches', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'team-X', investigatorId: 'user-X' },
        { userIds: ['u1'], teamIds: ['t1'] },
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
      assertParentInScope({ assignedTeamId: 'team-X', investigatorId: 'user-X' }, { userIds: [], teamIds: [] }),
    ).toThrow(ForbiddenException);
  });

  it('passes when both assignedTeamId and investigatorId are null (unassigned record, non-empty teamScope)', () => {
    expect(() =>
      assertParentInScope({ assignedTeamId: null, investigatorId: null }, { userIds: ['u1'], teamIds: ['t1'] }),
    ).not.toThrow();
  });
});

describe('assertCreatorInScope', () => {
  it('passes (no-op) when scope is null — admin bypass', () => {
    expect(() => assertCreatorInScope('user-X', null)).not.toThrow();
  });

  it('passes (no-op) when createdById is null', () => {
    expect(() =>
      assertCreatorInScope(null, { userIds: ['u1'], teamIds: [] }),
    ).not.toThrow();
  });

  it('passes when createdById is in userIds', () => {
    expect(() =>
      assertCreatorInScope('u1', { userIds: ['u1', 'u2'], teamIds: [] }),
    ).not.toThrow();
  });

  it('passes (no-op) when userIds is empty — no restriction', () => {
    expect(() =>
      assertCreatorInScope('user-X', { userIds: [], teamIds: ['t1'] }),
    ).not.toThrow();
  });

  it('throws ForbiddenException when createdById not in userIds', () => {
    expect(() =>
      assertCreatorInScope('user-X', { userIds: ['u1', 'u2'], teamIds: [] }),
    ).toThrow(ForbiddenException);
  });

  it('passes (no-op) when scope is undefined — admin bypass', () => {
    expect(() => assertCreatorInScope('user-X', undefined)).not.toThrow();
  });

  it('passes (no-op) when createdById is undefined', () => {
    expect(() => assertCreatorInScope(undefined, { userIds: ['u1'], teamIds: [] })).not.toThrow();
  });
});
