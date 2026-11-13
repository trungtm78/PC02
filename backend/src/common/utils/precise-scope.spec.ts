import type { DataScope } from '../../auth/services/unit-scope.service';
import {
  NOTHING,
  preciseAllows,
  preciseAllowsCreator,
  preciseConditions,
  type PreciseScope,
  type PreciseScopes,
} from './precise-scope';
import {
  assertCreatorInScope,
  assertParentInScope,
  assertPetitionParentInScope,
  assertSourceInScope,
  buildPetitionScopeFilter,
  buildScopeFilter,
} from './scope-filter.util';

const ME = 'me';
const ALL: PreciseScope = { all: true, own: false, exactTeamIds: [], tree: null };
const OWN: PreciseScope = { ...NOTHING, own: true };
const TEAM_A: PreciseScope = { ...NOTHING, exactTeamIds: ['A'] };
const TREE_A: PreciseScope = { ...NOTHING, tree: { teamIds: ['A', 'A1'], userIds: [ME, 'mate'], includeUnassigned: true } };
const WARD_TREE: PreciseScope = { ...NOTHING, tree: { teamIds: ['W'], userIds: [ME], includeUnassigned: false } };

const both = (read: PreciseScope, write: PreciseScope = read) => ({ read, write });
function precise(over: Partial<PreciseScopes['subjects']> = {}): PreciseScopes {
  return { userId: ME, subjects: { Case: both(NOTHING), Incident: both(NOTHING), Petition: both(NOTHING), ...over } };
}
/** The legacy lists say "everything of team A": a helper that still read them instead of `precise` would be caught. */
const scopeWith = (p: PreciseScopes, extra: Partial<DataScope> = {}): DataScope => ({
  teamIds: ['A', 'B', 'C'], userIds: [ME, 'mate', 'stranger'], writableTeamIds: ['A', 'B', 'C'], writableUserIds: [ME, 'mate', 'stranger'],
  precise: p, ...extra,
});

describe('preciseConditions / preciseAllows say the same thing', () => {
  const records = [
    { assignedTeamId: 'A', ownerId: ME },
    { assignedTeamId: 'A', ownerId: 'mate' },
    { assignedTeamId: 'A1', ownerId: 'stranger' },
    { assignedTeamId: 'B', ownerId: ME },
    { assignedTeamId: 'B', ownerId: 'mate' },
    { assignedTeamId: null, ownerId: 'stranger' },
    { assignedTeamId: null, ownerId: ME },
    { assignedTeamId: 'B', ownerId: null },
  ];
  /** A tiny evaluator of the conditions the filter produces, to compare with the in-hand check. */
  const matches = (conditions: Record<string, unknown>[] | null, r: (typeof records)[number]) => {
    if (conditions === null) return true;
    return conditions.some((c) => {
      const [[field, want]] = Object.entries(c);
      const value = field === 'assignedTeamId' ? r.assignedTeamId : r.ownerId;
      if (want === null) return value === null;
      if (typeof want === 'object') return value !== null && (want as { in: string[] }).in.includes(value as string);
      return value === want;
    });
  };

  it.each([
    ['everything', ALL, [true, true, true, true, true, true, true, true]],
    ['nothing', NOTHING, [false, false, false, false, false, false, false, false]],
    ['own records', OWN, [true, false, false, true, false, false, true, false]],
    ['exactly team A', TEAM_A, [true, true, false, false, false, false, false, false]],
    ['team A as today', TREE_A, [true, true, true, true, true, true, true, false]],
    ['a ward tree (no unassigned)', WARD_TREE, [true, false, false, true, false, false, true, false]],
    ['own + exactly A', { ...OWN, exactTeamIds: ['A'] }, [true, true, false, true, false, false, true, false]],
  ] as [string, PreciseScope, boolean[]][])('%s', (_name, scope, expected) => {
    expect(records.map((r) => preciseAllows(scope, ME, r))).toEqual(expected);
    expect(records.map((r) => matches(preciseConditions(scope, ME, 'ownerId'), r))).toEqual(expected);
  });

  it('"own" never matches a record nobody owns, and "exactly the team" never an unassigned one', () => {
    expect(preciseAllows(OWN, ME, { assignedTeamId: 'A', ownerId: null })).toBe(false);
    expect(preciseAllows(TEAM_A, ME, { assignedTeamId: null, ownerId: ME })).toBe(false);
    expect(preciseConditions(NOTHING, ME, 'investigatorId')).toEqual([]);
    expect(preciseConditions(ALL, ME, 'investigatorId')).toBeNull();
  });

  it('a record known only by its creator: mine when I reach anything, a team-mate\'s only "as today"', () => {
    expect(preciseAllowsCreator(ALL, ME, 'anyone')).toBe(true);
    expect(preciseAllowsCreator(NOTHING, ME, ME)).toBe(false);
    expect(preciseAllowsCreator(OWN, ME, ME)).toBe(true);
    expect(preciseAllowsCreator(TEAM_A, ME, ME)).toBe(true);
    expect(preciseAllowsCreator(TEAM_A, ME, 'mate')).toBe(false);
    expect(preciseAllowsCreator(TREE_A, ME, 'mate')).toBe(true);
    expect(preciseAllowsCreator(TREE_A, ME, 'stranger')).toBe(false);
  });
});

describe('the record helpers use the precise scope when there is one, and only then', () => {
  it('without `precise` they answer exactly as before (the lists decide)', () => {
    const legacy: DataScope = { teamIds: ['A'], userIds: [ME], writableTeamIds: [], writableUserIds: [ME] };
    expect(buildScopeFilter(legacy, 'read', 'Case')).toEqual(buildScopeFilter(legacy, 'read'));
    expect(buildScopeFilter(legacy)).toEqual({ OR: [{ investigatorId: { in: [ME] } }, { assignedTeamId: { in: ['A'] } }, { assignedTeamId: null }] });
    expect(() => assertParentInScope({ assignedTeamId: 'A' }, legacy, 'read', 'Incident')).not.toThrow();
  });

  it('filters cases by the Case scope and incidents by the Incident scope', () => {
    const scope = scopeWith(precise({ Case: both(OWN), Incident: both(TEAM_A) }));
    expect(buildScopeFilter(scope, 'read', 'Case')).toEqual({ OR: [{ investigatorId: ME }] });
    expect(buildScopeFilter(scope, 'read', 'Incident')).toEqual({ OR: [{ assignedTeamId: { in: ['A'] } }] });
  });

  it('a caller that does not say which subject is held to BOTH: never wider than either', () => {
    const scope = scopeWith(precise({ Case: both(OWN), Incident: both(TEAM_A) }));
    expect(buildScopeFilter(scope)).toEqual({ AND: [{ OR: [{ investigatorId: ME }] }, { OR: [{ assignedTeamId: { in: ['A'] } }] }] });
    expect(() => assertParentInScope({ assignedTeamId: 'A', investigatorId: ME }, scope)).not.toThrow();
    expect(() => assertParentInScope({ assignedTeamId: 'A', investigatorId: 'mate' }, scope)).toThrow('Bạn không có quyền');
    expect(() => assertParentInScope({ assignedTeamId: 'B', investigatorId: ME }, scope)).toThrow();
    // One side unrestricted leaves the other; one side empty leaves nothing.
    expect(buildScopeFilter(scopeWith(precise({ Case: both(ALL), Incident: both(TEAM_A) })))).toEqual({ OR: [{ assignedTeamId: { in: ['A'] } }] });
    expect(buildScopeFilter(scopeWith(precise({ Case: both(ALL), Incident: both(ALL) })))).toBeNull();
    expect(buildScopeFilter(scopeWith(precise({ Case: both(ALL) })))).toEqual({ id: '__no_access__' });
  });

  it('reading uses the read scope; changing and assigning use the write scope', () => {
    const scope = scopeWith(precise({ Case: both(TREE_A, OWN) }));
    expect(buildScopeFilter(scope, 'read', 'Case')).toEqual({
      OR: [{ investigatorId: { in: [ME, 'mate'] } }, { assignedTeamId: { in: ['A', 'A1'] } }, { assignedTeamId: null }],
    });
    expect(buildScopeFilter(scope, 'write', 'Case')).toEqual({ OR: [{ investigatorId: ME }] });
    expect(buildScopeFilter(scope, 'assign', 'Case')).toEqual({ OR: [{ investigatorId: ME }] });
    const mates = { assignedTeamId: 'A', investigatorId: 'mate' };
    expect(() => assertParentInScope(mates, scope, 'read', 'Case')).not.toThrow();
    expect(() => assertParentInScope(mates, scope, 'write', 'Case')).toThrow('Bạn không có quyền chỉnh sửa bản ghi này');
  });

  it('petitions are owned by who entered them and follow the Petition scope', () => {
    const scope = scopeWith(precise({ Petition: both(OWN, NOTHING) }));
    expect(buildPetitionScopeFilter(scope)).toEqual({ OR: [{ enteredById: ME }] });
    expect(buildPetitionScopeFilter(scope, 'write')).toEqual({ id: '__no_access__' });
    expect(() => assertPetitionParentInScope({ enteredById: ME, assignedTeamId: 'B' }, scope)).not.toThrow();
    expect(() => assertPetitionParentInScope({ enteredById: 'mate', assignedTeamId: 'A' }, scope)).toThrow();
    expect(() => assertPetitionParentInScope({ enteredById: ME }, scope, 'write')).toThrow('Bạn không có quyền chỉnh sửa bản ghi này');
    expect(buildPetitionScopeFilter(scopeWith(precise({ Petition: both(ALL) })))).toBeNull();
  });

  it('the legacy lists are NOT consulted when `precise` is there (they say "everything of A, B, C")', () => {
    const scope = scopeWith(precise());
    expect(buildScopeFilter(scope, 'read', 'Case')).toEqual({ id: '__no_access__' });
    expect(() => assertParentInScope({ assignedTeamId: 'A', investigatorId: ME }, scope, 'read', 'Case')).toThrow();
    expect(() => assertCreatorInScope(ME, scope)).toThrow();
  });

  it('what was true before stays true: a missing parent is refused, a pending handoff protects, a dispatcher reads and assigns everything but changes only within reach', () => {
    const scope = scopeWith(precise({ Case: both(ALL) }));
    expect(() => assertParentInScope(null, scope, 'read', 'Case')).toThrow();
    expect(() => assertParentInScope({ intakeStage: 'CHO_NHAN' }, scope, 'write', 'Case')).toThrow('Pending handoff');
    const dispatcher = scopeWith(precise(), { canDispatch: true });
    expect(buildScopeFilter(dispatcher, 'read', 'Case')).toBeNull();
    expect(buildScopeFilter(dispatcher, 'assign', 'Case')).toBeNull();
    expect(buildScopeFilter(dispatcher, 'write', 'Case')).toEqual({ id: '__no_access__' });
    expect(() => assertParentInScope({ assignedTeamId: 'Z' }, dispatcher, 'read', 'Case')).not.toThrow();
    expect(() => assertParentInScope({ assignedTeamId: 'Z' }, dispatcher, 'write', 'Case')).toThrow();
    expect(buildPetitionScopeFilter(dispatcher)).toBeNull();
    expect(() => assertPetitionParentInScope(null, scope)).toThrow();
  });

  it('records known only by their creator follow how far the person reaches cases', () => {
    const scope = scopeWith(precise({ Case: both(TREE_A, OWN) }));
    expect(() => assertCreatorInScope('mate', scope)).not.toThrow();
    expect(() => assertCreatorInScope('mate', scope, 'write')).toThrow('Bạn không có quyền chỉnh sửa bản ghi này');
    expect(() => assertCreatorInScope(ME, scope, 'write')).not.toThrow();
    expect(() => assertCreatorInScope('stranger', scope)).toThrow();
    expect(() => assertCreatorInScope(null, scope)).toThrow();
  });

  describe('the source a case is made from (an Incident or a Petition)', () => {
    const petition = { kind: 'Petition' as const, assignedTeamId: 'B', assignedToId: ME, enteredById: 'someone-else' };

    it('today: the lists decide, and the person a petition is assigned to counts as its owner (unchanged)', () => {
      const legacy: DataScope = { teamIds: [], userIds: [ME], writableTeamIds: [], writableUserIds: [ME] };
      expect(() => assertSourceInScope(petition, legacy, 'write')).not.toThrow();
      expect(() => assertSourceInScope({ ...petition, assignedToId: 'other' }, legacy, 'write')).toThrow();
      expect(() => assertSourceInScope({ kind: 'Incident', assignedTeamId: 'B', investigatorId: ME }, legacy, 'write')).not.toThrow();
      expect(() => assertSourceInScope(petition, null, 'write')).not.toThrow();
    });

    it('enforced: a petition is measured like every other petition check, by who ENTERED it, against the Petition scope', () => {
      const scope = scopeWith(precise({ Petition: both(OWN), Incident: both(OWN) }));
      // Assigned to me but entered by somebody else: not mine, exactly as assertPetitionParentInScope says.
      expect(() => assertSourceInScope(petition, scope, 'write')).toThrow('Bạn không có quyền chỉnh sửa bản ghi này');
      expect(() => assertPetitionParentInScope({ assignedTeamId: 'B', enteredById: 'someone-else' }, scope, 'write')).toThrow();
      expect(() => assertSourceInScope({ ...petition, enteredById: ME }, scope, 'write')).not.toThrow();
      // An incident source follows the Incident scope.
      expect(() => assertSourceInScope({ kind: 'Incident', assignedTeamId: 'B', investigatorId: ME }, scope, 'write')).not.toThrow();
      expect(() => assertSourceInScope({ kind: 'Incident', assignedTeamId: 'B', investigatorId: 'mate' }, scope, 'write')).toThrow();
    });
  });

  it('admin (no scope at all) is unrestricted as before', () => {
    expect(buildScopeFilter(null, 'write', 'Case')).toBeNull();
    expect(() => assertParentInScope({ assignedTeamId: 'Z' }, null, 'write', 'Incident')).not.toThrow();
  });
});
