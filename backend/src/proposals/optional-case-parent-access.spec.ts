import { ForbiddenException } from '@nestjs/common';
import { ProposalsService } from './proposals.service';
import { DelegationsService } from '../delegations/delegations.service';
import { ordinaryChildFixture } from '../case-child-access/test-child-access-fixture';
describe.each([['proposal',ProposalsService],['delegation',DelegationsService]] as const)('CG14 optional %s Case parent', (model,Service) => {
  it('linked restricted Case requires current view even with null cached scope', async () => {
    const row = { id: 'child', relatedCaseId: 'restricted', relatedCase: { id: 'restricted' } };
    const childAccess = { entity: jest.fn(async () => undefined), scope: jest.fn(async () => null), read: jest.fn(async () => { throw new ForbiddenException('Current Case view required'); }), serialize: jest.fn(async (_id: string,value: unknown) => value) };
    const service = Object.assign(Object.create(Service.prototype) as object,{ prisma: { [model]: { findFirst: jest.fn(async () => row) } },childAccess }) as unknown as ProposalsService | DelegationsService;
    await expect(Reflect.apply(service.getById,service,['child',null,'actor'])).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('keeps number, linked-parent mutation and audit in one transaction while serializing the returned parent', async () => {
    const parent={ id:'case',name:'PRIVATE_CASE_NAME',assignedTeamId:null,investigatorId:null };
    const row={ id:'child',relatedCaseId:'case',relatedCase:parent,updatedAt:new Date(0),createdById:'actor',proposalNumber:'P-1',delegationNumber:'D-1',status:'PENDING' };
    const tx={ [model]:{ create:jest.fn(async()=>row),findFirst:jest.fn(async()=>row),update:jest.fn(async()=>row) },case:{findFirst:jest.fn(async()=>parent)},documentNumberLog:{update:jest.fn()},user:{findUnique:jest.fn(async()=>({firstName:'Actor',lastName:'Synthetic'}))} };
    const childAccess=ordinaryChildFixture(tx);
    childAccess.serialize.mockImplementation(async (_id:string,value:typeof row)=>({...value,relatedCase:{id:'case'}}));
    const audit={log:jest.fn(async(..._args:unknown[])=>undefined)},docNums={commitWithTx:jest.fn(async()=>({number:'N-1',logId:'log'}))};
    const eventEmitter={emit:jest.fn()};
    const service=Object.assign(Object.create(Service.prototype) as object,{prisma:tx,childAccess,audit,docNums,eventEmitter}) as unknown as ProposalsService | DelegationsService;
    const result=await Reflect.apply(service.create,service,[{relatedCaseId:'case',content:'Synthetic authorized content',receivingUnit:'Unit',...(model==='delegation'?{assignedToId:'recipient'}:{})},'actor']);
    expect(result.data.relatedCase).not.toHaveProperty('name');
    expect(docNums.commitWithTx).toHaveBeenCalledWith(model==='proposal'?'PROPOSAL':'DELEGATION',{userId:'actor'},tx);
    await Reflect.apply(service.update,service,['child',{content:'Updated',status:'PENDING',notes:'Synthetic',...(model==='delegation'?{assignedToId:'recipient2'}:{})},'actor']);
    await service.delete('child','actor');
    expect(audit.log.mock.calls).toHaveLength(3);
    expect(audit.log.mock.calls.every(call=>call[1]===tx)).toBe(true);
    expect(tx[model].update).toHaveBeenLastCalledWith(expect.objectContaining({where:{id:'child',relatedCaseId:'case',updatedAt:row.updatedAt}}));
    if(model==='delegation') expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
  });
});

describe('CG14 delegation assignment notifications commit boundary', () => {
  it('does not publish a notification when final parent CAS rolls back creation', async () => {
    const emit = jest.fn();
    const tx = { delegation: { create: jest.fn(async () => ({ id: 'child',delegationNumber: 'UT-1' })) },user: { findUnique: jest.fn(async () => ({ firstName: 'Actor' })) } };
    const childAccess = { scope: jest.fn(async () => null),write: jest.fn(async (_ids, _actor, _subject, _action, handler) => { await handler(tx); throw new Error('Parent CAS failed'); }) };
    const service = Object.assign(Object.create(DelegationsService.prototype) as object,{ prisma: tx,childAccess,audit: { log: jest.fn() },eventEmitter: { emit } }) as unknown as DelegationsService;
    await expect(service.create({ delegationNumber: 'UT-1',assignedToId: 'recipient',receivingUnit: 'Unit',content: 'Authorized ordinary assignment' },'actor')).rejects.toThrow('Parent CAS failed');
    expect(emit).not.toHaveBeenCalled();
  });
});
