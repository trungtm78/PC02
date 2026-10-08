import { CaseOutboxWorker } from './case-outbox.worker';
import { ForbiddenException } from '@nestjs/common';
describe('CG16 internal transactional outbox', () => {
  function make(allowed = true) {
    const row = {
      id: 'out',
      caseId: 'case',
      recipientId: 'recipient',
      operationId: 'op',
      status: 'PROCESSING',
      leaseToken: 'token',
      leaseUntil: new Date('2026-10-07'),
      attempts: 1,
    };
    const tx = {
      caseGovernanceOutbox: {
        findFirst: jest.fn().mockResolvedValue(row),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      notification: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'notice', userId: 'recipient' }),
      },
    };
    const db = { ...tx, $transaction: jest.fn((f) => f(tx)) };
    const core = {
      assertCaseReadable: allowed
        ? jest.fn().mockResolvedValue({ id: 'case' })
        : jest.fn().mockRejectedValue(new ForbiddenException()),
    };
    return { svc: new CaseOutboxWorker(db as never, core as never), tx, core,row,db };
  }
  it('delivers a current receiving inbox handoff without inventing ordinary sender-team Case scope',async()=>{
    const {svc,tx,row}=make(false);
    Object.assign(row,{event:{type:'HANDOFF_SENT',handoffId:'handoff'}});
    Object.assign(tx,{
      user:{findUnique:jest.fn().mockResolvedValue({id:'recipient',isActive:true,caseAccessMode:'INTERNAL',role:{name:'OFFICER',permissions:[{permission:{subject:'Case',action:'read',conditions:null}}]}})},
      caseHandoff:{findMany:jest.fn().mockResolvedValue([{id:'handoff',caseId:'case',state:'PENDING',case:{id:'case',sensitivity:'NORMAL',metadata:null}}])},
    });
    await expect(svc.deliver('out','token',new Date('2026-10-06'))).resolves.toBe(true);
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({link:'/cases/handoffs/inbox'})}));
  });
  it('exact approved packet recipient proof enables a packet pointer without broad Case view',async()=>{
    const {svc,tx,row}=make(false);
    Object.assign(row,{event:{operation:'EVIDENCE_PACKET_REVIEW',aggregateId:'packet'}});
    Object.assign(svc,{evidence:{assertPacketNotificationRecipient:jest.fn().mockResolvedValue({caseId:'case',packetId:'packet',revision:1,approvedHash:'hash'})}});
    await expect(svc.deliver('out','token',new Date('2026-10-06'))).resolves.toBe(true);
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({link:'/cases/case/disclosures/packet'})}));
  });
  it('creates internal notification and delivered marker in same transaction after current recipient authorization', async () => {
    const { svc, tx, core } = make();
    await expect(
      svc.deliver('out', 'token', new Date('2026-10-06')),
    ).resolves.toBe(true);
    expect(core.assertCaseReadable).toHaveBeenCalledWith(
      expect.anything(),
      'case',
      { actorId: 'recipient' },
    );
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'recipient',
          type: 'SYSTEM',
          link: '/cases/case',
          pushNextRetryAt: null,
        }),
      }),
    );
    expect(tx.caseGovernanceOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ leaseToken: 'token' }),
        data: expect.objectContaining({ status: 'DELIVERED' }),
      }),
    );
  });
  it('suppresses delivery after recipient scope revoked', async () => {
    const { svc, tx } = make(false);
    await expect(
      svc.deliver('out', 'token', new Date('2026-10-06')),
    ).resolves.toBe(false);
    expect(tx.notification.create).not.toHaveBeenCalled();
    expect(tx.caseGovernanceOutbox.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUPPRESSED' }),
      }),
    );
  });
  it('expired or mismatched lease cannot deliver', async () => {
    const { svc, tx } = make();
    tx.caseGovernanceOutbox.findFirst.mockResolvedValue(null as never);
    await expect(
      svc.deliver('out', 'wrong', new Date('2026-10-06')),
    ).resolves.toBe(false);
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
});
