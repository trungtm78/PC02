import { ActionPlansService } from './action-plans.service';
describe('Case action-plan current authority', () => {
  it('null supplied scope cannot grant access to a classified Case', async () => {
    const parent = { id: 'c', assignedTeamId: null, investigatorId: null, sensitivity: 'RESTRICTED' };
    const create = jest.fn().mockResolvedValue({ id: 'plan' });
    const service = new ActionPlansService({
      user:{findUnique:jest.fn().mockResolvedValue({id:'actor',isActive:true,role:{name:'ADMIN',permissions:['read','edit','write'].map(action=>({permission:{subject:'Case',action,conditions:null}}))}})},
      caseGovernanceGrant:{findFirst:jest.fn().mockResolvedValue(null)},
      case: { findUnique: jest.fn().mockResolvedValue(parent),findFirst:jest.fn().mockResolvedValue(parent) }, suspensionActionPlan: { create } } as never);
    await expect(service.createForCase('c', { ngayLap: '2026-10-06', bienPhap: 'synthetic' } as never, 'actor', null)).rejects.toMatchObject({ status: 403 });
    expect(create).not.toHaveBeenCalled();
  });
});
