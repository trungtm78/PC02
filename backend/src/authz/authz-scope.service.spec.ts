import { AuthzScopeService } from './authz-scope.service';
import { AuthzService, type AuthzMode, type AuthzSnapshot } from './authz.service';
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
/** The real AuthzService with its snapshot pinned: the engine runs for real, nothing is read from a database. */
function service(snap: AuthzSnapshot): AuthzScopeService {
  const authz = new AuthzService({} as never);
  jest.spyOn(authz, 'snapshot').mockResolvedValue(snap);
  jest.spyOn(authz, 'currentMode').mockResolvedValue(snap.mode);
  return new AuthzScopeService(authz);
}
const explicit = (teamId: string, memberTemplateId: string): TeamConfigInput => ({ teamId, mode: 'EXPLICIT', memberTemplateId, leaderTemplateId: null, overrides: [] });

describe('AuthzScopeService', () => {
  it.each(['OFF', 'SHADOW'] as AuthzMode[])('in mode %s it answers nothing: the callers resolve as before', async (mode) => {
    const s = service(snapshot(mode, { users: [person()] }));
    expect(await s.forUser('me')).toBeUndefined();
    expect(await s.keysFor('me')).toBeUndefined();
  });

  it('enforced, with nothing configured: every subject is reached "as today" (the team, the teams under it, their people, unassigned)', async () => {
    const scope = (await service(snapshot('ENFORCE', { users: [person()] })).forUser('me'))!;
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
    const scope = (await s.forUser('me'))!;
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
    expect(await s.keysFor('me')).toEqual(['edit:Case', 'read:Case', 'read:Directory', 'read:Petition']);
  });

  it('enforced: "all" on a subject is said as all, and ADMIN is unrestricted (null)', async () => {
    const snap = snapshot('ENFORCE', {
      users: [person(), person({ id: 'boss', roleName: 'ADMIN', rolePermissions: ['read:Case', 'write:Role'] })],
      configs: [explicit('A', 't')],
      templates: { t: { 'read:Incident': 'ALL', 'edit:Incident': 'ALL' } },
    });
    const s = service(snap);
    expect((await s.forUser('me'))!.precise!.subjects.Incident).toEqual({
      read: { all: true, own: false, exactTeamIds: [], tree: null },
      write: { all: true, own: false, exactTeamIds: [], tree: null },
    });
    expect(await s.forUser('boss')).toBeNull();
    expect(await s.keysFor('boss')).toEqual(['read:Case', 'write:Role']);
  });

  it('enforced: the dispatcher flag and the ward team travel with the scope; a ward officer gets no unassigned records', async () => {
    const snap = snapshot('ENFORCE', { users: [person({ id: 'wardy', canDispatch: true, memberships: [{ teamId: 'W', isLeader: false }] })] });
    const scope = (await service(snap).forUser('wardy'))!;
    expect(scope).toMatchObject({ canDispatch: true, isWardOfficer: true, wardTeamId: 'W' });
    expect(scope.precise!.subjects.Case.read.tree).toEqual({ teamIds: ['W'], userIds: ['wardy'], includeUnassigned: false });
  });

  it('while not enforced the permission configuration is not read at all (a request must not depend on it)', async () => {
    const authz = new AuthzService({} as never);
    jest.spyOn(authz, 'currentMode').mockResolvedValue('OFF');
    const read = jest.spyOn(authz, 'snapshot');
    const s = new AuthzScopeService(authz);
    expect(await s.forUser('me')).toBeUndefined();
    expect(await s.keysFor('me')).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });

  it('enforced: somebody the configuration does not know is not found, rather than unrestricted', async () => {
    const s = service(snapshot('ENFORCE', { users: [person()] }));
    await expect(s.forUser('ghost')).rejects.toMatchObject({ response: { code: 'AUTHZ_USER_NOT_FOUND' } });
    await expect(s.keysFor('ghost')).rejects.toMatchObject({ response: { code: 'AUTHZ_USER_NOT_FOUND' } });
  });
});
