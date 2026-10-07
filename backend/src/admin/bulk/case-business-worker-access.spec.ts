import { AdminService } from '../admin.service';
import { BulkImportProcessor } from './bulk-import.processor';
describe('CG-RP01 delayed business account import worker',()=>{
  it('rechecks actual role authority inside the worker transaction and returns no enrollment URL on denial',async()=>{
    const actor={id:'technical',roleId:'technical',isActive:true};
    const roles={technical:[{permission:{subject:'User',action:'write',conditions:null}}],business:[{permission:{subject:'CaseGovernance',action:'review',conditions:null}}]};
    const tx={user:{findUnique:jest.fn(async()=>actor),create:jest.fn()},rolePermission:{findMany:jest.fn(async({where}:{where:{roleId:keyof typeof roles}})=>roles[where.roleId])},$queryRaw:jest.fn(),bulkImportJob:{update:jest.fn(async(..._args:unknown[])=>({id:'job'}))},$transaction:jest.fn()};
    tx.$transaction.mockImplementation(async handler=>handler(tx));
    const audit={log:jest.fn()},enrollment={generateEnrollmentLink:jest.fn()};
    const admin=new AdminService(tx as never,audit as never,{} as never,{} as never);
    const worker=new BulkImportProcessor(tx as never,audit as never,admin,enrollment as never,{} as never);
    Object.assign(worker,{logger:{error:jest.fn()}});
    const processJob=Reflect.get(worker,'processJob') as (...args:unknown[])=>Promise<void>;
    await processJob.call(worker,'job',[{rowIndex:1,username:'synthetic_user',workId:'277-794',roleId:'business',errors:[]}],'technical','C:/nonexistent-case-worker-fixture.csv','csv',false);
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(enrollment.generateEnrollmentLink).not.toHaveBeenCalled();
    expect(tx.$transaction).toHaveBeenCalledWith(expect.any(Function),{isolationLevel:'Serializable'});
    const completed=tx.bulkImportJob.update.mock.calls.at(-1)![0] as {data:{rowOutcomes:{error:string;enrollmentUrl?:string}[];errorRows:number}};
    expect(completed.data.errorRows).toBe(1);
    expect(completed.data.rowOutcomes[0]!.error).toContain('User.write and CaseGovernance.manage_access');
    expect(completed.data.rowOutcomes[0]).not.toHaveProperty('enrollmentUrl');
  });
});
