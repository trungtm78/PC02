import { ForbiddenException } from '@nestjs/common';
import { SubjectsBulkService } from './subjects.bulk.service';
import { LawyersBulkService } from '../../lawyers/bulk/lawyers.bulk.service';

describe.each([['subjects',SubjectsBulkService,'subject'],['lawyers',LawyersBulkService,'lawyer']] as const)('CG14 child bulk current Case authority %s', (_name,Service,model) => {
  it('null cached scope cannot bypass current inaccessible parent preflight', async () => {
    const tx = { [model]: { findMany: jest.fn(async () => [{ id: 'child' }]), update: jest.fn(async () => ({ id: 'child' })) }, $transaction: jest.fn() };
    tx.$transaction.mockImplementation(async (fn: (db: typeof tx) => unknown) => fn(tx));
    const audit = { logBulkHeader: jest.fn(async () => ({ bulkOperationId: 'bulk' })), logBulkItem: jest.fn(), completeBulk: jest.fn() };
    const childAccess = { entity: jest.fn(async () => undefined), scope: jest.fn(async () => null), listWhere: jest.fn(async () => { throw new ForbiddenException('Current Case parent inaccessible'); }) };
    const service = Object.assign(Object.create(Service.prototype) as object,{ prisma: tx,audit,childAccess }) as unknown as SubjectsBulkService | LawyersBulkService;
    await expect(service.bulkDelete({ ids: ['child'], actorId: 'actor', reason: 'Synthetic child bulk delete', dataScope: null })).rejects.toBeInstanceOf(ForbiddenException);
    const delegate = tx[model] as unknown as { update: jest.Mock };
    expect(delegate.update).not.toHaveBeenCalled();
  });
});
