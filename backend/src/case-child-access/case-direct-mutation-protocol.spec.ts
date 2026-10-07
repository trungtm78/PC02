import { ConclusionsService } from '../conclusions/conclusions.service';
import { InvestigationSupplementsService } from '../investigation-supplements/investigation-supplements.service';
import { ordinaryChildFixture } from './test-child-access-fixture';
describe.each([['conclusion',ConclusionsService],['investigationSupplement',InvestigationSupplementsService]] as const)('CG14 %s atomic ordinary child protocol', (model,Service) => {
  it('create and delete bind the authenticated actor, parent and audit transaction', async () => {
    const parent = { id: 'case',assignedTeamId: null,investigatorId: null };
    const existing = { id: 'child',caseId: 'case',case: parent,updatedAt: new Date(0) };
    const delegate = { create: jest.fn(async () => existing),findUnique: jest.fn(async () => existing),findFirst: jest.fn(async () => existing),delete: jest.fn(async () => existing),update: jest.fn(async () => existing) };
    const tx = { [model]: delegate,case: { findFirst: jest.fn(async () => parent),findUnique: jest.fn(async () => parent) } };
    const boundary = ordinaryChildFixture(tx),audit = { log: jest.fn(async (..._args:unknown[]) => undefined) };
    const service = new Service(tx as never,audit as never,boundary);
    const input = { caseId: 'case',type: 'KET_LUAN_DIEU_TRA',content: 'Synthetic',reason: 'Synthetic',decisionNumber: 'Synthetic' };
    await Reflect.apply(service.create,service,[input,'actor']);
    await service.delete('child','actor');
    expect(boundary.write).toHaveBeenCalledWith(['case'],'actor','Case','write',expect.any(Function));
    expect(boundary.write).toHaveBeenCalledWith(['case'],'actor','Case','delete',expect.any(Function));
    expect(audit.log.mock.calls).toHaveLength(2);
    expect(audit.log.mock.calls.every(call => call[1] === tx)).toBe(true);
    if (model === 'investigationSupplement') expect(delegate.delete).toHaveBeenCalledWith({ where: { id: 'child',caseId: 'case' } });
  });
});
describe('CG14 conclusion update parent consistency', () => {
  it('uses existing parent/version and current audit transaction for every supplied ordinary field', async () => {
    const parent = { id: 'case',assignedTeamId: null,investigatorId: null };
    const existing = { id: 'child',caseId: 'case',case: parent,updatedAt: new Date(0) };
    const tx = { conclusion: { findFirst: jest.fn(async () => existing),findUnique: jest.fn(async () => existing),update: jest.fn(async () => existing) } };
    const boundary=ordinaryChildFixture(tx),audit={log:jest.fn(async (..._args:unknown[])=>undefined)};
    const service=new ConclusionsService(tx as never,audit as never,boundary);
    await service.update('child',{ type:'KET_LUAN_DIEU_TRA',content:'Updated',status:'DU_THAO',approvedById:'approver',notes:'Synthetic' },'actor');
    expect(tx.conclusion.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id:'child',caseId:'case',updatedAt:existing.updatedAt } }));
    expect(audit.log.mock.calls[0]![1]).toBe(tx);
  });
});
