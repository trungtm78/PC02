import { AdminService } from './admin.service';

describe('CG-RP01 prospective business credentials', () => {
  const p = (id: string, subject: string, action: string) => ({ permissionId: id, permission: { id, subject, action, conditions: null } });
  function fixture() {
    const ordinary = p('read','Case','read'), review = p('review','CaseGovernance','review');
    const roles = new Map([['manager',[p('write','User','write'),p('manage','CaseGovernance','manage_access')]],['ordinary',[ordinary]],['business',[review]]]);
    const actor = { id: 'manager', isActive: true, roleId: 'manager', role: { name: 'ADMIN' }, caseAccessMode: 'INTERNAL' };
    const target = { id: 'target', username: 'target', email: null, updatedAt: new Date(0), roleId: 'ordinary', isActive: true, tokenVersion: 7, enrollmentTokenHash: 'technical-issued-enrollment', passwordHash: 'technical-known-password', totpSecret: 'trusted-existing-factor', totpEnabled: true };
    const tx = {
      $queryRaw: jest.fn(async () => []), $transaction: jest.fn(),
      user: { findUnique: jest.fn(async ({ where }: { where: { id: string } }) => where.id === 'manager' ? actor : target), findMany: jest.fn(async () => [target]), findFirst: jest.fn(async () => null), update: jest.fn(async (_input: { data: Record<string, unknown> }) => target), updateMany: jest.fn(async () => ({ count: 1 })) },
      role: { findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id, name: 'CUSTOM', permissions: roles.get(where.id) } )) },
      permission: { findMany: jest.fn(async () => [ordinary.permission,review.permission]) },
      rolePermission: { findMany: jest.fn(async ({ where }: { where: { roleId: string } }) => roles.get(where.roleId) ?? []), createMany: jest.fn(), deleteMany: jest.fn() },
      caseGovernanceGrant: { findFirst: jest.fn(async () => null) }, caseRepresentationGrant: { findFirst: jest.fn(async () => null) },
    };
    tx.$transaction.mockImplementation(async (fn: (db: typeof tx) => unknown) => fn(tx));
    const audit = { log: jest.fn(async () => undefined), wrapUpdate: jest.fn(async (input: { updateFn: () => unknown }) => input.updateFn()) };
    return { tx, target, service: new AdminService(tx as never,audit as never,{} as never,{} as never) };
  }
  it('trusted ordinary-to-business role promotion invalidates technical-issued enrollment and old credentials atomically', async () => {
    const { service, tx } = fixture();
    const result = await service.updateUser('target',{ roleId: 'business', workId: 'synthetic-role-promotion' },'manager');
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ enrollmentTokenHash: null, enrollmentExpiresAt: null, refreshTokenHash: null, tokenVersion: { increment: 1 }, mustChangePassword: true, passwordHash: expect.any(String) }) }));
    const data = tx.user.update.mock.calls[0]![0].data;
    expect(data.passwordHash).not.toBe('technical-known-password');
    expect(data).not.toHaveProperty('totpSecret');
    expect(data).not.toHaveProperty('totpEnabled');
    expect(result).toHaveProperty('requiresBusinessEnrollment',true);
  });
  it('adding business capability through the permission catalog invalidates credentials of every affected role account', async () => {
    const { service, tx } = fixture();
    await service.updateRolePermissions('ordinary',{ permissions: [{ action: 'read', subject: 'Case' },{ action: 'review', subject: 'CaseGovernance' }], truocKhiSua: ['read:Case'] },'manager');
    expect(tx.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { roleId: 'ordinary' }, data: expect.objectContaining({ enrollmentTokenHash: null, refreshTokenHash: null, tokenVersion: { increment: 1 }, mustChangePassword: true, passwordHash: expect.any(String) }) }));
  });
});
