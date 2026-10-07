import { ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';

describe('CG-RP01 business account security boundary', () => {
  function fixture() {
    const permissions = {
      technical: [{ permission: { action: 'write', subject: 'User' } }],
      business: [{ permission: { action: 'review', subject: 'CaseGovernance' } }],
    };
    const actor = { id: 'technical', roleId: 'technical', isActive: true, role: { name: 'ADMIN',permissions: permissions.technical } };
    const target = { id: 'business', roleId: 'business', username: 'business', isActive: true, updatedAt: new Date(0) };
    const tx = {
      caseGovernanceGrant: { findFirst: jest.fn(async () => null) },
      caseRepresentationGrant: { findFirst: jest.fn(async () => null) },
      team: { findUnique: jest.fn(async () => ({ id: 'team' })) },
      userTeam: { findMany: jest.fn(async () => []),findFirst: jest.fn(async () => null) },
      dataAccessGrant: { findUnique: jest.fn(async () => ({ id: 'grant',granteeId: 'business',teamId: 'team',grantedById: 'technical' })),upsert: jest.fn(async () => ({ id: 'grant' })),delete: jest.fn(async () => ({ id: 'grant' })) },
      user: { findUnique: jest.fn(async ({ where }: { where: { id: string } }) => where.id === actor.id ? actor : target), update: jest.fn(async () => target), updateMany: jest.fn(async () => ({ count: 1 })), delete: jest.fn(async () => target) },
      role: { findUnique: jest.fn(async ({ where }: { where: { id: keyof typeof permissions } }) => ({ id: where.id, permissions: permissions[where.id] })) },
      rolePermission: { findMany: jest.fn(async ({ where }: { where: { roleId: keyof typeof permissions } }) => permissions[where.roleId]) },
      $queryRaw: jest.fn(async () => []),
      $transaction: jest.fn(),
    };
    tx.$transaction.mockImplementation(async (fn: (db: typeof tx) => Promise<unknown>) => fn(tx));
    const audit = { log: jest.fn(async () => undefined) };
    const service = new AdminService(tx as never, audit as never, {} as never, {} as never);
    return { tx, audit, service };
  }

  it('technical ADMIN cannot reset a business authority account 2FA', async () => {
    const { service, tx, audit } = fixture();
    await expect(service.adminResetTwoFa('business', 'technical')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('technical ADMIN cannot unlock a business authority account', async () => {
    const { service, tx, audit } = fixture();
    await expect(service.moKhoaTaiKhoan('business', 'technical')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('technical ADMIN cannot delete a business authority account', async () => {
    const { service, tx } = fixture();
    await expect(service.deleteUser('business', 'technical')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.delete).not.toHaveBeenCalled();
  });
  it('technical ADMIN cannot acquire Case scope through a business principal data grant', async () => {
    const { service,tx } = fixture();
    await expect(service.createDataAccessGrant({ granteeId: 'business',teamId: 'team',accessLevel: 'WRITE' },'technical')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.dataAccessGrant.upsert).not.toHaveBeenCalled();
  });
  it('technical grant issuer cannot revoke a current business principal Case scope', async () => {
    const { service,tx } = fixture();
    await expect(service.revokeDataAccessGrant('grant','technical')).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.dataAccessGrant.delete).not.toHaveBeenCalled();
  });
});
