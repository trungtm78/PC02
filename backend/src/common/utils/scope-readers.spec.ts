import type { DataScope } from '../../auth/services/unit-scope.service';
import { NOTHING, type PreciseScope, type PreciseScopes } from './precise-scope';
import {
  buildPetitionScopeFilter,
  buildScopeFilter,
  creatorFilter,
  recordInScope,
  scopeConditions,
  scopeIsEmpty,
  scopeTeamIds,
  teamInScope,
  userInScope,
} from './scope-filter.util';

const ME = 'me';
const legacy = (over: Partial<DataScope> = {}): DataScope => ({
  teamIds: ['A', 'G'], userIds: [ME, 'mate', 'guest'], writableTeamIds: ['A'], writableUserIds: [ME, 'mate'], ...over,
});
const ALL: PreciseScope = { ...NOTHING, all: true };
const OWN: PreciseScope = { ...NOTHING, own: true };
const TEAM_A: PreciseScope = { ...NOTHING, exactTeamIds: ['A'] };
const TREE_A: PreciseScope = { ...NOTHING, tree: { teamIds: ['A'], userIds: [ME, 'mate'], includeUnassigned: true } };
const both = (read: PreciseScope, write: PreciseScope = read) => ({ read, write });
const precise = (over: Partial<PreciseScopes['subjects']> = {}, extra: Partial<DataScope> = {}): DataScope => ({
  // Lists that say "everything": a helper still reading them would be caught.
  teamIds: ['A', 'B', 'Z'], userIds: [ME, 'mate', 'stranger'], writableTeamIds: ['A', 'B', 'Z'], writableUserIds: [ME, 'mate', 'stranger'],
  precise: { userId: ME, subjects: { Case: both(NOTHING), Incident: both(NOTHING), Petition: both(NOTHING), ...over } },
  ...extra,
});

describe('scopeConditions: the same rule as the filters, for callers that compose it', () => {
  it('today: equals what buildScopeFilter / buildPetitionScopeFilter put under OR', () => {
    for (const scope of [legacy(), legacy({ isWardOfficer: true }), legacy({ teamIds: [], writableTeamIds: [] })]) {
      for (const op of ['read', 'write', 'assign'] as const) {
        const filter = buildScopeFilter(scope, op, 'Case') as { OR?: unknown[] };
        expect(scopeConditions(scope, op, 'Case')).toEqual(filter.OR ?? []);
        const petitions = buildPetitionScopeFilter(scope, op) as { OR?: unknown[] };
        expect(scopeConditions(scope, op, 'Petition')).toEqual(petitions.OR ?? []);
      }
    }
  });

  it('nobody in reach is an empty list, not "no restriction"', () => {
    expect(scopeConditions(legacy({ teamIds: [], userIds: [] }), 'read', 'Incident')).toEqual([]);
    expect(scopeConditions(precise(), 'read', 'Incident')).toEqual([]);
  });

  it('admin, and a dispatcher reading or assigning, are unrestricted; a dispatcher changing is not', () => {
    expect(scopeConditions(null, 'write', 'Case')).toBeNull();
    expect(scopeConditions(legacy({ canDispatch: true }), 'read', 'Case')).toBeNull();
    expect(scopeConditions(legacy({ canDispatch: true }), 'assign', 'Case')).toBeNull();
    expect(scopeConditions(legacy({ canDispatch: true }), 'write', 'Case')).toEqual([
      { investigatorId: { in: [ME, 'mate'] } }, { assignedTeamId: { in: ['A'] } }, { assignedTeamId: null },
    ]);
  });

  it('enforced: each subject by its own scope and owner field', () => {
    const scope = precise({ Case: both(OWN), Petition: both(TEAM_A), Incident: both(ALL) });
    expect(scopeConditions(scope, 'read', 'Case')).toEqual([{ investigatorId: ME }]);
    expect(scopeConditions(scope, 'read', 'Petition')).toEqual([{ assignedTeamId: { in: ['A'] } }]);
    expect(scopeConditions(scope, 'write', 'Incident')).toBeNull();
  });
});

describe('recordInScope', () => {
  it('today: owner in the people, team in the teams, or unassigned for somebody with a team who is not a ward officer', () => {
    const scope = legacy();
    expect(recordInScope({ ownerId: 'guest' }, scope, 'read', 'Case')).toBe(true);
    expect(recordInScope({ ownerId: 'guest', assignedTeamId: 'Z' }, scope, 'write', 'Case')).toBe(false);
    expect(recordInScope({ assignedTeamId: 'G' }, scope, 'read', 'Incident')).toBe(true);
    expect(recordInScope({ assignedTeamId: 'G' }, scope, 'write', 'Incident')).toBe(false);
    expect(recordInScope({ assignedTeamId: null }, scope, 'write', 'Petition')).toBe(true);
    expect(recordInScope({ assignedTeamId: null }, legacy({ isWardOfficer: true }), 'read', 'Petition')).toBe(false);
    expect(recordInScope({ assignedTeamId: null }, legacy({ teamIds: [], writableTeamIds: [] }), 'read', 'Case')).toBe(false);
    expect(recordInScope({ assignedTeamId: 'Z', ownerId: 'x' }, scope, 'read', 'Case')).toBe(false);
  });

  it('admin always; a dispatcher reads everything and changes only within reach', () => {
    expect(recordInScope({ assignedTeamId: 'Z' }, null, 'write', 'Case')).toBe(true);
    expect(recordInScope({ assignedTeamId: 'Z' }, undefined, 'write', 'Case')).toBe(true);
    const dispatcher = legacy({ canDispatch: true });
    expect(recordInScope({ assignedTeamId: 'Z' }, dispatcher, 'read', 'Case')).toBe(true);
    expect(recordInScope({ assignedTeamId: 'Z' }, dispatcher, 'write', 'Case')).toBe(false);
  });

  it('enforced: by the subject\'s precise scope, not by the lists', () => {
    const scope = precise({ Case: both(TREE_A, OWN), Incident: both(TEAM_A) });
    expect(recordInScope({ assignedTeamId: 'A', ownerId: 'mate' }, scope, 'read', 'Case')).toBe(true);
    expect(recordInScope({ assignedTeamId: 'A', ownerId: 'mate' }, scope, 'write', 'Case')).toBe(false);
    expect(recordInScope({ assignedTeamId: 'B', ownerId: ME }, scope, 'write', 'Case')).toBe(true);
    expect(recordInScope({ assignedTeamId: 'B', ownerId: ME }, scope, 'read', 'Incident')).toBe(false);
    expect(recordInScope({ assignedTeamId: 'Z', ownerId: 'stranger' }, scope, 'read', 'Petition')).toBe(false);
    expect(recordInScope({ assignedTeamId: 'Z' }, precise({}, { canDispatch: true }), 'read', 'Petition')).toBe(true);
  });
});

describe('teams and people in reach', () => {
  it('today: the read teams, the write teams; a dispatcher is not special here', () => {
    expect(scopeTeamIds(legacy(), 'read', 'Case')).toEqual(['A', 'G']);
    expect(scopeTeamIds(legacy(), 'write', 'Case')).toEqual(['A']);
    expect(scopeTeamIds(legacy({ canDispatch: true }), 'read', 'Incident')).toEqual(['A', 'G']);
    expect(scopeTeamIds(null, 'read', 'Case')).toBeNull();
    expect(teamInScope('G', legacy(), 'read', 'Case')).toBe(true);
    expect(teamInScope('G', legacy(), 'write', 'Case')).toBe(false);
    expect(teamInScope('anything', null, 'write', 'Case')).toBe(true);
    expect(userInScope('guest', legacy(), 'read')).toBe(true);
    expect(userInScope('guest', legacy(), 'write')).toBe(false);
    expect(userInScope('anyone', undefined, 'write')).toBe(true);
  });

  it('enforced: the teams of "exactly" and "as today" together; null when everything', () => {
    const scope = precise({ Case: both({ ...TREE_A, exactTeamIds: ['B'] }, TEAM_A), Incident: both(ALL) });
    expect(scopeTeamIds(scope, 'read', 'Case')!.sort()).toEqual(['A', 'B']);
    expect(scopeTeamIds(scope, 'write', 'Case')).toEqual(['A']);
    expect(scopeTeamIds(scope, 'read', 'Incident')).toBeNull();
    expect(scopeTeamIds(scope, 'read', 'Petition')).toEqual([]);
    expect(teamInScope('Z', scope, 'read', 'Case')).toBe(false);
    expect(teamInScope('Z', scope, 'read', 'Incident')).toBe(true);
  });

  it('enforced: a person is in reach when it is me, or one of the people reached "as today" on cases', () => {
    const scope = precise({ Case: both(TREE_A, OWN) });
    expect(userInScope('mate', scope, 'read')).toBe(true);
    expect(userInScope('mate', scope, 'write')).toBe(false);
    expect(userInScope(ME, scope, 'write')).toBe(true);
    expect(userInScope('stranger', scope, 'read')).toBe(false);
    expect(userInScope('stranger', precise({ Case: both(ALL) }), 'write')).toBe(true);
  });
});

describe('creatorFilter: lists of records known only by who created them', () => {
  const all = { dispatcherSeesAll: true, whenTeamOnly: 'has-creator' } as const;

  it('today: nobody and no team is nothing; people are the filter; a team with no people sees what the option says', () => {
    expect(creatorFilter(null, 'read', all)).toBeNull();
    expect(creatorFilter(legacy({ teamIds: [], userIds: [] }), 'read', all)).toEqual({ id: '__no_access__' });
    expect(creatorFilter(legacy(), 'read', all)).toEqual({ createdById: { in: [ME, 'mate', 'guest'] } });
    expect(creatorFilter(legacy(), 'write', all)).toEqual({ createdById: { in: [ME, 'mate'] } });
    expect(creatorFilter(legacy({ userIds: [] }), 'read', all)).toEqual({ createdById: { not: null } });
    expect(creatorFilter(legacy({ userIds: [] }), 'read', { dispatcherSeesAll: false, whenTeamOnly: 'all' })).toBeNull();
  });

  it('a dispatcher is unrestricted only where the list says so', () => {
    const dispatcher = legacy({ canDispatch: true });
    expect(creatorFilter(dispatcher, 'read', all)).toBeNull();
    expect(creatorFilter(dispatcher, 'read', { dispatcherSeesAll: false, whenTeamOnly: 'all' })).toEqual({ createdById: { in: [ME, 'mate', 'guest'] } });
  });

  it('enforced: mine when I reach any case, my team-mates\' only "as today", everything when all, nothing when nothing', () => {
    expect(creatorFilter(precise({ Case: both(OWN) }), 'read', all)).toEqual({ createdById: { in: [ME] } });
    expect(creatorFilter(precise({ Case: both(TEAM_A) }), 'read', all)).toEqual({ createdById: { in: [ME] } });
    expect(creatorFilter(precise({ Case: both(TREE_A, OWN) }), 'read', all)).toEqual({ createdById: { in: [ME, 'mate'] } });
    expect(creatorFilter(precise({ Case: both(TREE_A, OWN) }), 'write', all)).toEqual({ createdById: { in: [ME] } });
    expect(creatorFilter(precise({ Case: both(ALL) }), 'read', all)).toBeNull();
    expect(creatorFilter(precise(), 'read', all)).toEqual({ id: '__no_access__' });
  });
});

describe('scopeIsEmpty', () => {
  it('today: no people and no team; enforced: nothing reached of any subject', () => {
    expect(scopeIsEmpty(null)).toBe(false);
    expect(scopeIsEmpty(legacy())).toBe(false);
    expect(scopeIsEmpty(legacy({ teamIds: [], userIds: [] }))).toBe(true);
    expect(scopeIsEmpty(precise())).toBe(true);
    expect(scopeIsEmpty(precise({ Petition: both(OWN, NOTHING) }))).toBe(false);
  });
});
