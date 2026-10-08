import { DynamicExportService } from './dynamic-export.service';
describe('Dynamic Case export current authority',()=>{
  it('representation-only current mode cannot allocate/render general Case templates',async()=>{
    const findMany=jest.fn().mockResolvedValue([]);
    const db={documentTemplate:{findMany},user:{findUnique:jest.fn().mockResolvedValue({id:'actor',isActive:true,caseAccessMode:'REPRESENTATION_ONLY',role:{name:'ADMIN',permissions:[]}})}};
    const service=new DynamicExportService(db as never,{} as never,{} as never);
    await expect(service.exportEntityDocuments('VU_AN','case',{} as never,['template'],'merged','actor',{},{} as never)).rejects.toMatchObject({status:403});
    expect(findMany).not.toHaveBeenCalled();
  });
});
