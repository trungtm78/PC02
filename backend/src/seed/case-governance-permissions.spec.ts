import { seedQuyen } from '../../prisma/seed-quyen';
import { SEED_PERMISSIONS } from '../../prisma/seed-permissions';

describe('CG-R01 governance capability registration', () => {
  it('registers every capability without converting technical administration into authority', () => {
    expect(SEED_PERMISSIONS.filter(p => p.subject === 'CaseGovernance').map(p => p.action).sort())
      .toEqual(['custody', 'dispose', 'download', 'manage_access', 'operate', 'publish', 'read', 'read_sensitive', 'review', 'share']);
  });
  it('ordinary reseed preserves explicit grants and never creates governance grants', async () => {
    const permissions = [
      { id: 'normal', subject: 'Case', action: 'read' },
      { id: 'review', subject: 'CaseGovernance', action: 'review' },
      { id: 'dispose', subject: 'CaseGovernance', action: 'dispose' },
    ];
    const grants = new Set(['admin:review']);
    const db = {
      permission: {
        findUnique: async () => ({ id: 'exists' }), upsert: async () => ({}),
        findMany: async (args: any) => permissions.filter(p => !args.where?.subject?.not || p.subject !== args.where.subject.not),
      },
      role: { findUnique: async () => ({ id: 'admin' }) },
      rolePermission: {
        findUnique: async ({ where }: any) => grants.has(`${where.roleId_permissionId.roleId}:${where.roleId_permissionId.permissionId}`) ? {} : null,
        create: async ({ data }: any) => { grants.add(`${data.roleId}:${data.permissionId}`); return {}; },
      },
    };
    await seedQuyen(db as never);
    await seedQuyen(db as never);
    expect([...grants].sort()).toEqual(['admin:normal', 'admin:review']);
  });
});
