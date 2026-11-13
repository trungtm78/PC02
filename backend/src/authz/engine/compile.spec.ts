import * as fc from 'fast-check';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { TEAM_TREE_MAX_DEPTH } from '../../teams/team-tree.constants';
import { TeamsService } from '../../teams/teams.service';
import { compile, governingConfig, isRecordScoped, widestReach } from './compile';
import { activeDescendants, operationOf, recordScope, toLegacyScope } from './scope';
import { entryProblems } from './validate';
import type { AuthzConfig, OrgSnapshot, OrgTeam, Reach, RecordScope, TeamConfigInput, TemplateInput, UserInput } from './types';

const NOW = new Date('2026-11-14T00:00:00Z');
const LATER = new Date('2026-12-01T00:00:00Z');
const PAST = new Date('2026-11-01T00:00:00Z');
const OFFICER_PERMS = ['read:Case', 'write:Case', 'edit:Case', 'delete:Case', 'read:Petition', 'edit:Petition', 'read:Directory'];

function org(teams: (Partial<OrgTeam> & { id: string })[], members: Record<string, readonly string[]> = {}): OrgSnapshot {
  const map = new Map<string, OrgTeam>(teams.map((t) => [t.id, { parentId: null, active: true, wardId: null, ...t }]));
  const children = new Map<string, string[]>();
  for (const t of map.values()) if (t.parentId) children.set(t.parentId, [...(children.get(t.parentId) ?? []), t.id]);
  return { teams: map, children, members: new Map(Object.entries(members)) };
}
const template = (id: string, entries: Record<string, Reach>): TemplateInput => ({ id, name: id, entries: new Map(Object.entries(entries)) });
function config(teamConfigs: Partial<TeamConfigInput>[] = [], templates: TemplateInput[] = []): AuthzConfig {
  return {
    teamConfigs: new Map(
      teamConfigs.map((c) => [c.teamId as string, { mode: 'EXPLICIT', memberTemplateId: null, leaderTemplateId: null, overrides: [], ...c } as TeamConfigInput]),
    ),
    templates: new Map(templates.map((t) => [t.id, t])),
  };
}
const user = (over: Partial<UserInput> = {}): UserInput => ({
  id: 'u1', roleName: 'OFFICER', rolePermissions: OFFICER_PERMS, canDispatch: false, memberships: [], overrides: [], dataGrants: [], ...over,
});
const sorted = (xs: readonly string[]) => [...xs].sort();

describe('compile: nobody has set anything (today)', () => {
  const o = org([{ id: 'A' }, { id: 'A1', parentId: 'A' }, { id: 'B' }], { A: ['u1', 'u2'], A1: ['u3'], B: ['u9'] });

  it('a member keeps what the role holds, reaching the team, the teams under it, their people and unassigned records', () => {
    const e = compile(o, config(), user({ memberships: [{ teamId: 'A', isLeader: false }] }), NOW);
    expect(e.keys).toEqual(sorted(OFFICER_PERMS));
    expect(e.grants.get('read:Case')).toEqual([{ reach: 'TEAM_TREE', teamId: 'A', source: { kind: 'ROLE', teamId: 'A' } }]);
    const scope = recordScope(o, e, 'read:Case', 'read') as Exclude<RecordScope, { all: true }>;
    expect(scope.own).toBe(false);
    expect(scope.exactTeamIds).toEqual([]);
    expect(sorted(scope.tree!.teamIds)).toEqual(['A', 'A1']);
    expect(sorted(scope.tree!.userIds)).toEqual(['u1', 'u2', 'u3']);
    expect(scope.tree!.includeUnassigned).toBe(true);
  });

  it('a permission that is not about records is simply held', () => {
    const e = compile(o, config(), user({ memberships: [{ teamId: 'A', isLeader: false }] }), NOW);
    expect(isRecordScoped('read:Directory')).toBe(false);
    expect(e.grants.get('read:Directory')![0].reach).toBe('ALL');
    expect(recordScope(o, e, 'read:Directory', 'read')).toEqual({ all: true });
  });

  it('a person in no team keeps the role over their own records only, and no unassigned ones', () => {
    const e = compile(o, config(), user(), NOW);
    expect(e.keys).toEqual(sorted(OFFICER_PERMS));
    expect(recordScope(o, e, 'read:Case', 'read')).toEqual({
      all: false, own: false, exactTeamIds: [], tree: { teamIds: [], userIds: ['u1'], includeUnassigned: false },
    });
  });

  it('a ward officer never sees unassigned records', () => {
    const w = org([{ id: 'W', wardId: 'ward-1' }], { W: ['u1'] });
    const e = compile(w, config(), user({ memberships: [{ teamId: 'W', isLeader: false }] }), NOW);
    expect(e.wardTeamId).toBe('W');
    expect((recordScope(w, e, 'read:Case', 'read') as { tree: { includeUnassigned: boolean } }).tree.includeUnassigned).toBe(false);
  });

  it('a membership of a paused or archived team does not count; one that leaves the person teamless falls back to the role', () => {
    const p = org([{ id: 'A', active: false }, { id: 'B' }], { A: ['u1'], B: ['u1'] });
    const both = compile(p, config(), user({ memberships: [{ teamId: 'A', isLeader: false }, { teamId: 'B', isLeader: false }] }), NOW);
    expect(both.activeTeamIds).toEqual(['B']);
    const onlyPaused = compile(p, config(), user({ memberships: [{ teamId: 'A', isLeader: false }] }), NOW);
    expect(onlyPaused.activeTeamIds).toEqual([]);
    expect(onlyPaused.grants.get('read:Case')).toEqual([{ reach: 'TEAM_TREE', teamId: null, source: { kind: 'ROLE', teamId: null } }]);
  });

  it('ADMIN holds what the role holds, over every record, whatever is configured', () => {
    const cfg = config([{ teamId: 'A', memberTemplateId: 't' }], [template('t', { 'read:Case': 'OWN' })]);
    const e = compile(o, cfg, user({ roleName: 'ADMIN', rolePermissions: ['read:Case', 'write:Role'], memberships: [{ teamId: 'A', isLeader: false }] }), NOW);
    expect(e.admin).toBe(true);
    expect(e.keys).toEqual(['read:Case', 'write:Role']);
    expect(recordScope(o, e, 'read:Case', 'read')).toEqual({ all: true });
    expect(recordScope(o, e, 'nothing:AtAll', 'write')).toEqual({ all: true });
    expect(e.validUntil).toBeNull();
  });
});

describe('compile: a team that has its own configuration', () => {
  const o = org([{ id: 'A' }, { id: 'A1', parentId: 'A' }, { id: 'A2', parentId: 'A' }, { id: 'B' }], { A: ['u1', 'u2'], A1: ['u3'], B: ['u1', 'u9'] });
  const member = template('member', { 'read:Case': 'OWN', 'read:Petition': 'TEAM', 'edit:Petition': 'TEAM' });
  const leader = template('leader', { 'read:Case': 'TEAM_TREE', 'delete:Case': 'TEAM_TREE' });

  it('replaces the role for that membership: only what the template gives, at its reach', () => {
    const cfg = config([{ teamId: 'A', memberTemplateId: 'member' }], [member]);
    const e = compile(o, cfg, user({ memberships: [{ teamId: 'A', isLeader: false }] }), NOW);
    expect(e.keys).toEqual(['edit:Petition', 'read:Case', 'read:Petition']);
    expect(e.grants.get('read:Case')![0].source).toEqual({ kind: 'TEMPLATE', teamId: 'A', configTeamId: 'A', templateId: 'member', asLeader: false });
    expect(recordScope(o, e, 'read:Case', 'read')).toEqual({ all: false, own: true, exactTeamIds: [], tree: null });
    expect(recordScope(o, e, 'read:Petition', 'read')).toEqual({ all: false, own: false, exactTeamIds: ['A'], tree: null });
    expect(recordScope(o, e, 'delete:Case', 'write')).toEqual({ all: false, own: false, exactTeamIds: [], tree: null });
  });

  it('a leader gets the leader template when there is one, else the member template', () => {
    const cfg = config([{ teamId: 'A', memberTemplateId: 'member', leaderTemplateId: 'leader' }], [member, leader]);
    const asLeader = compile(o, cfg, user({ memberships: [{ teamId: 'A', isLeader: true }] }), NOW);
    expect(asLeader.keys).toEqual(['delete:Case', 'read:Case']);
    expect(asLeader.grants.get('read:Case')![0].source).toMatchObject({ templateId: 'leader', asLeader: true });
    const noLeaderTemplate = config([{ teamId: 'A', memberTemplateId: 'member' }], [member]);
    expect(compile(o, noLeaderTemplate, user({ memberships: [{ teamId: 'A', isLeader: true }] }), NOW).keys).toEqual(['edit:Petition', 'read:Case', 'read:Petition']);
  });

  it('a team under it that has nothing of its own follows it, measured from the member\'s OWN team', () => {
    const cfg = config([{ teamId: 'A', memberTemplateId: 'member' }, { teamId: 'A2', mode: 'INHERIT' }], [member]);
    expect(governingConfig(o, cfg, 'A1')?.teamId).toBe('A');
    expect(governingConfig(o, cfg, 'A2')?.teamId).toBe('A');
    expect(governingConfig(o, cfg, 'B')).toBeNull();
    const e = compile(o, cfg, user({ id: 'u3', memberships: [{ teamId: 'A1', isLeader: false }] }), NOW);
    expect(e.grants.get('read:Petition')![0]).toMatchObject({ teamId: 'A1', source: { configTeamId: 'A' } });
    expect(recordScope(o, e, 'read:Petition', 'read')).toMatchObject({ exactTeamIds: ['A1'] });
  });

  it('a configured reach the permission cannot have grants NOTHING (it is never read as "everything")', () => {
    const cfg = config(
      [{ teamId: 'A', memberTemplateId: 't', overrides: [{ permission: 'write:User', effect: 'GRANT', reach: 'TEAM', expiresAt: null, audience: 'ALL' }] }],
      [template('t', { 'read:User': 'OWN', 'read:Directory': 'TEAM_TREE', 'read:Setting': 'ALL', 'read:Case': 'OWN' })],
    );
    const e = compile(
      o,
      cfg,
      user({ memberships: [{ teamId: 'A', isLeader: false }], overrides: [{ permission: 'delete:User', effect: 'GRANT', reach: 'OWN', expiresAt: null }] }),
      NOW,
    );
    expect(e.keys).toEqual(['read:Case', 'read:Setting']);
  });

  it('an explicit configuration with no template gives nothing', () => {
    const e = compile(o, config([{ teamId: 'A' }]), user({ memberships: [{ teamId: 'A', isLeader: false }] }), NOW);
    expect(e.keys).toEqual([]);
  });

  it('a hierarchy that loops ends', () => {
    const loop = org([{ id: 'X', parentId: 'Y' }, { id: 'Y', parentId: 'X' }]);
    expect(governingConfig(loop, config(), 'X')).toBeNull();
    expect(activeDescendants(loop, 'X')).toEqual(['Y']);
  });

  it('memberships add up, each reaching its own team: A gives OWN on cases, B (unconfigured) gives today\'s reach on B', () => {
    const cfg = config([{ teamId: 'A', memberTemplateId: 'member' }], [member]);
    const e = compile(o, cfg, user({ memberships: [{ teamId: 'A', isLeader: false }, { teamId: 'B', isLeader: false }] }), NOW);
    const scope = recordScope(o, e, 'read:Case', 'read') as Exclude<RecordScope, { all: true }>;
    expect(scope.own).toBe(true);
    expect(scope.tree).toEqual({ teamIds: ['B'], userIds: expect.arrayContaining(['u1', 'u9']), includeUnassigned: true });
    // "Exactly team A" on petitions does not reach B, and B's tree does not swallow A.
    const petitions = recordScope(o, e, 'read:Petition', 'read') as Exclude<RecordScope, { all: true }>;
    expect(petitions.exactTeamIds).toEqual(['A']);
    expect(petitions.tree!.teamIds).toEqual(['B']);
    expect(widestReach(e, 'read:Case')).toBe('TEAM_TREE');
    expect(widestReach(e, 'made:Up')).toBeNull();
  });
});

describe('compile: overrides', () => {
  const o = org([{ id: 'A' }], { A: ['u1'] });
  const base = template('t', { 'read:Case': 'TEAM', 'edit:Case': 'TEAM' });
  const cfgWith = (overrides: TeamConfigInput['overrides']) => config([{ teamId: 'A', memberTemplateId: 't', overrides }], [base]);
  const inA = (over: Partial<UserInput> = {}) => user({ memberships: [{ teamId: 'A', isLeader: false }], ...over });

  it('a team grant adds, a team mute takes away from what that team gives, and a mute beats a grant', () => {
    const e = compile(
      o,
      cfgWith([
        { permission: 'delete:Case', effect: 'GRANT', reach: 'OWN', expiresAt: null, audience: 'ALL' },
        { permission: 'edit:Case', effect: 'MUTE', reach: null, expiresAt: null, audience: 'ALL' },
        { permission: 'restore:Case', effect: 'GRANT', reach: 'TEAM', expiresAt: null, audience: 'ALL' },
        { permission: 'restore:Case', effect: 'MUTE', reach: null, expiresAt: null, audience: 'ALL' },
      ]),
      inA(),
      NOW,
    );
    expect(e.keys).toEqual(['delete:Case', 'read:Case']);
    expect(e.grants.get('delete:Case')![0]).toEqual({ reach: 'OWN', teamId: 'A', source: { kind: 'TEAM_OVERRIDE', teamId: 'A', configTeamId: 'A' } });
    expect(e.muted.get('edit:Case')).toEqual([{ kind: 'TEAM_OVERRIDE', teamId: 'A', configTeamId: 'A' }]);
    expect(e.muted.has('restore:Case')).toBe(true);
  });

  it('an override for leaders does not touch members, and the other way round', () => {
    const cfg = cfgWith([
      { permission: 'delete:Case', effect: 'GRANT', reach: 'TEAM', expiresAt: null, audience: 'LEADER' },
      { permission: 'edit:Case', effect: 'MUTE', reach: null, expiresAt: null, audience: 'MEMBER' },
    ]);
    expect(compile(o, cfg, inA(), NOW).keys).toEqual(['read:Case']);
    expect(compile(o, cfg, inA({ memberships: [{ teamId: 'A', isLeader: true }] }), NOW).keys).toEqual(['delete:Case', 'edit:Case', 'read:Case']);
  });

  it('a personal grant adds whatever the teams give; a personal mute removes it everywhere', () => {
    const e = compile(
      o,
      cfgWith([]),
      inA({
        overrides: [
          { permission: 'export_full:Petition', effect: 'GRANT', reach: 'ALL', expiresAt: null },
          { permission: 'read:Incident', effect: 'GRANT', reach: 'TEAM', expiresAt: null },
          { permission: 'read:Case', effect: 'MUTE', reach: null, expiresAt: null },
        ],
      }),
      NOW,
    );
    expect(e.keys).toEqual(['edit:Case', 'export_full:Petition', 'read:Incident']);
    expect(e.muted.get('read:Case')).toEqual([{ kind: 'USER_OVERRIDE' }]);
    expect(recordScope(o, e, 'export_full:Petition', 'read')).toEqual({ all: true });
    // A personal grant has no team of its own: it is measured from the person's teams.
    expect(recordScope(o, e, 'read:Incident', 'read')).toMatchObject({ exactTeamIds: ['A'] });
  });

  it('an override past its end is not there; the answer is good until the earliest end still ahead', () => {
    const cfg = cfgWith([
      { permission: 'delete:Case', effect: 'GRANT', reach: 'OWN', expiresAt: PAST, audience: 'ALL' },
      { permission: 'edit:Case', effect: 'MUTE', reach: null, expiresAt: PAST, audience: 'ALL' },
      { permission: 'restore:Case', effect: 'GRANT', reach: 'OWN', expiresAt: LATER, audience: 'ALL' },
    ]);
    const soon = new Date('2026-11-20T00:00:00Z');
    const u = inA({ overrides: [{ permission: 'read:Incident', effect: 'GRANT', reach: 'OWN', expiresAt: soon }] });
    const e = compile(o, cfg, u, NOW);
    expect(e.keys).toEqual(['edit:Case', 'read:Case', 'read:Incident', 'restore:Case']);
    expect(e.validUntil).toEqual(soon);
    // The same inputs a moment after the end: the grant is gone without anything having been written.
    const after = compile(o, cfg, u, new Date(soon.getTime() + 1));
    expect(after.keys).toEqual(['edit:Case', 'read:Case', 'restore:Case']);
    expect(after.validUntil).toEqual(LATER);
    expect(compile(o, cfg, u, soon).keys).not.toContain('read:Incident');
  });

  it('a grant with no reach is not a grant', () => {
    const e = compile(o, cfgWith([{ permission: 'delete:Case', effect: 'GRANT', reach: null, expiresAt: null, audience: 'ALL' }]), inA(), NOW);
    expect(e.keys).not.toContain('delete:Case');
  });
});

describe('conditional grants of a role', () => {
  const o = org([{ id: 'A' }], { A: ['u1'] });
  const u = (over: Partial<UserInput> = {}) =>
    user({ rolePermissions: ['read:User', 'read:Case'], conditionalRolePermissions: ['read:User'], memberships: [{ teamId: 'A', isLeader: false }], ...over });

  it('are held (the route guard never looked at conditions) and remembered as conditional', () => {
    const e = compile(o, config(), u(), NOW);
    expect(e.keys).toEqual(['read:Case', 'read:User']);
    expect(e.conditional).toEqual(['read:User']);
  });

  it('given outright by a template or an override they are not conditional any more', () => {
    const viaTemplate = compile(o, config([{ teamId: 'A', memberTemplateId: 't' }], [template('t', { 'read:User': 'ALL' })]), u(), NOW);
    expect(viaTemplate.conditional).toEqual([]);
    const viaOverride = compile(o, config(), u({ overrides: [{ permission: 'read:User', effect: 'GRANT', reach: 'ALL', expiresAt: null }] }), NOW);
    expect(viaOverride.keys).toContain('read:User');
    expect(viaOverride.conditional).toEqual([]);
  });

  it('nobody has conditional keys unless the role says so; ADMIN carries them like anybody', () => {
    expect(compile(o, config(), user({ memberships: [{ teamId: 'A', isLeader: false }] }), NOW).conditional).toEqual([]);
    expect(compile(o, config(), u({ roleName: 'ADMIN' }), NOW).conditional).toEqual(['read:User']);
  });
});

describe('data access grants', () => {
  const o = org([{ id: 'A' }, { id: 'G' }, { id: 'W' }, { id: 'Off', active: false }], { A: ['u1'], G: ['g1'], W: ['w1'], Off: ['x'] });
  const u = user({
    memberships: [{ teamId: 'A', isLeader: false }],
    dataGrants: [
      { teamId: 'G', level: 'READ', expiresAt: null },
      { teamId: 'W', level: 'WRITE', expiresAt: LATER },
      { teamId: 'Off', level: 'READ', expiresAt: null },
      { teamId: 'A', level: 'READ', expiresAt: PAST },
    ],
  });

  it('READ extends reading, WRITE extends both; an ended grant and a grant on a paused team are not there', () => {
    const e = compile(o, config(), u, NOW);
    expect(e.dataGrants).toEqual([{ teamId: 'G', level: 'READ' }, { teamId: 'W', level: 'WRITE' }]);
    expect(e.validUntil).toEqual(LATER);
    const read = recordScope(o, e, 'read:Case', 'read') as Exclude<RecordScope, { all: true }>;
    const write = recordScope(o, e, 'edit:Case', 'write') as Exclude<RecordScope, { all: true }>;
    expect(sorted(read.tree!.teamIds)).toEqual(['A', 'G', 'W']);
    expect(sorted(read.tree!.userIds)).toEqual(['g1', 'u1', 'w1']);
    expect(sorted(write.tree!.teamIds)).toEqual(['A', 'W']);
    expect(sorted(write.tree!.userIds)).toEqual(['u1', 'w1']);
  });

  it('never bring unassigned records to someone limited to their own or to one team', () => {
    for (const reach of ['OWN', 'TEAM'] as const) {
      const cfg = config([{ teamId: 'A', memberTemplateId: 't' }], [template('t', { 'read:Case': reach })]);
      const scope = recordScope(o, compile(o, cfg, u, NOW), 'read:Case', 'read') as Exclude<RecordScope, { all: true }>;
      expect(sorted(scope.tree!.teamIds)).toEqual(['G', 'W']);
      expect(scope.tree!.includeUnassigned).toBe(false);
    }
    // "As today" still has them.
    expect((recordScope(o, compile(o, config(), u, NOW), 'read:Case', 'read') as { tree: { includeUnassigned: boolean } }).tree.includeUnassigned).toBe(true);
  });

  it('seeing and changing: which permissions a READ grant extends', () => {
    expect(['read:Case', 'export_full:Petition', 'read_sensitive:CaseGovernance', 'download:CaseGovernance'].map(operationOf)).toEqual(['read', 'read', 'read', 'read']);
    expect(['edit:Case', 'delete:Case', 'restore:Case', 'write:Case', 'approve:Report'].map(operationOf)).toEqual(['write', 'write', 'write', 'write', 'write']);
  });

  it('give nothing to someone who has no grant for the permission at all', () => {
    const cfg = config([{ teamId: 'A', memberTemplateId: 't' }], [template('t', { 'read:Petition': 'OWN' })]);
    const e = compile(o, cfg, u, NOW);
    expect(recordScope(o, e, 'read:Case', 'read')).toEqual({ all: false, own: false, exactTeamIds: [], tree: null });
    // With an OWN grant, the data grants still add their teams.
    expect(recordScope(o, e, 'read:Petition', 'read')).toMatchObject({ own: true, tree: { teamIds: expect.arrayContaining(['G', 'W']) } });
  });
});

describe('the shape today\'s filters take', () => {
  const o = org([{ id: 'A' }], { A: ['u1'] });
  it('a precise scope cannot be said in it: the caller is told, never given something wider', () => {
    const cfg = config([{ teamId: 'A', memberTemplateId: 't' }], [template('t', { 'read:Case': 'OWN', 'edit:Case': 'TEAM' })]);
    const e = compile(o, cfg, user({ memberships: [{ teamId: 'A', isLeader: false }] }), NOW);
    expect(toLegacyScope(e, recordScope(o, e, 'read:Case', 'read'), recordScope(o, e, 'edit:Case', 'write'))).toBeUndefined();
    expect(toLegacyScope(e, { all: true }, recordScope(o, e, 'edit:Case', 'write'))).toBeUndefined();
    expect(toLegacyScope(e, { all: true }, { all: true })).toBeNull();
  });

  it('nothing at all is said as "only me, no team"', () => {
    const e = compile(o, config([{ teamId: 'A' }]), user({ memberships: [{ teamId: 'A', isLeader: false }] }), NOW);
    const none = recordScope(o, e, 'read:Case', 'read');
    expect(toLegacyScope(e, none, none)).toEqual({
      teamIds: [], userIds: ['u1'], writableTeamIds: [], writableUserIds: ['u1'], canDispatch: false, isWardOfficer: false, wardTeamId: null,
    });
  });
});

// ── Generated organisations ────────────────────────────────────────────────────────────────────────────────────
const TEAM_IDS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5'];
const USER_IDS = ['u1', 'u2', 'u3', 'u4'];
const PERMS = ['read:Case', 'edit:Case', 'delete:Case', 'read:Petition', 'edit:Petition', 'read:Directory', 'write:User'];
const REACHES: Reach[] = ['OWN', 'TEAM', 'TEAM_TREE', 'ALL'];

const arbOrg = (allActive: boolean) =>
  fc
    .record({
      // A parent is always an earlier team: a forest, never a loop.
      parents: fc.tuple(...TEAM_IDS.map((_, i) => (i === 0 ? fc.constant(null) : fc.option(fc.integer({ min: 0, max: i - 1 }), { nil: null })))),
      active: fc.tuple(...TEAM_IDS.map(() => (allActive ? fc.constant(true) : fc.boolean()))),
      ward: fc.tuple(...TEAM_IDS.map(() => fc.boolean())),
      members: fc.tuple(...TEAM_IDS.map(() => fc.subarray(USER_IDS))),
    })
    .map(({ parents, active, ward, members }) =>
      org(
        TEAM_IDS.map((id, i) => ({ id, parentId: parents[i] === null ? null : TEAM_IDS[parents[i] as number], active: active[i], wardId: ward[i] ? `w${i}` : null })),
        Object.fromEntries(TEAM_IDS.map((id, i) => [id, members[i]])),
      ),
    );
const arbMemberships = fc.uniqueArray(fc.record({ teamId: fc.constantFrom(...TEAM_IDS), isLeader: fc.boolean() }), { selector: (m) => m.teamId, maxLength: 4 });
const arbEntries = fc.dictionary(fc.constantFrom(...PERMS), fc.constantFrom(...REACHES), { maxKeys: 6 });
const arbConfig = fc
  .record({
    member: arbEntries,
    leader: arbEntries,
    explicit: fc.subarray(TEAM_IDS),
    withLeader: fc.boolean(),
  })
  .map(({ member, leader, explicit, withLeader }) =>
    config(
      explicit.map((teamId) => ({ teamId, memberTemplateId: 'm', leaderTemplateId: withLeader ? 'l' : null })),
      [template('m', member), template('l', leader)],
    ),
  );

/** Whether scope `b` reaches at least everything `a` reaches. */
function covers(b: RecordScope, a: RecordScope): boolean {
  if (b.all) return true;
  if (a.all) return false;
  const teams = new Set([...b.exactTeamIds, ...(b.tree?.teamIds ?? [])]);
  const users = new Set(b.tree?.userIds ?? []);
  return (
    (!a.own || b.own || !!b.tree) &&
    a.exactTeamIds.every((t) => teams.has(t)) &&
    (!a.tree || (!!b.tree && a.tree.teamIds.every((t) => b.tree!.teamIds.includes(t)) && a.tree.userIds.every((x) => users.has(x)) && (!a.tree.includeUnassigned || b.tree.includeUnassigned || b.tree.teamIds.length > 0)))
  );
}

describe('properties of compile', () => {
  it('one more membership never takes a permission away and never narrows its reach (ward rule aside)', () => {
    fc.assert(
      fc.property(arbOrg(false), arbConfig, arbMemberships, fc.constantFrom(...TEAM_IDS), fc.boolean(), (o, cfg, memberships, extra, isLeader) => {
        fc.pre(!memberships.some((m) => m.teamId === extra));
        // Belonging to a ward team removes unassigned records by design; that rule is tested on its own.
        const noWard = org([...o.teams.values()].map((t) => ({ ...t, wardId: null })), Object.fromEntries(o.members));
        const before = compile(noWard, cfg, user({ memberships }), NOW);
        const after = compile(noWard, cfg, user({ memberships: [...memberships, { teamId: extra, isLeader }] }), NOW);
        // A person with no team that counts has the role as a fallback; a first real team replaces that fallback.
        fc.pre(before.activeTeamIds.length > 0);
        for (const key of before.keys) {
          expect(after.keys).toContain(key);
          for (const op of ['read', 'write'] as const) {
            expect(covers(recordScope(noWard, after, key, op), recordScope(noWard, before, key, op))).toBe(true);
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it('OWN and TEAM never reach unassigned records or other people\'s records', () => {
    fc.assert(
      fc.property(arbOrg(false), arbMemberships, fc.constantFrom<Reach>('OWN', 'TEAM'), (o, memberships, reach) => {
        const cfg = config(TEAM_IDS.map((teamId) => ({ teamId, memberTemplateId: 'm' })), [template('m', { 'read:Case': reach })]);
        const e = compile(o, cfg, user({ memberships }), NOW);
        const scope = recordScope(o, e, 'read:Case', 'read');
        if (e.activeTeamIds.length === 0) return; // falls back to the role: not this property's subject
        expect(scope).toMatchObject({ all: false, tree: null });
        if (!scope.all && reach === 'TEAM') expect(sorted(scope.exactTeamIds)).toEqual(sorted(e.activeTeamIds));
        if (!scope.all && reach === 'OWN') expect(scope.exactTeamIds).toEqual([]);
      }),
      { numRuns: 200 },
    );
  });

  it('every key has a grant, and every grant of a permission that is not about records is ALL', () => {
    fc.assert(
      fc.property(arbOrg(false), arbConfig, arbMemberships, (o, cfg, memberships) => {
        const e = compile(o, cfg, user({ memberships }), NOW);
        expect(e.keys).toEqual(sorted([...e.grants.keys()]));
        for (const [permission, grants] of e.grants) {
          expect(grants.length).toBeGreaterThan(0);
          if (!isRecordScoped(permission)) expect(grants.every((g) => g.reach === 'ALL')).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe('GOLDEN: with nothing configured, the engine answers what UnitScopeService answers today', () => {
  /** Today's resolver, fed from the same generated organisation. */
  async function today(o: OrgSnapshot, u: UserInput) {
    const prisma = {
      userTeam: {
        findMany: async () => u.memberships.map((m) => ({ teamId: m.teamId, team: { wardId: o.teams.get(m.teamId)!.wardId } })),
      },
      dataAccessGrant: {
        findMany: async () =>
          u.dataGrants
            .filter((g) => o.teams.get(g.teamId)!.active && (g.expiresAt === null || g.expiresAt > NOW))
            .map((g) => ({ teamId: g.teamId, accessLevel: g.level })),
      },
    };
    const teamRows = {
      team: {
        findMany: async ({ where }: { where: { parentId: string; isActive: boolean } }) =>
          [...o.teams.values()].filter((t) => t.parentId === where.parentId && t.active === where.isActive).map((t) => ({ id: t.id })),
      },
      userTeam: {
        findMany: async ({ where }: { where: { teamId: { in: string[] } } }) =>
          where.teamId.in.flatMap((teamId) => [...(o.members.get(teamId) ?? [])].map((userId) => ({ userId }))),
      },
    };
    // The REAL TeamsService (its depth limit included), reading the generated organisation.
    const teams = new (TeamsService as unknown as new (prisma: unknown) => TeamsService)(teamRows);
    return new UnitScopeService(prisma as never, teams as never).resolveScope(u.id, u.roleName, u.canDispatch);
  }

  it('for any organisation whose teams are all active: same teams, same people, same write reach, same ward answer', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbOrg(true),
        arbMemberships,
        fc.boolean(),
        fc.array(fc.record({ teamId: fc.constantFrom(...TEAM_IDS), level: fc.constantFrom<'READ' | 'WRITE'>('READ', 'WRITE'), expiresAt: fc.constantFrom(null, PAST, LATER) }), { maxLength: 3 }),
        async (o, memberships, canDispatch, dataGrants) => {
          const u = user({ memberships, canDispatch, dataGrants });
          const expected = await today(o, u);
          const e = compile(o, config(), u, NOW);
          const mine = toLegacyScope(e, recordScope(o, e, 'read:Case', 'read'), recordScope(o, e, 'edit:Case', 'write'));
          expect(mine).toBeDefined();
          expect(mine).not.toBeNull();
          expect({
            teamIds: sorted(mine!.teamIds), userIds: sorted(mine!.userIds), writableTeamIds: sorted(mine!.writableTeamIds),
            writableUserIds: sorted(mine!.writableUserIds), canDispatch: mine!.canDispatch, isWardOfficer: mine!.isWardOfficer, wardTeamId: mine!.wardTeamId,
          }).toEqual({
            teamIds: sorted(expected!.teamIds), userIds: sorted(expected!.userIds), writableTeamIds: sorted(expected!.writableTeamIds),
            writableUserIds: sorted(expected!.writableUserIds), canDispatch: expected!.canDispatch, isWardOfficer: expected!.isWardOfficer, wardTeamId: expected!.wardTeamId,
          });
          // And the flat permission list is the role's, as `/auth/me` gives it today.
          expect(e.keys).toEqual(sorted(OFFICER_PERMS));
        },
      ),
      { numRuns: 300 },
    );
  });

  it('a chain deeper than the limit of today stops where the resolver of today stops', async () => {
    const chain = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5'];
    const o = org(chain.map((id, i) => ({ id, parentId: i ? chain[i - 1] : null })), Object.fromEntries(chain.map((id) => [id, [`m-${id}`]])));
    const u = user({ memberships: [{ teamId: 'T0', isLeader: false }] });
    const expected = (await today(o, u))!;
    expect(sorted(expected.teamIds)).toEqual(chain.slice(0, TEAM_TREE_MAX_DEPTH + 1));
    const e = compile(o, config(), u, NOW);
    const mine = toLegacyScope(e, recordScope(o, e, 'read:Case', 'read'), recordScope(o, e, 'edit:Case', 'write'))!;
    expect(sorted(mine.teamIds)).toEqual(sorted(expected.teamIds));
    expect(sorted(mine.userIds)).toEqual(sorted(expected.userIds));
  });

  it('ADMIN is unrestricted in both', async () => {
    const o = org([{ id: 'A' }]);
    const u = user({ roleName: 'ADMIN' });
    expect(await today(o, u)).toBeNull();
    const e = compile(o, config(), u, NOW);
    expect(toLegacyScope(e, recordScope(o, e, 'read:Case', 'read'), recordScope(o, e, 'edit:Case', 'write'))).toBeNull();
  });

  it('the one intended difference: a membership of a paused team no longer widens the scope', async () => {
    const o = org([{ id: 'A', active: false }, { id: 'B' }], { A: ['u1', 'gone'], B: ['u1'] });
    const u = user({ memberships: [{ teamId: 'A', isLeader: false }, { teamId: 'B', isLeader: false }] });
    expect((await today(o, u))!.teamIds).toContain('A');
    const e = compile(o, config(), u, NOW);
    const mine = toLegacyScope(e, recordScope(o, e, 'read:Case', 'read'), recordScope(o, e, 'edit:Case', 'write'));
    expect(mine!.teamIds).toEqual(['B']);
    expect(mine!.userIds).not.toContain('gone');
  });
});

describe('entryProblems: a person must be able to see whatever they may change', () => {
  const problems = (entries: Record<string, Reach>) => entryProblems(new Map(Object.entries(entries)));

  it('accepts a set where everything stays within "view"', () => {
    expect(problems({ 'read:Case': 'TEAM', 'edit:Case': 'TEAM', 'delete:Case': 'OWN', 'read:Document': 'OWN', 'read:User': 'ALL', 'write:User': 'ALL' })).toEqual([]);
    expect(problems({})).toEqual([]);
  });

  it('refuses changing without seeing, and changing further than seeing', () => {
    expect(problems({ 'edit:Case': 'OWN' })).toEqual([{ code: 'WIDER_THAN_VIEW', permission: 'edit:Case', reach: 'OWN', view: 'read:Case', viewReach: null }]);
    expect(problems({ 'read:Petition': 'OWN', 'export_full:Petition': 'ALL' })).toEqual([
      { code: 'WIDER_THAN_VIEW', permission: 'export_full:Petition', reach: 'ALL', view: 'read:Petition', viewReach: 'OWN' },
    ]);
  });

  it('refuses a permission that does not exist and a reach the permission cannot have', () => {
    expect(problems({ 'made:Up': 'ALL' })).toEqual([{ code: 'PERMISSION_UNKNOWN', permission: 'made:Up' }]);
    expect(problems({ 'read:User': 'OWN' })).toEqual([{ code: 'REACH_NOT_ALLOWED', permission: 'read:User', reach: 'OWN' }]);
  });

  it('a resource with no "view" of its own is not held to one', () => {
    expect(problems({ 'use:OcrImport': 'ALL' })).toEqual([]);
  });
});
