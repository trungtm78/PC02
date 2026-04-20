import { buildScopeFilter, buildPetitionScopeFilter } from './scope-filter.util';

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
