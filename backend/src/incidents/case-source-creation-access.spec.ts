import { ForbiddenException } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { PetitionsService } from '../petitions/petitions.service';

describe('CG14 explicit source Case creation authority', () => {
  const actorId = 'source-only-actor';
  const source = { id: 'source', status: 'DANG_XAC_MINH', linkedCaseId: null, linkedIncidentId: null, deletedAt: null, updatedAt: new Date(0) };
  function fixture<T extends typeof IncidentsService | typeof PetitionsService>(Service: T) {
    const tx = { case: { create: jest.fn(async () => ({ id: 'created-case', name: 'created', caseCode: 'CASE-1' })) }, incident: { update: jest.fn(async () => ({})) }, petition: { update: jest.fn(async () => ({})) }, document: { updateMany: jest.fn(async () => ({ count: 0 })) }, incidentStatusHistory: { create: jest.fn(async () => ({})) }, documentNumberLog: { update: jest.fn(async () => ({})) } };
    const prisma = { incident: { findFirst: jest.fn(async () => source) }, petition: { findFirst: jest.fn(async () => source) }, $transaction: jest.fn(async (fn: (db: typeof tx) => unknown) => fn(tx)) };
    const caseCreation = { execute: jest.fn(async () => { throw new ForbiddenException('Current Case.write required'); }) };
    const service = Object.assign(Object.create(Service.prototype) as object,{ prisma, caseCreation, checkWriteScope: jest.fn(), checkReceivedForBusiness: jest.fn(), docNums: { commitWithTx: jest.fn(async () => ({ number: 'CASE-1', logId: 'number-log' })) }, audit: { log: jest.fn() }, eventEmitter: { emit: jest.fn() } }) as unknown as InstanceType<T>;
    return { service, tx, prisma };
  }
  it('Incident.edit alone cannot create a Case or consume a Case number', async () => {
    const { service, tx } = fixture(IncidentsService);
    await expect(service.prosecute('source',{ caseName: 'created', prosecutionDecision: 'QD-1', prosecutionDate: '2026-10-01', expectedUpdatedAt: source.updatedAt.toISOString() },actorId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.case.create).not.toHaveBeenCalled();
  });
  it('Petition.edit alone cannot create a Case or move its Documents', async () => {
    const { service, tx } = fixture(PetitionsService);
    await expect(service.convertToCase('source',{ caseName: 'created', crime: 'synthetic-crime', jurisdiction: 'synthetic-unit', expectedUpdatedAt: source.updatedAt.toISOString() },actorId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.case.create).not.toHaveBeenCalled();
    expect(tx.document.updateMany).not.toHaveBeenCalled();
  });
});
