export function ordinaryCaseActorFixture(id='actor-1'){
  return {id,isActive:true,canDispatch:true,role:{name:'ADMIN',permissions:['read','write','edit','restore'].map(action=>({permission:{subject:'Case',action,conditions:null}}))}};
}
export function ordinaryCaseAuthorityFixture(){
  return {user:{findUnique:jest.fn().mockResolvedValue(ordinaryCaseActorFixture())},$queryRaw:jest.fn().mockResolvedValue([]),featureFlag:{findUnique:jest.fn().mockResolvedValue({enabled:false})},caseHandoff:{findFirst:jest.fn().mockResolvedValue(null)},caseFieldDefinitionVersion:{findUnique:jest.fn().mockResolvedValue(null),findFirst:jest.fn().mockResolvedValue(null),findMany:jest.fn().mockResolvedValue([])},caseGovernanceGrant:{findFirst:jest.fn().mockResolvedValue(null)}};
}
export function ordinaryCaseParentFixture(){
  return jest.fn(async({where}:{where:{id:string}})=>({id:where.id,deletedAt:null,sensitivity:'NORMAL',metadata:null,assignedTeamId:null,investigatorId:null,intakeStage:null,governanceRevision:0,updatedAt:new Date('2026-10-06')}));
}
