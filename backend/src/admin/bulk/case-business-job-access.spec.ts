import { ForbiddenException } from '@nestjs/common';
import { BulkImportService } from './bulk-import.service';

describe('CG-RP01 bulk business enrollment credentials', () => {
  it('technical ADMIN cannot read another business manager job enrollment URLs', async () => {
    const actor = { id: 'technical', roleId: 'technical', isActive: true, role: { name: 'ADMIN', permissions: [{ permission: { subject: 'User', action: 'read', conditions: null } },{ permission: { subject: 'User', action: 'write', conditions: null } }] } };
    const target = { id: 'business', roleId: 'business', isActive: true };
    const roles = { technical: actor.role.permissions, business: [{ permission: { subject: 'CaseGovernance', action: 'review', conditions: null } }] };
    const tx = { bulkImportJob: { findUnique: jest.fn(async () => ({ id: 'job', generatedBy: 'business-manager', rowOutcomes: [{ userId: 'business', enrollmentUrl: 'http://127.0.0.1/private-business-token' }] })) }, user: { findUnique: jest.fn(async ({ where }: { where: { id: string } }) => where.id === 'technical' ? actor : target) }, rolePermission: { findMany: jest.fn(async ({ where }: { where: { roleId: keyof typeof roles } }) => roles[where.roleId]) }, caseGovernanceGrant: { findFirst: jest.fn(async () => null) }, caseRepresentationGrant: { findFirst: jest.fn(async () => null) }, $queryRaw: jest.fn(async () => []), $transaction: jest.fn() };
    tx.$transaction.mockImplementation(async (fn: (db: typeof tx) => unknown) => fn(tx));
    const service = Object.assign(Object.create(BulkImportService.prototype) as object,{ prisma: tx }) as unknown as BulkImportService;
    await expect(service.getJob('job','technical',true)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
