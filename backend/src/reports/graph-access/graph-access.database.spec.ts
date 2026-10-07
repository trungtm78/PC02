import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { CaseGraphAccessService } from './case-graph-access.service';
import { CalendarService } from '../../calendar/calendar.service';
import { KpiService } from '../../kpi/kpi.service';
import { CaseNotificationPolicyService } from '../../notifications/case-notification-policy.service';
import { ActionPlansService } from '../../shared/action-plans/action-plans.service';
import { CaseGovernanceService } from '../../cases/governance/case-governance.service';
import { CaseOutboxWorker } from '../../cases/governance/case-outbox.worker';
import { configurationHash } from '../../cases/governance/case-configuration.service';
import { PrismaService } from '../../prisma/prisma.service';
const address=process.env.CASE_GOVERNANCE_UAT_DATABASE_URL;
const run=address?describe:describe.skip;
run('Graph current private PostgreSQL authorization',()=>{
  let db:PrismaClient,access:CaseGraphAccessService,actor:string,recipient:string,representation:string,normal:string,privateDate:string,sensitive:string,team:string,receiverTeam:string,prefix:string;
  beforeAll(async()=>{
    const url=new URL(address!);if(url.hostname!=='127.0.0.1'||url.port!=='55441'||url.pathname!=='/pc02_case_governance_uat')throw new Error('Private graph database target rejected');
    db=new PrismaClient({adapter:new PrismaPg({connectionString:address!})});access=new CaseGraphAccessService(db as unknown as PrismaService);
    prefix='graph-'+randomUUID();const role=await db.role.create({data:{name:prefix}});
    for(const [subject,action]of [['Case','read'],['Case','write'],['Case','edit'],['Calendar','read'],['Report','read']]){
      const permission=await db.permission.upsert({where:{action_subject:{subject,action}},create:{subject,action},update:{}});
      await db.rolePermission.create({data:{roleId:role.id,permissionId:permission.id}});
    }
    actor=(await db.user.create({data:{username:prefix,passwordHash:'synthetic-not-a-login',roleId:role.id}})).id;
    recipient=(await db.user.create({data:{username:prefix+'-recipient',passwordHash:'synthetic-not-a-login',roleId:role.id}})).id;
    representation=(await db.user.create({data:{username:prefix+'-representative',passwordHash:'synthetic-not-a-login',roleId:role.id,caseAccessMode:'REPRESENTATION_ONLY'}})).id;
    team=(await db.team.create({data:{code:prefix,name:prefix}})).id;receiverTeam=(await db.team.create({data:{code:prefix+'-to',name:prefix+'-to'}})).id;
    await db.userTeam.createMany({data:[{userId:actor,teamId:team},{userId:representation,teamId:team},{userId:recipient,teamId:receiverTeam}]});
    const definition={fields:[],fieldPolicies:[{key:'caseType',sensitivity:'RESTRICTED'},{key:'deadline',sensitivity:'RESTRICTED'}]};
    const schema=await db.caseFieldDefinitionVersion.create({data:{code:prefix,definition,contentHash:configurationHash(definition),authorId:actor,status:'PUBLISHED',publishedAt:new Date()}});
    const create=(name:string,extra:Prisma.CaseUncheckedCreateInput|Record<string,unknown>={})=>db.case.create({data:{...(extra as Record<string, unknown>),name:prefix+'-'+name,caseProvenance:'DIRECT_DISCOVERY',assignedTeamId:team,investigatorId:actor,deadline:new Date('2026-10-20'),createdAt:new Date('2026-10-01')} as Prisma.CaseUncheckedCreateInput});
    normal=(await create('normal')).id;privateDate=(await create('private-date',{fieldDefinitionVersionId:schema.id})).id;sensitive=(await create('sensitive',{sensitivity:'RESTRICTED'})).id;
    await db.incident.create({data:{code:prefix,name:prefix+'-incident',assignedTeamId:team,deadline:new Date('2026-10-20')}});
    const lawyer=await db.lawyer.create({data:{caseId:normal,fullName:'Synthetic graph lawyer',barNumber:prefix}});
    await db.caseRepresentationGrant.create({data:{caseId:normal,lawyerId:lawyer.id,granteeId:representation,createdById:actor,startsAt:new Date('2000-01-01'),expiresAt:new Date('2099-01-01'),capabilities:['list']}});
  },30000);
  afterAll(async()=>{await db?.$disconnect();});
  it('calendar excludes private deadlines/classified Cases and retains ordinary Incident output',async()=>{
    const service=new CalendarService(access.wrap(),{expandOccurrences:()=>[]} as never);
    const result=await access.run(actor,()=>service.getEvents(2026,10));
    expect(result.data.some(row=>row.caseId===normal)).toBe(true);
    expect(result.data.some(row=>row.caseId===privateDate||row.caseId===sensitive)).toBe(false);
    expect(result.data.some(row=>row.title.includes(prefix+'-incident'))).toBe(true);
  });
  it('Case KPI aggregates use readable native formula inputs before counting',async()=>{
    const result=await access.run(actor,()=>new KpiService(access.wrap()).calculateKpi3({year:2026,teamId:team}));
    expect(result.denominator).toBe(1);
  });
  it('list-only representation grants do not expose calendars or Case statistics',async()=>{
    const result=await access.run(representation,()=>new CalendarService(access.wrap(),{expandOccurrences:()=>[]} as never).getEvents(2026,10));
    expect(result.data.some(row=>row.caseId)).toBe(false);
    expect((await access.run(representation,()=>new KpiService(access.wrap()).calculateKpi3({year:2026,teamId:team}))).denominator).toBe(0);
  });
  it('current exact sensitive grant restores legitimate private-date count/calendar without widening another classified Case',async()=>{
    await db.caseGovernanceGrant.create({data:{caseId:privateDate,granteeId:actor,createdById:actor,startsAt:new Date('2000-01-01'),capabilities:['read_sensitive']}});
    const result=await access.run(actor,()=>new CalendarService(access.wrap(),{expandOccurrences:()=>[]} as never).getEvents(2026,10));
    expect(result.data.some(row=>row.caseId===privateDate)).toBe(true);expect(result.data.some(row=>row.caseId===sensitive)).toBe(false);
    expect((await access.run(actor,()=>new KpiService(access.wrap()).calculateKpi3({year:2026,teamId:team}))).denominator).toBe(2);
  });
  it('notification predicates and payloads reauthorize recipient; stale raw text never escapes',async()=>{
    const notices=await Promise.all([normal,sensitive].map(caseId=>db.notification.create({data:{userId:actor,type:'CASE_ASSIGNED',title:'OLD RAW PRIVATE',message:'OLD RAW PRIVATE',link:'/cases/'+caseId,metadata:{caseId}}})));
    const policy=new CaseNotificationPolicyService(db as unknown as PrismaService);
    expect(await db.notification.count({where:await policy.where(actor)})).toBe(1);
    const allowed=await policy.serialize(actor,notices[0]);expect(allowed?.message).not.toContain('OLD RAW PRIVATE');
    expect(await policy.serialize(actor,notices[1])).toBeNull();
  });
  it('failed Case plan audit rolls back child creation and parent CAS',async()=>{
    const parent=await db.case.findUniqueOrThrow({where:{id:normal}});
    const service=new ActionPlansService(db as unknown as PrismaService);
    await expect(service.createForCase(sensitive,{ngayLap:'2026-10-06',bienPhap:'synthetic'} as never,actor,null)).rejects.toMatchObject({status:403});
    expect(await db.suspensionActionPlan.count({where:{caseId:sensitive}})).toBe(0);
    const result=await service.createForCase(normal,{ngayLap:'2026-10-06',bienPhap:'synthetic'} as never,actor,null);
    expect(result.caseId).toBe(normal);
    expect((await db.case.findUniqueOrThrow({where:{id:normal}})).governanceRevision).toBe(parent.governanceRevision+1);
    expect(await db.auditLog.count({where:{subjectId:normal,action:'CASE_ACTION_PLAN_CREATED'}})).toBe(1);
  });
  it('current receiver inbox authority delivers handoff notice while ordinary sender-scope view remains denied',async()=>{
    const record=await db.case.create({data:{name:prefix+'-receipt',caseProvenance:'DIRECT_DISCOVERY',assignedTeamId:team,investigatorId:actor,intakeStage:'CHO_NHAN'}});
    const handoff=await db.caseHandoff.create({data:{caseId:record.id,fromTeamId:team,toTeamId:receiverTeam,sentById:actor,recipientId:recipient,state:'PENDING'}});
    const operation=await db.caseGovernanceOperation.create({data:{actorId:actor,caseId:record.id,operation:'HANDOFF_SEND',requestKey:prefix,contentHash:'synthetic'}});
    const outbox=await db.caseGovernanceOutbox.create({data:{caseId:record.id,operationId:operation.id,recipientId:recipient,event:{type:'HANDOFF_SENT',handoffId:handoff.id},status:'PROCESSING',leaseToken:prefix,leaseUntil:new Date(Date.now()+60000)}});
    const core=new CaseGovernanceService(db as unknown as PrismaService);
    await expect(core.assertCaseReadable(db as unknown as Prisma.TransactionClient,record.id,{actorId:recipient})).rejects.toMatchObject({status:403});
    expect(await new CaseOutboxWorker(db as unknown as PrismaService,core).deliver(outbox.id,prefix)).toBe(true);
    const notice=await db.notification.findUniqueOrThrow({where:{id:'case-governance-'+outbox.id}});
    expect(notice.link).toBe('/cases/handoffs/inbox');
    expect((await new CaseNotificationPolicyService(db as unknown as PrismaService).serialize(recipient,notice))?.link).toBe('/cases/handoffs/inbox');
  });
});
