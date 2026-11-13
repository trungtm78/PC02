import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AuthService } from '../auth/auth.service';
import { UnitScopeService, type DataScope } from '../auth/services/unit-scope.service';
import { CaseGovernanceService } from '../cases/governance/case-governance.service';
import { SettingsService } from '../settings/settings.service';
import type { AuthzScopeService } from './authz-scope.service';
import { AuthzService, MODE_TTL_MS } from './authz.service';

/**
 * The four places that ask "permissions by team" first, and fall back to the role when it does not answer.
 * `undefined` from AuthzScopeService = not enforced: every one of them must then do exactly what it did before.
 */
const ENFORCED_SCOPE = { teamIds: [], userIds: ['u1'], writableTeamIds: [], writableUserIds: ['u1'], precise: { userId: 'u1' } } as unknown as DataScope;
/** An instance with only the fields a method under test touches (no key files, no modules). */
function bare<T extends object>(type: { prototype: T }, fields: Record<string, unknown>): T {
  return Object.assign(Object.create(type.prototype) as object, fields) as T;
}
const authzScope = (scope: DataScope | null | undefined, keys?: readonly string[]) =>
  ({ forUser: jest.fn().mockResolvedValue(scope), keysFor: jest.fn().mockResolvedValue(keys) }) as unknown as AuthzScopeService & {
    forUser: jest.Mock;
    keysFor: jest.Mock;
  };

describe('AuthzService.currentMode: what every request asks first', () => {
  const service = (findUnique: jest.Mock) => new AuthzService({ systemSetting: { findUnique } } as never);

  it('reads one row, remembers it for a few seconds, then reads again', async () => {
    const findUnique = jest.fn().mockResolvedValue({ value: 'ENFORCE' });
    const s = service(findUnique);
    expect(await s.currentMode(1_000)).toBe('ENFORCE');
    expect(await s.currentMode(1_000 + MODE_TTL_MS - 1)).toBe('ENFORCE');
    expect(findUnique).toHaveBeenCalledTimes(1);
    findUnique.mockResolvedValue({ value: 'OFF' });
    expect(await s.currentMode(1_000 + MODE_TTL_MS)).toBe('OFF');
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it.each([null, { value: '' }, { value: 'enforce' }, { value: 'ON' }])('no row or a word that is not one of the three (%j) is OFF', async (row) => {
    expect(await service(jest.fn().mockResolvedValue(row)).currentMode()).toBe('OFF');
  });

  it('when the setting cannot be read: OFF if nothing was known, else the mode last known', async () => {
    expect(await service(jest.fn().mockRejectedValue(new Error('down'))).currentMode()).toBe('OFF');
    const findUnique = jest.fn().mockResolvedValueOnce({ value: 'ENFORCE' }).mockRejectedValue(new Error('down'));
    const s = service(findUnique);
    expect(await s.currentMode(0)).toBe('ENFORCE');
    // A database hiccup must not silently drop enforcement.
    expect(await s.currentMode(MODE_TTL_MS + 1)).toBe('ENFORCE');
  });
});

describe('the request scope (UnitScopeService)', () => {
  const prisma = { userTeam: { findMany: jest.fn().mockResolvedValue([]) }, dataAccessGrant: { findMany: jest.fn().mockResolvedValue([]) } };
  const teams = { getDescendantIds: jest.fn().mockResolvedValue([]), getUserIdsForTeams: jest.fn().mockResolvedValue([]) };

  it('not enforced: resolved from the role and the teams exactly as before', async () => {
    const authz = authzScope(undefined);
    const withAuthz = await new UnitScopeService(prisma as never, teams as never, authz).resolveScope('u1', 'OFFICER', true);
    const without = await new UnitScopeService(prisma as never, teams as never).resolveScope('u1', 'OFFICER', true);
    expect(withAuthz).toEqual(without);
    expect(withAuthz).toMatchObject({ userIds: ['u1'], canDispatch: true });
    expect(withAuthz).not.toHaveProperty('precise');
    expect(await new UnitScopeService(prisma as never, teams as never, authz).resolveScope('boss', 'ADMIN')).toBeNull();
    expect(authz.forUser).toHaveBeenCalledWith('u1');
  });

  it('enforced: what permissions by team say, also for somebody whose ROLE is ADMIN in the token but not in the configuration', async () => {
    expect(await new UnitScopeService(prisma as never, teams as never, authzScope(ENFORCED_SCOPE)).resolveScope('u1', 'OFFICER')).toBe(ENFORCED_SCOPE);
    expect(await new UnitScopeService(prisma as never, teams as never, authzScope(ENFORCED_SCOPE)).resolveScope('u1', 'ADMIN')).toBe(ENFORCED_SCOPE);
    expect(await new UnitScopeService(prisma as never, teams as never, authzScope(null)).resolveScope('boss', 'ADMIN')).toBeNull();
  });
});

describe('the scope of case governance and every child-record service (CaseGovernanceService.currentScope)', () => {
  const tx = {
    userTeam: { findMany: jest.fn().mockResolvedValue([]) },
    team: { findMany: jest.fn().mockResolvedValue([]) },
    dataAccessGrant: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const actor = (role: string) => ({ id: 'u1', canDispatch: false, role: { name: role, permissions: [] } }) as never;

  it('not enforced: its own resolution, exactly as before', async () => {
    const withAuthz = await new CaseGovernanceService({} as never, authzScope(undefined)).currentScope(tx as never, actor('OFFICER'));
    const without = await new CaseGovernanceService({} as never).currentScope(tx as never, actor('OFFICER'));
    expect(withAuthz).toEqual(without);
    expect(withAuthz).toMatchObject({ teamIds: [], userIds: ['u1'] });
    expect(await new CaseGovernanceService({} as never, authzScope(undefined)).currentScope(tx as never, actor('ADMIN'))).toBeNull();
  });

  it('enforced: the same scope the request gets (one person, one scope)', async () => {
    const authz = authzScope(ENFORCED_SCOPE);
    expect(await new CaseGovernanceService({} as never, authz).currentScope(tx as never, actor('OFFICER'))).toBe(ENFORCED_SCOPE);
    expect(authz.forUser).toHaveBeenCalledWith('u1');
    expect(await new CaseGovernanceService({} as never, authzScope(null)).currentScope(tx as never, actor('ADMIN'))).toBeNull();
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

  it('not enforced: the role decides, read as before', async () => {
    const prisma = prismaWith([{ action: 'edit', subject: 'Case' }]);
    await expect(new PermissionsGuard(reflector, prisma as never, authzScope(undefined)).canActivate(context)).resolves.toBe(true);
    expect(prisma.rolePermission.findMany).toHaveBeenCalledWith({ where: { roleId: 'role-1' }, include: { permission: true } });
    await expect(new PermissionsGuard(reflector, prismaWith([]) as never, authzScope(undefined)).canActivate(context)).rejects.toThrow('Insufficient permissions');
  });

  it('enforced: what the person holds under permissions by team decides, and the role is not read', async () => {
    const roleHasIt = prismaWith([{ action: 'edit', subject: 'Case' }]);
    await expect(new PermissionsGuard(reflector, roleHasIt as never, authzScope(null, ['read:Case'])).canActivate(context)).rejects.toThrow('Insufficient permissions');
    expect(roleHasIt.rolePermission.findMany).not.toHaveBeenCalled();
    const roleLacksIt = prismaWith([]);
    await expect(new PermissionsGuard(reflector, roleLacksIt as never, authzScope(null, ['read:Case', 'edit:Case'])).canActivate(context)).resolves.toBe(true);
    // Holding nothing at all is still an answer (an empty list), not "ask the role".
    await expect(new PermissionsGuard(reflector, roleHasIt as never, authzScope(null, [])).canActivate(context)).rejects.toThrow('Insufficient permissions');
  });

  it('a permission key with a colon in its subject is split at the first colon only', async () => {
    const odd = { getAllAndOverride: jest.fn((key: string) => (key === PERMISSIONS_KEY ? [{ action: 'read', subject: 'A:B' }] : undefined)) } as unknown as Reflector;
    await expect(new PermissionsGuard(odd, prismaWith([]) as never, authzScope(null, ['read:A:B'])).canActivate(context)).resolves.toBe(true);
  });
});

describe('/auth/me (AuthService.getProfile)', () => {
  const user = {
    id: 'u1', email: 'a@b', username: 'a', firstName: 'A', lastName: 'B', isActive: true, canDispatch: false,
    role: { name: 'OFFICER', permissions: [{ permission: { action: 'read', subject: 'Case' } }, { permission: { action: 'delete', subject: 'Case' } }] },
    userTeams: [],
  };
  const service = (authz?: AuthzScopeService) =>
    bare(AuthService, { prisma: { user: { findUnique: jest.fn().mockResolvedValue(user) } }, authzScope: authz });

  it('not enforced: the role\'s permissions, as before', async () => {
    expect((await service(authzScope(undefined)).getProfile('u1')).permissions).toEqual(['read:Case', 'delete:Case']);
    expect((await service().getProfile('u1')).permissions).toEqual(['read:Case', 'delete:Case']);
  });

  it('enforced: what the person holds, so the screen hides what the server would refuse', async () => {
    expect((await service(authzScope(null, ['read:Case'])).getProfile('u1')).permissions).toEqual(['read:Case']);
    expect((await service(authzScope(null, [])).getProfile('u1')).permissions).toEqual([]);
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
