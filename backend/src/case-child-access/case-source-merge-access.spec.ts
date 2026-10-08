import { ConflictException } from '@nestjs/common';
import { IncidentsService } from '../incidents/incidents.service';
describe('CG14 source merge preservation adapter', () => {
  it('does not relink documents or petitions when the current Case provenance guard denies merge', async () => {
    const source = { id: 'source',code: 'SRC',status: 'DANG_XAC_MINH',intakeStage: 'DA_NHAN' };
    const tx = { incident: { findFirst: jest.fn(async ({where}: {where:{id:string}}) => where.id === 'source' ? source : { ...source,id: 'target',code: 'DST' }),update: jest.fn() },petition: { updateMany: jest.fn() },document: { updateMany: jest.fn() },incidentStatusHistory: { create: jest.fn() },$queryRaw: jest.fn() };
    const prisma = { $transaction: jest.fn(async handler => handler(tx)) };
    const caseBoundary = { sourceMerge: jest.fn(async () => { throw new ConflictException('Preserved Case source'); }) };
    const service = Object.assign(Object.create(IncidentsService.prototype) as object,{ prisma,caseBoundary,audit: { log: jest.fn() } }) as unknown as IncidentsService;
    await expect(service.mergeInto('source',{ targetId: 'target' },'actor',undefined,null)).rejects.toMatchObject({ status: 409 });
    expect(tx.document.updateMany).not.toHaveBeenCalled();
    expect(tx.petition.updateMany).not.toHaveBeenCalled();
  });
});
