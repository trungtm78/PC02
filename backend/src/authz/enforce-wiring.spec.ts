// AuthService pulls in the 2FA chain (otplib, qrcode: ESM only). The mock shapes MUST be exactly those of
// `app.bootstrap.spec.ts` / `two-fa.service.spec.ts`: suites share a worker's module registry, and a different shape
// here would leak into the 2FA suite and fail it.
jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  generateURI: jest
    .fn()
    .mockReturnValue('otpauth://totp/PC02:user@test.com?secret=JBSWY3DPEHPK3PXP&issuer=PC02'),
  verify: jest.fn().mockResolvedValue({ valid: true }),
  generate: jest.fn().mockResolvedValue('123456'),
}));
jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,fake') }));

import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AuthService } from '../auth/auth.service';
import { UnitScopeService, type DataScope } from '../auth/services/unit-scope.service';
import { CaseGovernanceService } from '../cases/governance/case-governance.service';
import { SettingsService } from '../settings/settings.service';
import { AuthzService, REFRESH_EVERY_MS } from './authz.service';
import { enforcement, setEnforcement, type Enforcement } from './enforcement';

/**
 * The places that ask "permissions by team" first, and fall back to the role when it does not answer.
 * No enforcement registered, or one that answers `undefined` (not enforced): each must do exactly what it did
 * before, which is asserted against EXPLICIT expected values, not against the same code run twice.
 */
const ENFORCED_SCOPE = { teamIds: [], userIds: ['u1'], writableTeamIds: [], writableUserIds: ['u1'], precise: { userId: 'u1' } } as unknown as DataScope;
function enforce(scope: DataScope | null | undefined, keys?: readonly string[]) {
  const e = { scopeOf: jest.fn().mockReturnValue(scope), keysOf: jest.fn().mockReturnValue(keys) };
  setEnforcement(e as Enforcement);
  return e;
}
/** An instance with only the fields a method under test touches (no key files, no modules). */
function bare<T extends object>(type: { prototype: T }, fields: Record<string, unknown>): T {
  return Object.assign(Object.create(type.prototype) as object, fields) as T;
}
const sorted = (xs: readonly string[]) => [...xs].sort();

afterEach(() => setEnforcement(null));

describe('the registry', () => {
  it('is empty until something registers, and what registers is what everybody gets', () => {
    expect(enforcement()).toBeNull();
    const e = enforce(undefined);
    expect(enforcement()).toBe(e);
  });
});

describe('AuthzService keeps the configuration in memory, outside the request path', () => {
  it('nothing is in memory before the first load, and reading memory never touches the database', () => {
    const prisma = new Proxy({}, { get: () => { throw new Error('the database was touched'); } });
    expect(new AuthzService(prisma as never).cached()).toBeNull();
  });

  it('loads before the application takes requests, then refreshes on a timer that does not keep the process alive', async () => {
    jest.useFakeTimers();
    try {
      const service = new AuthzService({} as never);
      const snapshot = jest.spyOn(service, 'snapshot').mockResolvedValue({} as never);
      await service.onApplicationBootstrap();
      expect(snapshot).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(REFRESH_EVERY_MS * 2);
      expect(snapshot).toHaveBeenCalledTimes(3);
      service.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(REFRESH_EVERY_MS * 3);
      expect(snapshot).toHaveBeenCalledTimes(3);
    } finally {
      jest.useRealTimers();
    }
  });

  it('a refresh that fails is logged and keeps what is in memory: it never throws into a timer or the start-up', async () => {
    const service = new AuthzService({} as never);
    jest.spyOn(service, 'snapshot').mockRejectedValue(new Error('database down'));
    const logged = jest.spyOn((service as unknown as { logger: { error: (m: string) => void } }).logger, 'error').mockImplementation(() => undefined);
    await expect(service.refresh()).resolves.toBeUndefined();
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    service.onModuleDestroy();
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('database down'));
  });
});

describe('the request scope (UnitScopeService)', () => {
  // A = my team, A1 under it; G = read grant, W = write grant.
  const prisma = {
    userTeam: { findMany: jest.fn().mockResolvedValue([{ teamId: 'A', team: { wardId: null } }]) },
    dataAccessGrant: { findMany: jest.fn().mockResolvedValue([{ teamId: 'G', accessLevel: 'READ' }, { teamId: 'W', accessLevel: 'WRITE' }]) },
  };
  const members: Record<string, string[]> = { A: ['u1', 'mate'], A1: ['junior'], G: ['guest'], W: ['writer'] };
  const teams = {
    getDescendantIds: jest.fn().mockImplementation(async (id: string) => (id === 'A' ? ['A1'] : [])),
    getUserIdsForTeams: jest.fn().mockImplementation(async (ids: string[]) => [...new Set(ids.flatMap((id) => members[id] ?? []))]),
  };
  const resolve = (role = 'OFFICER', dispatch = false) => new UnitScopeService(prisma as never, teams as never).resolveScope('u1', role, dispatch);
  const LEGACY = {
    teamIds: ['A', 'A1', 'G', 'W'], userIds: ['guest', 'junior', 'mate', 'u1', 'writer'],
    writableTeamIds: ['A', 'A1', 'W'], writableUserIds: ['junior', 'mate', 'u1', 'writer'],
  };
  const shape = (s: DataScope | null) => s && {
    teamIds: sorted(s.teamIds), userIds: sorted(s.userIds), writableTeamIds: sorted(s.writableTeamIds), writableUserIds: sorted(s.writableUserIds),
  };

  it('nothing registered: the team, the teams under it, read and write grants, their people — as before', async () => {
    const scope = await resolve('OFFICER', true);
    expect(shape(scope)).toEqual(LEGACY);
    expect(scope).toMatchObject({ canDispatch: true, isWardOfficer: false, wardTeamId: null });
    expect(scope).not.toHaveProperty('precise');
    expect(await resolve('ADMIN')).toBeNull();
  });

  it('registered but not enforced (it answers undefined): the very same result', async () => {
    const e = enforce(undefined);
    expect(shape(await resolve())).toEqual(LEGACY);
    expect(await resolve('ADMIN')).toBeNull();
    expect(e.scopeOf).toHaveBeenCalledWith('u1');
  });

  it('enforced: what permissions by team say, also when the token says ADMIN but the configuration does not', async () => {
    enforce(ENFORCED_SCOPE);
    expect(await resolve('OFFICER')).toBe(ENFORCED_SCOPE);
    expect(await resolve('ADMIN')).toBe(ENFORCED_SCOPE);
    enforce(null);
    expect(await resolve('ADMIN')).toBeNull();
  });
});

describe('the scope of case governance and every child-record service (CaseGovernanceService.currentScope)', () => {
  const tx = {
    userTeam: {
      findMany: jest.fn().mockImplementation(async ({ where }: { where: { userId?: string; teamId?: { in: string[] } } }) =>
        where.userId
          ? [{ teamId: 'A', team: { wardId: null } }]
          : [['A', 'u1'], ['A', 'mate'], ['A1', 'junior'], ['G', 'guest'], ['W', 'writer']]
              .filter(([team]) => where.teamId!.in.includes(team))
              .map(([teamId, userId]) => ({ teamId, userId })),
      ),
    },
    team: { findMany: jest.fn().mockResolvedValue([{ id: 'A', parentId: null }, { id: 'A1', parentId: 'A' }, { id: 'G', parentId: null }, { id: 'W', parentId: null }]) },
    dataAccessGrant: { findMany: jest.fn().mockResolvedValue([{ teamId: 'G', accessLevel: 'READ' }, { teamId: 'W', accessLevel: 'WRITE' }]) },
  };
  const actor = (role: string) => ({ id: 'u1', canDispatch: false, role: { name: role, permissions: [] } }) as never;
  // Built by hand, as more than twenty places in the source do: no constructor argument could reach it.
  const current = (role = 'OFFICER') => new CaseGovernanceService({} as never).currentScope(tx as never, actor(role));

  it('nothing registered, or not enforced: its own resolution, as before', async () => {
    for (const setup of [() => undefined, () => enforce(undefined)]) {
      setup();
      const scope = (await current())!;
      expect(sorted(scope.teamIds)).toEqual(['A', 'A1', 'G', 'W']);
      expect(sorted(scope.writableTeamIds)).toEqual(['A', 'A1', 'W']);
      expect(sorted(scope.userIds)).toEqual(['guest', 'junior', 'mate', 'u1', 'writer']);
      expect(sorted(scope.writableUserIds)).toEqual(['junior', 'mate', 'u1', 'writer']);
      expect(scope).not.toHaveProperty('precise');
      expect(await current('ADMIN')).toBeNull();
    }
  });

  it('enforced: a hand-built instance gets the same scope the request gets (one person, one scope), without a query', async () => {
    const e = enforce(ENFORCED_SCOPE);
    tx.userTeam.findMany.mockClear();
    expect(await current()).toBe(ENFORCED_SCOPE);
    expect(e.scopeOf).toHaveBeenCalledWith('u1');
    expect(tx.userTeam.findMany).not.toHaveBeenCalled();
    enforce(null);
    expect(await current('ADMIN')).toBeNull();
  });

  it('its capability checks use what the person holds when enforced, the role otherwise', async () => {
    const roleHolds = { id: 'u1', isActive: true, role: { name: 'OFFICER', permissions: [{ permission: { subject: 'CaseGovernance', action: 'read_sensitive', conditions: null } }] } };
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(roleHolds) } };
    const has = (action: string) => new CaseGovernanceService(prisma as never).hasCapability(prisma as never, 'u1', action);
    expect(await has('read_sensitive')).toBe(true);
    expect(await has('dispose')).toBe(false);
    enforce(undefined);
    expect(await has('read_sensitive')).toBe(true);
    // Muted under permissions by team: the role still has it, the person does not.
    enforce(null, ['read:Case']);
    expect(await has('read_sensitive')).toBe(false);
    // Given by a team though the role lacks it.
    enforce(null, ['dispose:CaseGovernance']);
    expect(await has('dispose')).toBe(true);
  });
});

describe('the route guard (PermissionsGuard)', () => {
  const context = {
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1', roleId: 'role-1' } }) }),
  } as unknown as ExecutionContext;
  const reflector = {
    getAllAndOverride: jest.fn((key: string) => (key === PERMISSIONS_KEY ? [{ action: 'edit', subject: 'Case' }] : undefined)),
  } as unknown as Reflector;
  const prismaWith = (granted: { action: string; subject: string }[]) => ({
    rolePermission: { findMany: jest.fn().mockResolvedValue(granted.map((permission) => ({ permission }))) },
  });
  const guard = (prisma: unknown, r: Reflector = reflector) => new PermissionsGuard(r, prisma as never);

  it('nothing registered, or not enforced: the role decides, read as before', async () => {
    for (const setup of [() => undefined, () => enforce(undefined)]) {
      setup();
      const prisma = prismaWith([{ action: 'edit', subject: 'Case' }]);
      await expect(guard(prisma).canActivate(context)).resolves.toBe(true);
      expect(prisma.rolePermission.findMany).toHaveBeenCalledWith({ where: { roleId: 'role-1' }, include: { permission: true } });
      await expect(guard(prismaWith([])).canActivate(context)).rejects.toThrow('Insufficient permissions');
    }
  });

  it('enforced: what the person holds decides, and the role is not read', async () => {
    const roleHasIt = prismaWith([{ action: 'edit', subject: 'Case' }]);
    enforce(null, ['read:Case']);
    await expect(guard(roleHasIt).canActivate(context)).rejects.toThrow('Insufficient permissions');
    expect(roleHasIt.rolePermission.findMany).not.toHaveBeenCalled();
    enforce(null, ['read:Case', 'edit:Case']);
    await expect(guard(prismaWith([])).canActivate(context)).resolves.toBe(true);
    // Holding nothing at all is still an answer (an empty list), not "ask the role".
    enforce(null, []);
    await expect(guard(roleHasIt).canActivate(context)).rejects.toThrow('Insufficient permissions');
  });

  it('a permission key with a colon in its subject is split at the first colon only', async () => {
    const odd = { getAllAndOverride: jest.fn((key: string) => (key === PERMISSIONS_KEY ? [{ action: 'read', subject: 'A:B' }] : undefined)) } as unknown as Reflector;
    enforce(null, ['read:A:B']);
    await expect(guard(prismaWith([]), odd).canActivate(context)).resolves.toBe(true);
  });
});

describe('/auth/me (AuthService.getProfile)', () => {
  const user = {
    id: 'u1', email: 'a@b', username: 'a', firstName: 'A', lastName: 'B', isActive: true, canDispatch: false,
    role: { name: 'OFFICER', permissions: [{ permission: { action: 'read', subject: 'Case' } }, { permission: { action: 'delete', subject: 'Case' } }] },
    userTeams: [],
  };
  const profile = () => bare(AuthService, { prisma: { user: { findUnique: jest.fn().mockResolvedValue(user) } } }).getProfile('u1');

  it('nothing registered, or not enforced: the permissions of the role, as before', async () => {
    expect((await profile()).permissions).toEqual(['read:Case', 'delete:Case']);
    enforce(undefined);
    expect((await profile()).permissions).toEqual(['read:Case', 'delete:Case']);
  });

  it('enforced: what the person holds, so the screen hides what the server would refuse', async () => {
    enforce(null, ['read:Case']);
    expect((await profile()).permissions).toEqual(['read:Case']);
    enforce(null, []);
    expect((await profile()).permissions).toEqual([]);
  });
});

describe('the mode cannot be switched on from the generic settings form', () => {
  const settings = () => {
    const update = jest.fn();
    const service = bare(SettingsService, {
      prisma: { systemSetting: { findUnique: jest.fn().mockResolvedValue({ key: 'QUYEN_THEO_TO_CHE_DO', value: 'OFF', unit: null }), update } },
      cache: new Map(),
      cacheTimestamp: 0,
      audit: { log: jest.fn() },
    });
    return { service, update };
  };

  it.each(['ENFORCE', 'enforce', 'ON', ''])('refuses %j and writes nothing', async (value) => {
    const { service, update } = settings();
    await expect(service.updateValue('QUYEN_THEO_TO_CHE_DO', value)).resolves.toMatchObject({ success: false });
    expect(update).not.toHaveBeenCalled();
  });

  it.each(['OFF', 'SHADOW'])('accepts %s', async (value) => {
    const { service, update } = settings();
    update.mockResolvedValue({ key: 'QUYEN_THEO_TO_CHE_DO', value });
    await expect(service.updateValue('QUYEN_THEO_TO_CHE_DO', value)).resolves.toMatchObject({ success: true });
    expect(update).toHaveBeenCalledWith({ where: { key: 'QUYEN_THEO_TO_CHE_DO' }, data: { value } });
  });
});
