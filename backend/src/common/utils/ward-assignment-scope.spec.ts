import type { DataScope } from '../../auth/services/unit-scope.service';
import { NOTHING, type PreciseScope, type PreciseScopes } from './precise-scope';
import { actionConditions, recordInActionScope, recordInScope, recordReadable, scopeConditions, scopeIsEmpty, userInScope } from './scope-filter.util';

/**
 * The fourth record subject, WardAssignment: a ward or commune police unit's request for an investigator to be
 * assigned, decided by PC02. Its owner is the person who entered it; its team is the ward unit's team.
 */

const ME = 'me';
const ALL: PreciseScope = { ...NOTHING, all: true };
const OWN: PreciseScope = { ...NOTHING, own: true };
// 'mate' is a member of W who ALSO sits in ward V: being W's member must not carry V's requests into W.
const TREE_W: PreciseScope = { ...NOTHING, tree: { teamIds: ['W'], userIds: [ME, 'wardy', 'mate'], includeUnassigned: false } };
const both = (read: PreciseScope, write: PreciseScope = read) => ({ read, write });
type Subjects = PreciseScopes['subjects'];
const precise = (ward: Subjects['WardAssignment'], extra: Partial<DataScope> = {}): DataScope => ({
  teamIds: ['W', 'V'], userIds: [ME, 'wardy', 'stranger'], writableTeamIds: ['W', 'V'], writableUserIds: [ME, 'wardy', 'stranger'],
  precise: { userId: ME, subjects: { Case: both(ALL), Incident: both(ALL), Petition: both(ALL), WardAssignment: ward } },
  ...extra,
});
const legacy = (over: Partial<DataScope> = {}): DataScope => ({
  teamIds: ['W'], userIds: [ME, 'wardy', 'mate'], writableTeamIds: ['W'], writableUserIds: [ME, 'wardy', 'mate'], isWardOfficer: true, wardTeamId: 'W', ...over,
});

const OF_W = { assignedTeamId: 'W', ownerId: 'wardy' };
const OF_V = { assignedTeamId: 'V', ownerId: 'stranger' };
const MINE_IN_V = { assignedTeamId: 'V', ownerId: ME };
const MATES_IN_V = { assignedTeamId: 'V', ownerId: 'mate' };

describe('WardAssignment: a record subject of its own', () => {
  it('is reached by its own scope, and its owner is the person who entered it', () => {
    const scope = precise(both(OWN));
    expect(recordInScope(MINE_IN_V, scope, 'read', 'WardAssignment')).toBe(true);
    expect(recordInScope(OF_W, scope, 'read', 'WardAssignment')).toBe(false);
    expect(scopeConditions(scope, 'read', 'WardAssignment')).toEqual([{ enteredById: ME }]);
    expect(recordReadable('WardAssignment', { assignedTeamId: 'V', enteredById: ME, investigatorId: 'someone' }, scope)).toBe(true);
    expect(recordReadable('WardAssignment', { assignedTeamId: 'V', enteredById: 'someone', investigatorId: ME }, scope)).toBe(false);
  });

  it('a ward officer reaches the records of the ward team and of its people, not another ward', () => {
    const scope = precise(both(TREE_W));
    expect(recordInScope(OF_W, scope, 'read', 'WardAssignment')).toBe(true);
    expect(recordInScope(OF_V, scope, 'read', 'WardAssignment')).toBe(false);
    expect(recordInScope(OF_V, legacy(), 'read', 'WardAssignment')).toBe(false);
    expect(recordInScope(OF_W, legacy(), 'write', 'WardAssignment')).toBe(true);
  });

  it('a request belongs to its ward unit: a member of the unit who entered requests elsewhere carries none of them in', () => {
    // Enforced, "as today" of the ward team: the team's requests only, not those its members entered for another unit.
    const enforced = precise(both(TREE_W));
    expect(recordInScope(MATES_IN_V, enforced, 'read', 'WardAssignment')).toBe(false);
    expect(recordInScope(MATES_IN_V, enforced, 'write', 'WardAssignment')).toBe(false);
    expect(recordInScope(MINE_IN_V, enforced, 'read', 'WardAssignment')).toBe(false);
    expect(scopeConditions(enforced, 'read', 'WardAssignment')).toEqual([{ assignedTeamId: { in: ['W'] } }]);
    expect(userInScope('mate', enforced, 'read', 'WardAssignment')).toBe(false);
    // Not enforced: the same rule on the lists.
    expect(recordInScope(MATES_IN_V, legacy(), 'read', 'WardAssignment')).toBe(false);
    expect(scopeConditions(legacy(), 'read', 'WardAssignment')).toEqual([{ assignedTeamId: { in: ['W'] } }]);
    expect(userInScope('mate', legacy(), 'read', 'WardAssignment')).toBe(false);
    // "Own records only" is a grant of its own: the person's own requests, wherever they are.
    expect(recordInScope(MINE_IN_V, precise(both(OWN)), 'read', 'WardAssignment')).toBe(true);
    expect(userInScope(ME, precise(both(OWN)), 'read', 'WardAssignment')).toBe(true);
    // The old subjects keep reaching the records of the team's people (the regression contract holds the rest).
    expect(recordInScope(MATES_IN_V, legacy(), 'read', 'Petition')).toBe(true);
  });

  it('a scope that reaches only ward requests is not an empty scope', () => {
    const wardOnly: DataScope = {
      ...precise(both(TREE_W)),
      precise: { userId: ME, subjects: { Case: both(NOTHING), Incident: both(NOTHING), Petition: both(NOTHING), WardAssignment: both(TREE_W) } },
    };
    expect(scopeIsEmpty(wardOnly)).toBe(false);
    expect(scopeIsEmpty({ ...wardOnly, precise: { ...wardOnly.precise!, subjects: { ...wardOnly.precise!.subjects, WardAssignment: both(NOTHING) } } })).toBe(true);
  });

  it('a dispatcher is NOT let through: the exception of 19/09/2026 is for petitions, incidents and cases only', () => {
    const enforced = precise(both(TREE_W), { canDispatch: true });
    expect(recordInScope(OF_V, enforced, 'read', 'WardAssignment')).toBe(false);
    expect(scopeConditions(enforced, 'read', 'WardAssignment')).not.toBeNull();
    expect(scopeConditions(enforced, 'assign', 'WardAssignment')).not.toBeNull();
    const notEnforced = legacy({ canDispatch: true });
    expect(recordInScope(OF_V, notEnforced, 'read', 'WardAssignment')).toBe(false);
    expect(scopeConditions(notEnforced, 'read', 'WardAssignment')).not.toBeNull();
    // ...while for the old subjects the dispatcher still reads everything.
    expect(recordInScope(OF_V, notEnforced, 'read', 'Petition')).toBe(true);
  });

  it('admin reaches everything', () => {
    expect(recordInScope(OF_V, null, 'write', 'WardAssignment')).toBe(true);
    expect(scopeConditions(null, 'read', 'WardAssignment')).toBeNull();
  });
});

describe('scoped actions: reviewing reaches as far as the review permission, never as far as editing', () => {
  it('enforced: the scope of the action is its own', () => {
    const scope = precise({ read: ALL, write: NOTHING, actions: { review: ALL } });
    expect(recordInActionScope(OF_V, scope, 'WardAssignment', 'review')).toBe(true);
    expect(recordInScope(OF_V, scope, 'write', 'WardAssignment')).toBe(false);
    expect(actionConditions(scope, 'WardAssignment', 'review')).toBeNull();
  });

  it('enforced: editing gives no review, and a scope without the action reaches nothing', () => {
    const editOnly = precise({ read: ALL, write: ALL });
    expect(recordInActionScope(OF_V, editOnly, 'WardAssignment', 'review')).toBe(false);
    expect(actionConditions(editOnly, 'WardAssignment', 'review')).toEqual([]);
    const reviewTree = precise({ read: ALL, write: NOTHING, actions: { review: TREE_W } });
    expect(recordInActionScope(OF_W, reviewTree, 'WardAssignment', 'review')).toBe(true);
    expect(recordInActionScope(OF_V, reviewTree, 'WardAssignment', 'review')).toBe(false);
    expect(recordInActionScope(MATES_IN_V, reviewTree, 'WardAssignment', 'review')).toBe(false);
    expect(actionConditions(reviewTree, 'WardAssignment', 'review')).toEqual([{ assignedTeamId: { in: ['W'] } }]);
  });

  it('each scoped action has its own reach: matching is neither review nor editing', () => {
    const scope = precise({ read: ALL, write: TREE_W, actions: { review: ALL, matchSubjects: TREE_W } });
    expect(recordInActionScope(OF_V, scope, 'WardAssignment', 'review')).toBe(true);
    expect(recordInActionScope(OF_V, scope, 'WardAssignment', 'matchSubjects')).toBe(false);
    expect(recordInActionScope(OF_W, scope, 'WardAssignment', 'matchSubjects')).toBe(true);
    expect(actionConditions(scope, 'WardAssignment', 'review')).toBeNull();
    expect(actionConditions(scope, 'WardAssignment', 'matchSubjects')).toEqual([{ assignedTeamId: { in: ['W'] } }]);
    // Review without matching: matching reaches nothing.
    const reviewOnly = precise({ read: ALL, write: NOTHING, actions: { review: ALL } });
    expect(recordInActionScope(OF_W, reviewOnly, 'WardAssignment', 'matchSubjects')).toBe(false);
    expect(actionConditions(reviewOnly, 'WardAssignment', 'matchSubjects')).toEqual([]);
    // Matching without review: reviewing reaches nothing.
    const matchOnly = precise({ read: ALL, write: NOTHING, actions: { matchSubjects: ALL } });
    expect(recordInActionScope(OF_W, matchOnly, 'WardAssignment', 'review')).toBe(false);
    expect(actionConditions(matchOnly, 'WardAssignment', 'review')).toEqual([]);
    // Matching is not editing: it reaches where editing does not...
    const matchNoEdit = precise({ read: ALL, write: NOTHING, actions: { matchSubjects: TREE_W } });
    expect(recordInActionScope(OF_W, matchNoEdit, 'WardAssignment', 'matchSubjects')).toBe(true);
    expect(actionConditions(matchNoEdit, 'WardAssignment', 'matchSubjects')).toEqual([{ assignedTeamId: { in: ['W'] } }]);
    // ...and does not reach where only editing does.
    const editWider = precise({ read: ALL, write: ALL, actions: { review: NOTHING, matchSubjects: TREE_W } });
    expect(recordInActionScope(OF_V, editWider, 'WardAssignment', 'matchSubjects')).toBe(false);
    expect(recordInActionScope(OF_V, editWider, 'WardAssignment', 'review')).toBe(false);
    expect(actionConditions(editWider, 'WardAssignment', 'matchSubjects')).toEqual([{ assignedTeamId: { in: ['W'] } }]);
    expect(actionConditions(editWider, 'WardAssignment', 'review')).toEqual([]);
  });

  it('a dispatcher gets nothing more for an action', () => {
    const scope = precise({ read: ALL, write: NOTHING, actions: { review: NOTHING } }, { canDispatch: true });
    expect(recordInActionScope(OF_V, scope, 'WardAssignment', 'review')).toBe(false);
    expect(recordInActionScope(OF_V, legacy({ canDispatch: true }), 'WardAssignment', 'review')).toBe(false);
  });

  it('not enforced: an action changes a record, so it reaches as far as changing does', () => {
    expect(recordInActionScope(OF_W, legacy(), 'WardAssignment', 'review')).toBe(true);
    expect(recordInActionScope(OF_V, legacy(), 'WardAssignment', 'review')).toBe(false);
    expect(recordInActionScope(OF_W, legacy({ writableTeamIds: [], writableUserIds: [] }), 'WardAssignment', 'review')).toBe(false);
    expect(recordInActionScope(OF_V, null, 'WardAssignment', 'review')).toBe(true);
    // The list of requests a person may act on: the ward team of the write lists, not its people, no unassigned.
    expect(actionConditions(legacy(), 'WardAssignment', 'review')).toEqual([{ assignedTeamId: { in: ['W'] } }]);
    expect(actionConditions(legacy({ writableTeamIds: [], writableUserIds: [] }), 'WardAssignment', 'review')).toEqual([]);
    expect(actionConditions(null, 'WardAssignment', 'review')).toBeNull();
  });
});
