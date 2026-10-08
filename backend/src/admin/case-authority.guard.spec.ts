import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { guardCaseAuthority } from './case-authority.guard';

describe('CG-RP01 current account and role authority', () => {
  const p = (subject: string, action: string) => ({ permission: { subject, action, conditions: null as unknown } });
  function fixture() {
    const users = new Map([
      ['actor', { id: 'actor', isActive: true, roleId: 'manager', caseAccessMode: 'INTERNAL', role: { name: 'ADMIN' } }],
      ['target', { id: 'target', isActive: true, roleId: 'business', caseAccessMode: 'INTERNAL', role: { name: 'BUSINESS' } }],
    ]);
    const roles = new Map([
      ['manager', [p('User', 'write'), p('CaseGovernance', 'manage_access')]],
      ['business', [p('CaseGovernance', 'review')]],
      ['ordinary', [p('Case', 'read')]],
    ]);
    const tx = {
      caseGovernanceGrant: { findFirst: jest.fn(async () => null as object | null) },
      caseRepresentationGrant: { findFirst: jest.fn(async () => null as object | null) },
      $queryRaw: jest.fn(async () => []),
      user: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null),
        findMany: jest.fn(async ({ where }: { where: { roleId: string } }) =>
          [...users.values()]
            .filter((user) => user.roleId === where.roleId)
            .map((user) => ({ id: user.id, caseAccessMode: user.caseAccessMode })),
        ),
      },
      userTeam: { findMany: jest.fn(async () => [{ userId: 'actor', teamId: 'owned', team: { wardId: null } }]), findFirst: jest.fn(async () => null as object | null) },
      team: { findMany: jest.fn(async () => [{ id: 'owned', parentId: null }]) },
      dataAccessGrant: { findMany: jest.fn(async () => []) },
      rolePermission: { findMany: jest.fn(async ({ where }: { where: { roleId: string } }) => roles.get(where.roleId) ?? []) },
    };
    return { users, roles, tx, guard: (input: Parameters<typeof guardCaseAuthority>[2], actorId = 'actor') => guardCaseAuthority(tx as never, actorId, input) };
  }

  it('accepts an explicit delegated business manager with actual User.write', async () => {
    const { guard } = fixture();
    await expect(guard({ targetUserId: 'target' })).resolves.toHaveProperty('target.id', 'target');
  });
  it('conditional governance management is not an unconditional business authority grant', async () => {
    const { guard, roles } = fixture();
    roles.get('manager')!.find(row => row.permission.subject === 'CaseGovernance')!.permission.conditions = { caseId: 'another-case' };
    await expect(guard({ targetUserId: 'target' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('finite scope manager cannot change a foreign business account', async () => {
    const { guard, users } = fixture();
    users.get('actor')!.role.name = 'OFFICER';
    await expect(guard({ targetUserId: 'target' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('finite scope manager can maintain an inactive business account in an active writable team', async () => {
    const { guard, users, tx } = fixture();
    users.get('actor')!.role.name = 'OFFICER';
    users.get('target')!.isActive = false;
    tx.userTeam.findFirst.mockResolvedValue({ userId: 'target' });
    await expect(guard({ targetUserId: 'target' })).resolves.toBeDefined();
    expect(tx.userTeam.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'target', teamId: { in: ['owned'] }, team: { isActive: true } } }));
  });
  it('finite manager cannot modify governance role policy affecting foreign-unit accounts', async () => {
    const { guard, users } = fixture();
    users.get('actor')!.role.name = 'OFFICER';
    await expect(guard({ roleId: 'business', nextPermissions: [] })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('finite manager cannot provision an unassigned business account outside their scope', async () => {
    const { guard, users } = fixture();
    users.get('actor')!.role.name = 'OFFICER';
    await expect(guard({ nextRoleId: 'business' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('representation-only manager cannot issue staff business credentials', async () => {
    const { guard, users } = fixture();
    users.get('actor')!.caseAccessMode = 'REPRESENTATION_ONLY';
    await expect(guard({ targetUserId: 'target' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['manage_access', 'write'])('rejects currently revoked %s despite cached HTTP authority', async action => {
    const { guard, roles } = fixture();
    roles.set('manager', roles.get('manager')!.filter(row => row.permission.action !== action));
    await expect(guard({ targetUserId: 'target' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('preserves ordinary account management without governance capability', async () => {
    const { guard, users, roles } = fixture();
    users.get('target')!.roleId = 'ordinary';
    roles.set('manager', [p('User', 'write')]);
    await expect(guard({ targetUserId: 'target' })).resolves.toBeDefined();
  });
  it('blocks assigning a governance role to an ordinary account', async () => {
    const { guard, users, roles } = fixture();
    users.get('target')!.roleId = 'ordinary';
    roles.set('manager', [p('User', 'write')]);
    await expect(guard({ targetUserId: 'target', nextRoleId: 'business' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('blocks removing a governance role using technical administration', async () => {
    const { guard, roles } = fixture();
    roles.set('manager', [p('User', 'write')]);
    await expect(guard({ targetUserId: 'target', nextRoleId: 'ordinary' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('blocks self acquisition through role switching even for a business manager', async () => {
    const { guard } = fixture();
    await expect(guard({ targetUserId: 'actor', nextRoleId: 'business' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('blocks self acquisition through role permission catalog changes', async () => {
    const { guard } = fixture();
    await expect(guard({ roleId: 'manager', nextPermissions: [{ subject: 'CaseGovernance', action: 'review' }] })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('allows retaining already held governance capability on self role', async () => {
    const { guard } = fixture();
    await expect(guard({ roleId: 'manager', nextPermissions: [{ subject: 'CaseGovernance', action: 'manage_access' }] })).resolves.toBeDefined();
  });
  it('blocks catalog assignment of governance capability to an ordinary role', async () => {
    const { guard, roles } = fixture();
    roles.set('manager', [p('User', 'write')]);
    await expect(guard({ roleId: 'ordinary', nextPermissions: [{ subject: 'CaseGovernance', action: 'review' }] })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('protects representation-only account credentials', async () => {
    const { guard, users, roles } = fixture();
    users.get('target')!.caseAccessMode = 'REPRESENTATION_ONLY';
    users.get('target')!.roleId = 'ordinary';
    roles.set('manager', [p('User', 'write')]);
    await expect(guard({ targetUserId: 'target' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['caseGovernanceGrant', 'caseRepresentationGrant'] as const)('protects an ordinary-role account with a live %s', async delegate => {
    const { guard, users, roles, tx } = fixture();
    users.get('target')!.roleId = 'ordinary';
    roles.set('manager', [p('User', 'write')]);
    tx[delegate].findFirst.mockResolvedValue({ id: 'current-case-grant' });
    await expect(guard({ targetUserId: 'target' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('protects every representation-only principal during an ordinary role-wide edit', async () => {
    const { guard, users, roles } = fixture();
    users.get('target')!.roleId = 'ordinary';
    users.get('target')!.caseAccessMode = 'REPRESENTATION_ONLY';
    roles.set('manager', [p('User', 'write')]);
    await expect(guard({ roleId: 'ordinary', nextPermissions: [{ subject: 'Case', action: 'read', conditions: null }] })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['caseGovernanceGrant', 'caseRepresentationGrant'] as const)('protects every principal with a live %s during a role-wide edit', async delegate => {
    const { guard, users, roles, tx } = fixture();
    users.get('target')!.roleId = 'ordinary';
    roles.set('manager', [p('User', 'write')]);
    tx[delegate].findFirst.mockResolvedValue({ id: 'current-case-grant' });
    await expect(guard({ roleId: 'ordinary', nextPermissions: [{ subject: 'Case', action: 'read', conditions: null }] })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('preserves ordinary role edits when no affected principal is protected', async () => {
    const { guard, users, roles } = fixture();
    users.get('target')!.roleId = 'ordinary';
    roles.set('manager', [p('User', 'write')]);
    await expect(guard({ roleId: 'ordinary', nextPermissions: [{ subject: 'Case', action: 'read', conditions: null }] })).resolves.toBeDefined();
  });
  it('allows a scoped business manager to edit an ordinary role when every protected principal is controlled', async () => {
    const { guard, users, tx } = fixture();
    users.get('actor')!.role.name = 'OFFICER';
    users.get('target')!.roleId = 'ordinary';
    users.get('target')!.caseAccessMode = 'REPRESENTATION_ONLY';
    tx.userTeam.findFirst.mockResolvedValue({ userId: 'target' });
    await expect(guard({ roleId: 'ordinary', nextPermissions: [{ subject: 'Case', action: 'read', conditions: null }] })).resolves.toBeDefined();
  });
  it.each(['', 'missing'])('rejects omitted or nonexistent authenticated actor %s', async actorId => {
    await expect(fixture().guard({ targetUserId: 'target' }, actorId)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('rejects a deactivated actor', async () => {
    const { guard, users } = fixture();
    users.get('actor')!.isActive = false;
    await expect(guard({ targetUserId: 'target' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('reports a nonexistent target after actor authorization', async () => {
    await expect(fixture().guard({ targetUserId: 'missing' })).rejects.toBeInstanceOf(NotFoundException);
  });
  it('locks sorted identities then all affected roles before reading permissions', async () => {
    const { guard, tx } = fixture();
    await guard({ targetUserId: 'target', nextRoleId: 'ordinary' });
    expect(tx.$queryRaw.mock.calls.map(call => call.slice(1))).toEqual([['actor'], ['target'], ['business'], ['manager'], ['ordinary']]);
    expect(tx.$queryRaw.mock.invocationCallOrder.at(-1)).toBeLessThan(tx.rolePermission.findMany.mock.invocationCallOrder[0]);
  });
});
