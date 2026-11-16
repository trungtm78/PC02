import type { DataScope } from '../../auth/services/unit-scope.service';
import { AuthzScopeService } from '../../authz/authz-scope.service';
import { AuthzService, type AuthzSnapshot } from '../../authz/authz.service';
import { setEnforcement } from '../../authz/enforcement';
import type { OrgTeam, Reach, TeamConfigInput, UserInput } from '../../authz/engine/types';
import { NOTHING, RECORD_SUBJECTS, type PreciseScope, type PreciseScopes } from './precise-scope';
import {
  assertCreatorInScope,
  assertParentInScope,
  assertPetitionParentInScope,
  assertSourceInScope,
  buildPetitionScopeFilter,
  buildScopeFilter,
  creatorFilter,
  isNoAccessFilter,
  recordInScope,
  recordReadable,
  scopeConditions,
  scopeIsEmpty,
  scopeTeamIds,
  teamInScope,
  userInScope,
} from './scope-filter.util';

/**
 * REGRESSION CONTRACT (owner's order 16/11/2026): adding a record subject must not change, by one character, what the
 * scope helpers answer for petitions, incidents and cases.
 *
 * The snapshot of this file was recorded on the code BEFORE the fourth subject existed (main at 88dfaaaf). Every
 * helper is asked about every scope of a matrix (admin, an officer of PC02, a ward officer, a dispatcher, a person who
 * reaches nothing, and the precise scopes of permissions by team: own, exactly the team, as today, everything, mixed
 * read and write, a dispatcher under enforcement), every operation, the three subjects and a set of records. A
 * different answer anywhere fails this test: what the snapshot holds is the behaviour production runs today.
 *
 * Do not update the snapshot to make this pass. A change that is MEANT to alter one of these answers needs the
 * owner's decision first, and then a new snapshot recorded in a commit of its own that says which answer changed.
 */

const OLD_SUBJECTS = ['Case', 'Incident', 'Petition'] as const;
type OldSubject = (typeof OLD_SUBJECTS)[number];
const OPS = ['read', 'write', 'assign'] as const;
const ME = 'me';

const ALL: PreciseScope = { ...NOTHING, all: true };
const OWN: PreciseScope = { ...NOTHING, own: true };
const TEAM_A: PreciseScope = { ...NOTHING, exactTeamIds: ['A'] };
const TREE_A: PreciseScope = { ...NOTHING, tree: { teamIds: ['A', 'A1'], userIds: [ME, 'mate', 'junior'], includeUnassigned: true } };
const TREE_W: PreciseScope = { ...NOTHING, tree: { teamIds: ['W'], userIds: [ME, 'wardy'], includeUnassigned: false } };
const MIXED: PreciseScope = { all: false, own: true, exactTeamIds: ['B'], tree: { teamIds: ['A'], userIds: [ME, 'mate'], includeUnassigned: true } };

/**
 * Precise subjects for the three old subjects; any subject added later is given nothing at all. Built from
 * RECORD_SUBJECTS so that this file compiles and asks the same questions before and after a subject is added.
 */
function subjects(map: Partial<Record<OldSubject, { read: PreciseScope; write: PreciseScope }>>): PreciseScopes['subjects'] {
  return Object.fromEntries(
    RECORD_SUBJECTS.map((s) => [s, (map as Record<string, { read: PreciseScope; write: PreciseScope }>)[s] ?? { read: NOTHING, write: NOTHING }]),
  ) as PreciseScopes['subjects'];
}
const both = (read: PreciseScope, write: PreciseScope = read) => ({ read, write });
const everyOld = (read: PreciseScope, write: PreciseScope = read) => ({ Case: both(read, write), Incident: both(read, write), Petition: both(read, write) });

/** Lists that say "everything": a helper that reads them while a precise scope is present would show here. */
const WIDE = { teamIds: ['A', 'A1', 'B', 'W'], userIds: [ME, 'mate', 'junior', 'stranger', 'wardy'], writableTeamIds: ['A', 'A1', 'B', 'W'], writableUserIds: [ME, 'mate', 'junior', 'stranger', 'wardy'] };
const precise = (map: Parameters<typeof subjects>[0], extra: Partial<DataScope> = {}): DataScope => ({ ...WIDE, precise: { userId: ME, subjects: subjects(map) }, ...extra });

const SCOPES: Record<string, DataScope | null> = {
  admin: null,
  pc02Officer: { teamIds: ['A', 'A1'], userIds: [ME, 'mate', 'junior'], writableTeamIds: ['A'], writableUserIds: [ME, 'mate'] },
  wardOfficer: { teamIds: ['W'], userIds: [ME, 'wardy'], writableTeamIds: ['W'], writableUserIds: [ME, 'wardy'], isWardOfficer: true, wardTeamId: 'W' },
  dispatcher: { teamIds: ['A'], userIds: [ME], writableTeamIds: ['A'], writableUserIds: [ME], canDispatch: true },
  nobody: { teamIds: [], userIds: [], writableTeamIds: [], writableUserIds: [] },
  missingWriteLists: { teamIds: ['A'], userIds: [ME] },
  preciseNothing: precise({}),
  preciseOwn: precise(everyOld(OWN)),
  preciseTeam: precise(everyOld(TEAM_A)),
  preciseTree: precise(everyOld(TREE_A)),
  preciseWard: precise(everyOld(TREE_W), { isWardOfficer: true, wardTeamId: 'W' }),
  preciseAll: precise(everyOld(ALL)),
  preciseMixed: precise({ Case: both(MIXED, OWN), Incident: both(TREE_A, NOTHING), Petition: both(TEAM_A, ALL) }),
  preciseDispatcher: precise(everyOld(OWN), { canDispatch: true }),
};

const TEAMS = ['A', 'A1', 'B', 'W', null] as const;
const OWNERS = [ME, 'mate', 'stranger', 'wardy', null] as const;
const RECORDS = TEAMS.flatMap((assignedTeamId) => OWNERS.map((ownerId) => ({ assignedTeamId, ownerId })));
const label = (r: { assignedTeamId: string | null; ownerId: string | null }) => `${r.assignedTeamId ?? '-'}/${r.ownerId ?? '-'}`;

/** What a throwing check answers: passed, or the exception's class and message. */
function outcome(check: () => void): string {
  try {
    check();
    return 'pass';
  } catch (e) {
    return `${(e as Error).constructor.name}: ${(e as Error).message}`;
  }
}

function answersFor(scope: DataScope | null): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const s = scope ?? undefined;
  out.scopeIsEmpty = scopeIsEmpty(scope);
  for (const op of OPS) {
    out[`buildScopeFilter.${op}.any`] = buildScopeFilter(scope, op);
    out[`buildScopeFilter.${op}.Case`] = buildScopeFilter(scope, op, 'Case');
    out[`buildScopeFilter.${op}.Incident`] = buildScopeFilter(scope, op, 'Incident');
    out[`buildPetitionScopeFilter.${op}`] = buildPetitionScopeFilter(scope, op);
    for (const subject of OLD_SUBJECTS) out[`scopeConditions.${op}.${subject}`] = scopeConditions(scope, op, subject);
  }
  for (const op of ['read', 'write'] as const) {
    for (const opts of [
      { dispatcherSeesAll: true, whenTeamOnly: 'has-creator' as const },
      { dispatcherSeesAll: false, whenTeamOnly: 'all' as const },
    ]) {
      const f = creatorFilter(scope, op, opts);
      out[`creatorFilter.${op}.${opts.dispatcherSeesAll}.${opts.whenTeamOnly}`] = { filter: f, none: isNoAccessFilter(f) };
    }
    for (const subject of OLD_SUBJECTS) {
      out[`scopeTeamIds.${op}.${subject}`] = scopeTeamIds(scope, op, subject);
      out[`teamInScope.${op}.${subject}`] = Object.fromEntries(['A', 'A1', 'B', 'W'].map((t) => [t, teamInScope(t, scope, op, subject)]));
      out[`userInScope.${op}.${subject}`] = Object.fromEntries([ME, 'mate', 'stranger', 'wardy'].map((u) => [u, userInScope(u, scope, op, subject)]));
      out[`recordInScope.${op}.${subject}`] = Object.fromEntries(RECORDS.map((r) => [label(r), recordInScope(r, scope, op, subject)]));
    }
    out[`assertParentInScope.${op}`] = Object.fromEntries(
      RECORDS.map((r) => [
        label(r),
        ['any', 'Case', 'Incident'].map((subject) =>
          outcome(() =>
            assertParentInScope(
              { assignedTeamId: r.assignedTeamId, investigatorId: r.ownerId },
              s,
              op,
              subject === 'any' ? undefined : (subject as 'Case' | 'Incident'),
            ),
          ),
        ),
      ]),
    );
    out[`assertParentInScope.${op}.orphan`] = outcome(() => assertParentInScope(null, s, op));
    out[`assertPetitionParentInScope.${op}`] = Object.fromEntries(
      RECORDS.map((r) => [label(r), outcome(() => assertPetitionParentInScope({ assignedTeamId: r.assignedTeamId, enteredById: r.ownerId }, s, op))]),
    );
    out[`assertSourceInScope.${op}`] = Object.fromEntries(
      RECORDS.map((r) => [
        label(r),
        [
          outcome(() => assertSourceInScope({ kind: 'Incident', assignedTeamId: r.assignedTeamId, investigatorId: r.ownerId }, s, op)),
          outcome(() => assertSourceInScope({ kind: 'Petition', assignedTeamId: r.assignedTeamId, assignedToId: r.ownerId, enteredById: r.ownerId }, s, op)),
        ],
      ]),
    );
    out[`assertCreatorInScope.${op}`] = Object.fromEntries(
      [ME, 'mate', 'stranger', null].map((u) => [u ?? '-', outcome(() => assertCreatorInScope(u, s, op))]),
    );
  }
  for (const subject of OLD_SUBJECTS) {
    out[`recordReadable.${subject}`] = Object.fromEntries(
      RECORDS.map((r) => [label(r), recordReadable(subject, { assignedTeamId: r.assignedTeamId, investigatorId: r.ownerId, enteredById: r.ownerId }, scope)]),
    );
  }
  return out;
}

describe('REGRESSION CONTRACT: the scope helpers answer petitions, incidents and cases exactly as before', () => {
  it.each(Object.keys(SCOPES))('scope %s', (name) => {
    expect(answersFor(SCOPES[name])).toMatchSnapshot();
  });
});

// ── The scope a person gets from permissions by team, for the three old subjects ──────────────────────────────────

const OFFICER = ['read:Case', 'edit:Case', 'read:Incident', 'edit:Incident', 'read:Petition', 'edit:Petition', 'read:Directory'];

function snapshotOf(users: UserInput[], configs: TeamConfigInput[], templates: Record<string, Record<string, Reach>>): AuthzSnapshot {
  const teams: OrgTeam[] = [
    { id: 'A', parentId: null, active: true, wardId: null },
    { id: 'A1', parentId: 'A', active: true, wardId: null },
    { id: 'B', parentId: null, active: true, wardId: null },
    { id: 'W', parentId: null, active: true, wardId: 'ward-1' },
  ];
  return {
    revision: 'r1',
    mode: 'ENFORCE',
    org: {
      teams: new Map(teams.map((t) => [t.id, t])),
      children: new Map([['A', ['A1']]]),
      members: new Map([['A', ['me', 'mate', 'twoTeams']], ['A1', ['junior']], ['B', ['twoTeams', 'dispatcher']], ['W', ['wardy']]]),
    },
    config: {
      teamConfigs: new Map(configs.map((c) => [c.teamId, c])),
      templates: new Map(Object.entries(templates).map(([id, entries]) => [id, { id, name: id, entries: new Map(Object.entries(entries)) }])),
    },
    users: new Map(users.map((u) => [u.id, u])),
    teamNames: new Map(),
    templateNames: new Map(),
  };
}
const person = (id: string, teams: string[], over: Partial<UserInput> = {}): UserInput => ({
  id,
  roleName: 'OFFICER',
  rolePermissions: OFFICER,
  canDispatch: false,
  memberships: teams.map((teamId) => ({ teamId, isLeader: false })),
  overrides: [],
  dataGrants: [],
  ...over,
});
const explicit = (teamId: string, memberTemplateId: string): TeamConfigInput => ({ teamId, mode: 'EXPLICIT', memberTemplateId, leaderTemplateId: null, overrides: [] });

const USERS = [
  person('me', ['A']),
  person('wardy', ['W']),
  person('twoTeams', ['A', 'B']),
  person('dispatcher', ['B'], { canDispatch: true }),
  person('boss', [], { roleName: 'ADMIN', rolePermissions: ['read:Case'] }),
];
const CONFIGS = [explicit('B', 'ownOnly'), explicit('W', 'asToday')];
const TEMPLATES: Record<string, Record<string, Reach>> = {
  ownOnly: { 'read:Case': 'OWN', 'edit:Case': 'OWN', 'read:Petition': 'TEAM', 'read:Incident': 'TEAM_TREE' },
  asToday: Object.fromEntries(OFFICER.map((p) => [p, p.endsWith(':Directory') ? 'ALL' : 'TEAM_TREE'])),
};

describe('REGRESSION CONTRACT: the precise scope of the three old subjects is the same', () => {
  afterEach(() => setEnforcement(null));

  it.each(USERS.map((u) => u.id))('person %s', (id) => {
    const authz = new AuthzService({} as never);
    const snap = snapshotOf(USERS, CONFIGS, TEMPLATES);
    jest.spyOn(authz, 'cached').mockReturnValue(snap);
    jest.spyOn(authz, 'state').mockReturnValue('ENFORCE');
    const scope = new AuthzScopeService(authz).scopeOf(id, new Date('2026-11-16T03:00:00Z'));
    if (scope === null || scope === undefined) {
      expect({ scope }).toMatchSnapshot();
      return;
    }
    const sorted = (p: PreciseScope) => ({
      ...p,
      exactTeamIds: [...p.exactTeamIds].sort(),
      tree: p.tree ? { ...p.tree, teamIds: [...p.tree.teamIds].sort(), userIds: [...p.tree.userIds].sort() } : null,
    });
    const { precise: p, ...summary } = scope;
    expect({
      summary: { ...summary, teamIds: [...summary.teamIds].sort(), userIds: [...summary.userIds].sort(), writableTeamIds: [...(summary.writableTeamIds ?? [])].sort(), writableUserIds: [...(summary.writableUserIds ?? [])].sort() },
      userId: p?.userId,
      subjects: Object.fromEntries(OLD_SUBJECTS.map((s) => [s, { read: sorted(p!.subjects[s].read), write: sorted(p!.subjects[s].write) }])),
      // The answers of the helpers, computed from this scope, for the three old subjects.
      answers: answersFor(scope),
    }).toMatchSnapshot();
  });
});
