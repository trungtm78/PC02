const fs=require('node:fs'),crypto=require('node:crypto');
const {PrismaClient}=require('../../backend/node_modules/@prisma/client');
const {PrismaPg}=require('../../backend/node_modules/@prisma/adapter-pg');
const password=fs.readFileSync('C:/Users/THANMI~1/AppData/Local/Temp/pc02-incident-uat-e0028f5b5f8c421388a6ca3fc5d1e90e/password.txt','utf8').trim();
const db=new PrismaClient({adapter:new PrismaPg({connectionString:'postgresql://pc02_uat:'+encodeURIComponent(password)+'@127.0.0.1:55441/pc02_case_governance_uat'})});
(async()=>{const rows=await db.caseFieldDefinitionVersion.findMany({where:{code:{startsWith:'graph-'}},include:{author:{select:{username:true}}}});let repaired=0;
for(const row of rows){if(row.code!==row.author.username||!row.definition.fieldPolicies?.some(p=>p.key==='createdAt'))continue;
 const definition={fields:[],fieldPolicies:[{key:'caseType',sensitivity:'RESTRICTED'},{key:'deadline',sensitivity:'RESTRICTED'}]};
 // A new immutable version corrects ONLY this writer's invalid synthetic fixture;
 // retain the invalid predecessor and repin only its synthetic Cases.
 const version=await db.caseFieldDefinitionVersion.create({data:{code:row.code+'-corrected',authorId:row.authorId,status:'PUBLISHED',publishedAt:new Date(),definition,contentHash:crypto.createHash('sha256').update(JSON.stringify(definition)).digest('hex')}});
 repaired+=(await db.case.updateMany({where:{fieldDefinitionVersionId:row.id,investigatorId:row.authorId,name:{startsWith:row.code+'-'}},data:{fieldDefinitionVersionId:version.id}})).count;
}console.log(JSON.stringify({ownSyntheticCasesRepinned:repaired,noPublishedVersionRewritten:true}));})().finally(()=>db.$disconnect());
