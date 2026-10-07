/* Partial delegate records model authority transitions; private DB suite checks the SQL oracle. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/require-await */
import { CaseGraphAccessService,withCaseGraphInputs,graphActor } from './case-graph-access.service';
const date=new Date('2026-10-01');
function fixture(){
  const record:any={id:'c',name:'public',createdAt:date,updatedAt:date,sensitivity:'NORMAL',metadata:{},deletedAt:null,caseType:'REGULAR',governanceRevision:0};
  const actor:any={id:'reader',isActive:true,role:{name:'ADMIN',permissions:[{permission:{subject:'Case',action:'read',conditions:null}}]}};
  const db:any={user:{findUnique:jest.fn(async()=>actor)},$queryRaw:jest.fn(async()=>[]),caseGovernanceGrant:{findFirst:jest.fn(async()=>null)},caseFieldDefinitionVersion:{findMany:jest.fn(async()=>[])},case:{findMany:jest.fn(async()=>[record]),findFirst:jest.fn(async()=>record),findUnique:jest.fn(async()=>record),count:jest.fn(async()=>1),aggregate:jest.fn(async()=>({_sum:{amountMoney:10}})),groupBy:jest.fn(async()=>[{status:'TAM_DINH_CHI',_count:1}])},monthlyReportPackage:{findUnique:jest.fn(async()=>null),findMany:jest.fn(async()=>[]),create:jest.fn(async({data}:any)=>data),update:jest.fn(async({data}:any)=>data)},reportTdcDraft:{findUnique:jest.fn(async()=>null),create:jest.fn(async({data}:any)=>data)},incident:{count:jest.fn(async()=>4)}};
  db.$transaction=jest.fn(async(fn:any)=>fn(db));
  return {db,actor,record,access:new CaseGraphAccessService(db),};
}
describe('Current Case graph query and cached artifact boundaries',()=>{
  it('missing request/job actor fails closed while ordinary non-Case query shape stays intact',async()=>{
    const f=fixture();await expect(f.access.wrap().case.count()).rejects.toMatchObject({status:403});
    expect(()=>f.access.run('',()=>0)).toThrow();
    expect(await f.access.wrap().incident.count({where:{status:'TIEP_NHAN'}})).toBe(4);
    expect(f.db.incident.count).toHaveBeenCalledWith({where:{status:'TIEP_NHAN'}});
  });
  it.each(['findMany','findFirst','findUnique','count','aggregate','groupBy'])('%s always attaches native/read authority before data, sum or grouping',async(operation)=>{
    const f=fixture();await f.access.run('reader',()=>f.access.wrap().case[operation]({where:{createdAt:{gte:date}},orderBy:{name:'asc'},select:{id:true,name:true}} as never));
    expect(JSON.stringify(f.db.case[operation].mock.calls[0][0].where)).toContain('sensitivity');
    expect(JSON.stringify(f.db.case[operation].mock.calls[0][0].where)).toContain('fieldDefinitionVersionId');
  });
  it('revoked role authority yields an impossible Case predicate without granting an orphan sentinel',async()=>{
    const f=fixture();f.actor.role.permissions=[];
    await f.access.run('reader',()=>f.access.wrap().case.count());
    expect(f.db.case.count.mock.calls[0][0].where).toEqual({id:{in:[]}});
  });
  it('representation mode cannot use a general export even when old role claims are ADMIN',async()=>{
    const f=fixture();f.actor.caseAccessMode='REPRESENTATION_ONLY';
    await expect(f.access.run('reader',()=>f.access.wrap().case.count(), 'export')).rejects.toMatchObject({status:403});
    expect(f.db.case.count).not.toHaveBeenCalled();
  });
  it('unpublished/unknown snapshot provenance is unavailable rather than falsely active or missing; non-Case appendix survives',async()=>{
    const f=fixture();const snapshot={appendices:[{code:'PL01',rows:[{id:'incident'}]},{code:'PL04',rows:[{id:'private-case'}]}]};
    f.db.monthlyReportPackage.findUnique=jest.fn(async()=>({id:'package',snapshot,summary:{detailRowCount:2}}));
    const result:any=await f.access.run('reader',()=>f.access.wrap().monthlyReportPackage.findUnique({where:{id:'package'}}));
    expect(result.caseAuthorization).toBe('UNAVAILABLE');expect(result.snapshot.appendices[0].rows).toEqual([{id:'incident'}]);
    expect(result.snapshot.appendices[1].caseAuthorization).toBe('UNAVAILABLE');expect(result.snapshot.appendices[1].rows).toEqual([]);
    await expect(f.access.run('reader',()=>f.access.wrap().monthlyReportPackage.findUnique({where:{id:'package'}}),'export')).rejects.toMatchObject({status:403});
  });
  it('selected summary still checks server snapshot source identities before exposing aggregate hints',async()=>{
    const f=fixture();let first=true;f.db.monthlyReportPackage.findUnique=jest.fn(async()=>first?(first=false,{id:'package',summary:{detailRowCount:9}}):{snapshot:{appendices:[{code:'PL04',rows:[{id:'x'}]}]}});
    const result:any=await f.access.run('reader',()=>f.access.wrap().monthlyReportPackage.findUnique({where:{id:'package'},select:{id:true,summary:true}}));
    expect(result.summary).toEqual({caseAuthorization:'UNAVAILABLE'});
  });
  it('server-owned provenance is pinned on create and carried after current authorized read/update',async()=>{
    const f=fixture();const snapshot={appendices:[{code:'PL04',rows:[]}],_caseGovernance:{ids:['c'],keys:['name']}};
    f.db.monthlyReportPackage.findUnique=jest.fn(async()=>({id:'package',snapshot}));
    const result:any=await f.access.run('reader',async()=>{
      await f.access.wrap().monthlyReportPackage.findUnique({where:{id:'package'}});
      return f.access.wrap().monthlyReportPackage.update({where:{id:'package'},data:{snapshot:{appendices:[]}} as never});
    });
    expect(result.snapshot._caseGovernance.ids).toEqual(['c']);expect(result.snapshot._caseGovernance.keys).toContain('name');
  });
  it('transactions retain actor and policy, and raw wrapped clients do not recursively wrap authorization lookups',async()=>{
    const f=fixture();const wrapped=f.access.wrap();const nested=new CaseGraphAccessService(wrapped);
    expect(await nested.run('reader',()=>wrapped.$transaction(async tx=>tx.case.count()))).toBe(1);
  });
  it('native formula inputs stay isolated across simultaneous actor contexts',async()=>{
    const f=fixture();const values=await Promise.all(['one','two'].map(actor=>f.access.run(actor,()=>withCaseGraphInputs([actor],async()=>{await Promise.resolve();return graphActor.getStore()?.required;}))));
    expect(values).toEqual([['one'],['two']]);expect(withCaseGraphInputs(['no-context'],()=>7)).toBe(7);
  });
  it('physical Evidence role denial marks information unavailable before monthly formula hydration',async()=>{
    const f=fixture();f.db.case.findMany=jest.fn(async()=>[f.record]);
    const result:any=await f.access.run('reader',()=>f.access.wrap().case.findMany({include:{evidences:true}}));
    expect(f.db.case.findMany.mock.calls[0][0].include).not.toHaveProperty('evidences');expect(result[0].evidenceAuthorization).toBe('UNAVAILABLE');
  });
});
