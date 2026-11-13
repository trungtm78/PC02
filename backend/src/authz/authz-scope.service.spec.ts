import { AuthzScopeService } from './authz-scope.service';
import { AuthzService, type AuthzMode, type AuthzSnapshot } from './authz.service';
import { enforcement, setEnforcement } from './enforcement';
import type { OrgTeam, Reach, TeamConfigInput, UserInput } from './engine/types';

const OFFICER = ['read:Case', 'edit:Case', 'read:Incident', 'edit:Incident', 'read:Petition', 'edit:Petition', 'read:Directory'];

function snapshot(mode: AuthzMode, over: { users: UserInput[]; configs?: TeamConfigInput[]; templates?: Record<string, Record<string, Reach>> }): AuthzSnapshot {
  const teams: OrgTeam[] = [
    { id: 'A', parentId: null, active: true, wardId: null },
    { id: 'A1', parentId: 'A', active: true, wardId: null },
    { id: 'W', parentId: null, active: true, wardId: 'ward-1' },
  ];
  return {
    revision: 'r1',
    mode,
    org: {
      teams: new Map(teams.map((t) => [t.id, t])),
      children: new Map([['A', ['A1']]]),
      members: new Map([['A', ['me', 'mate']], ['A1', ['junior']], ['W', ['wardy']]]),
    },
    config: {
      teamConfigs: new Map((over.configs ?? []).map((c) => [c.teamId, c])),
      templates: new Map(Object.entries(over.templates ?? {}).map(([id, entries]) => [id, { id, name: id, entries: new Map(Object.entries(entries)) }])),
    },
    users: new Map(over.users.map((u) => [u.id, u])),
    teamNames: new Map(),
    templateNames: new Map(),
  };
}
const person = (over: Partial<UserInput> = {}): UserInput => ({
  id: 'me', roleName: 'OFFICER', rolePermissions: OFFICER, canDispatch: false, memberships: [{ teamId: 'A', isLeader: false }], overrides: [], dataGrants: [], ...over,
});
/** The real AuthzService with the snapshot in memory pinned: the engine runs for real, nothing reads a database. */
function service(snap: AuthzSnapshot): AuthzScopeService {
  const authz = new AuthzService({} as never);
  jest.spyOn(authz, 'cached').mockReturnValue(snap);
  jest.spyOn(authz, 'state').mockReturnValue(snap.mode === 'ENFORCE' ? 'ENFORCE' : 'OFF');
  return new AuthzScopeService(authz);
}
const explicit = (teamId: string, memberTemplateId: string): TeamConfigInput => ({ teamId, mode: 'EXPLICIT', memberTemplateId, leaderTemplateId: null, overrides: [] });

describe('AuthzScopeService', () => {
  afterEach(() => setEnforcement(null));

  it.each(['OFF', 'SHADOW'] as AuthzMode[])('in mode %s it answers nothing: the callers resolve as before', async (mode) => {
    const s = service(snapshot(mode, { users: [person()] }));
    expect(s.scopeOf('me')).toBeUndefined();
    expect(s.keysOf('me')).toBeUndefined();
  });

  it('enforced, with nothing configured: every subject is reached "as today" (the team, the teams under it, their people, unassigned)', async () => {
    const scope = (service(snapshot('ENFORCE', { users: [person()] })).scopeOf('me'))!;
    for (const subject of ['Case', 'Incident', 'Petition'] as const) {
      for (const op of ['read', 'write'] as const) {
        const p = scope.precise!.subjects[subject][op];
        expect(p).toMatchObject({ all: false, own: false, exactTeamIds: [] });
        expect([...p.tree!.teamIds].sort()).toEqual(['A', 'A1']);
        expect([...p.tree!.userIds].sort()).toEqual(['junior', 'mate', 'me']);
        expect(p.tree!.includeUnassigned).toBe(true);
      }
    }
    expect(scope.precise!.userId).toBe('me');
    expect([...scope.teamIds].sort()).toEqual(['A', 'A1']);
    expect([...scope.writableUserIds].sort()).toEqual(['junior', 'mate', 'me']);
    expect(scope).toMatchObject({ canDispatch: false, isWardOfficer: false, wardTeamId: null });
  });

  it('enforced, with a template: each subject and each operation by its own permission', async () => {
    const snap = snapshot('ENFORCE', {
      users: [person()],
      configs: [explicit('A', 't')],
      templates: { t: { 'read:Case': 'TEAM_TREE', 'edit:Case': 'OWN', 'read:Petition': 'TEAM', 'read:Directory': 'ALL' } },
    });
    const s = service(snap);
    const scope = (s.scopeOf('me'))!;
    const { Case, Incident, Petition } = scope.precise!.subjects;
    expect(Case.read.tree!.teamIds.sort()).toEqual(['A', 'A1']);
    expect(Case.write).toEqual({ all: false, own: true, exactTeamIds: [], tree: null });
    expect(Petition.read).toEqual({ all: false, own: false, exactTeamIds: ['A'], tree: null });
    // No edit:Petition and nothing on incidents at all: nothing is reached.
    expect(Petition.write).toEqual({ all: false, own: false, exactTeamIds: [], tree: null });
    expect(Incident.read).toEqual({ all: false, own: false, exactTeamIds: [], tree: null });
    // The summary lists are measured on cases: what is written is "mine only".
    expect(scope.writableTeamIds).toEqual([]);
    expect(scope.writableUserIds).toEqual(['me']);
    expect(s.keysOf('me')).toEqual(['edit:Case', 'read:Case', 'read:Directory', 'read:Petition']);
  });

  it('enforced: "all" on a subject is said as all, and ADMIN is unrestricted (null)', async () => {
    const snap = snapshot('ENFORCE', {
      users: [person(), person({ id: 'boss', roleName: 'ADMIN', rolePermissions: ['read:Case', 'write:Role'] })],
      configs: [explicit('A', 't')],
      templates: { t: { 'read:Incident': 'ALL', 'edit:Incident': 'ALL' } },
    });
    const s = service(snap);
    expect((s.scopeOf('me'))!.precise!.subjects.Incident).toEqual({
      read: { all: true, own: false, exactTeamIds: [], tree: null },
      write: { all: true, own: false, exactTeamIds: [], tree: null },
    });
    expect(s.scopeOf('boss')).toBeNull();
    expect(s.keysOf('boss')).toEqual(['read:Case', 'write:Role']);
  });

  it('enforced: the dispatcher flag and the ward team travel with the scope; a ward officer gets no unassigned records', async () => {
    const snap = snapshot('ENFORCE', { users: [person({ id: 'wardy', canDispatch: true, memberships: [{ teamId: 'W', isLeader: false }] })] });
    const scope = (service(snap).scopeOf('wardy'))!;
    expect(scope).toMatchObject({ canDispatch: true, isWardOfficer: true, wardTeamId: 'W' });
    expect(scope.precise!.subjects.Case.read.tree).toEqual({ teamIds: ['W'], userIds: ['wardy'], includeUnassigned: false });
  });

  it('answers from memory only: no promise, no database', () => {
    const prisma = new Proxy({}, { get: () => { throw new Error('the database was touched'); } });
    const authz = new AuthzService(prisma as never);
    const s = new AuthzScopeService(authz);
    jest.spyOn(authz, 'state').mockReturnValue('OFF');
    expect(s.scopeOf('me')).toBeUndefined();
    expect(s.keysOf('me')).toBeUndefined();
    jest.spyOn(authz, 'state').mockReturnValue('ENFORCE');
    jest.spyOn(authz, 'cached').mockReturnValue(snapshot('ENFORCE', { users: [person()] }));
    expect(s.keysOf('me')).toEqual([...OFFICER].sort());
    expect(s.scopeOf('me')).not.toBeInstanceOf(Promise);
  });

  it('when it cannot be told whether anything is enforced, or the configuration is too old: refused, never "ask the role"', () => {
    const authz = new AuthzService({} as never);
    const s = new AuthzScopeService(authz);
    // Nothing was ever loaded and the mode itself is unknown.
    expect(authz.state()).toBe('UNAVAILABLE');
    expect(() => s.scopeOf('me')).toThrow(expect.objectContaining({ status: 503, response: { code: 'AUTHZ_UNAVAILABLE' } }));
    expect(() => s.keysOf('me')).toThrow(expect.objectContaining({ response: { code: 'AUTHZ_UNAVAILABLE' } }));
  });

  it('enforced: somebody the configuration does not know is not found, rather than unrestricted, and a refresh is asked for', () => {
    const authz = new AuthzService({} as never);
    jest.spyOn(authz, 'cached').mockReturnValue(snapshot('ENFORCE', { users: [person()] }));
    jest.spyOn(authz, 'state').mockReturnValue('ENFORCE');
    const refresh = jest.spyOn(authz, 'refresh').mockResolvedValue(undefined);
    const s = new AuthzScopeService(authz);
    expect(() => s.scopeOf('ghost')).toThrow(expect.objectContaining({ response: { code: 'AUTHZ_USER_NOT_FOUND' } }));
    expect(() => s.keysOf('ghost')).toThrow(expect.objectContaining({ response: { code: 'AUTHZ_USER_NOT_FOUND' } }));
    expect(refresh).toHaveBeenCalledTimes(2);
    s.keysOf('me');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('enforced: who holds a permission, for filters over many people; not enforced: no answer', () => {
    const snap = snapshot('ENFORCE', {
      users: [person(), person({ id: 'mate', rolePermissions: ['read:Directory'] }), person({ id: 'junior', memberships: [{ teamId: 'A1', isLeader: false }] })],
      configs: [explicit('A', 't')],
      templates: { t: { 'read:Case': 'OWN' } },
    });
    const s = service(snap);
    // A governs A1 too: all three are under the template, whatever their roles hold.
    expect([...s.holdersOf('read:Case')!].sort()).toEqual(['junior', 'mate', 'me']);
    expect(s.holdersOf('edit:Case')).toEqual([]);
    expect(service(snapshot('OFF', { users: [person()] })).holdersOf('read:Case')).toBeUndefined();
  });

  it('enforced: unconditional keys leave out what the role holds only under a condition; "or none" never throws for a stranger', () => {
    const s = service(snapshot('ENFORCE', { users: [person({ rolePermissions: ['read:Case', 'read:User'], conditionalRolePermissions: ['read:User'] })] }));
    expect(s.keysOf('me')).toEqual(['read:Case', 'read:User']);
    expect(s.unconditionalKeysOf('me')).toEqual(['read:Case']);
    expect(s.keysOrNone('me')).toEqual(['read:Case', 'read:User']);
    expect(s.keysOrNone('ghost')).toEqual([]);
    const off = service(snapshot('OFF', { users: [person()] }));
    expect(off.unconditionalKeysOf('me')).toBeUndefined();
    expect(off.keysOrNone('ghost')).toBeUndefined();
  });

  describe('the registry', () => {
    it('constructing or compiling is not enough: it becomes the enforcement only when its application starts', () => {
      const s = new AuthzScopeService(new AuthzService({} as never));
      expect(enforcement()).toBeNull();
      s.onApplicationBootstrap();
      expect(enforcement()).toBe(s);
      s.onModuleDestroy();
      expect(enforcement()).toBeNull();
    });

    it('a second application takes over while it runs and gives back when it closes, in either order', () => {
      const a = new AuthzScopeService(new AuthzService({} as never));
      const b = new AuthzScopeService(new AuthzService({} as never));
      const compiledOnly = new AuthzScopeService(new AuthzService({} as never));
      a.onApplicationBootstrap();
      b.onApplicationBootstrap();
      expect(enforcement()).toBe(b);
      // A module that was only compiled closes: it never registered, so it takes nothing away.
      compiledOnly.onModuleDestroy();
      expect(enforcement()).toBe(b);
      b.onModuleDestroy();
      expect(enforcement()).toBe(a);
      a.onModuleDestroy();
      expect(enforcement()).toBeNull();

      a.onApplicationBootstrap();
      b.onApplicationBootstrap();
      a.onModuleDestroy(); // the older one closes first: the newer stays
      expect(enforcement()).toBe(b);
      b.onModuleDestroy();
    });
  });
});
