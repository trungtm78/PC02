const fs=require('node:fs'),crypto=require('node:crypto');
const {Client}=require('../../backend/node_modules/pg');
const assert=require('node:assert/strict');
async function main(){
 const url=new URL(process.env.DATABASE_URL||'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55441');assert.equal(url.pathname,'/pc02_case_governance_uat');
 const db=new Client({connectionString:url.toString()});await db.connect();
 try{
  const latest=process.argv[2]==='--verify-latest';
  const additive=latest||process.argv[2]==='--verify-additive';
  const migrations=(await db.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations')).rows;assert.equal(migrations.length,latest?133:additive?129:128);
  const baseline=new URL(url);baseline.pathname='/pc02_incident_release_uat';const old=new Client({connectionString:baseline.toString()});await old.connect();try{for(const row of (await old.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')).rows)assert.equal(migrations.find(x=>x.migration_name===row.migration_name)?.checksum,row.checksum);}finally{await old.end();}
  const fresh=migrations.find(x=>x.migration_name==='20261006060000_case_governance');assert.ok(fresh.finished_at&&!fresh.rolled_back_at);assert.equal(fresh.checksum,crypto.createHash('sha256').update(fs.readFileSync('backend/prisma/migrations/20261006060000_case_governance/migration.sql')).digest('hex'));
  const row=(await db.query('SELECT "intakeStage","investigationPhase","governanceRevision",sensitivity,to_char("updatedAt",\'YYYY-MM-DD"T"HH24:MI:SS.MS\') AS version,to_char("ngayDeXuat",\'YYYY-MM-DD"T"HH24:MI:SS.MS\') AS proposal FROM cases WHERE id=$1',['synthetic-case-migration-sentinel'])).rows[0];assert.deepEqual(row,{intakeStage:null,investigationPhase:null,governanceRevision:0,sensitivity:'NORMAL',version:'2026-10-06T00:00:00.000',proposal:'2026-09-12T00:00:00.000'});
  const flag=(await db.query('SELECT enabled FROM feature_flags WHERE key=$1',['CASE_GOVERNANCE_V1'])).rows[0];
  let relation;
  if(additive){
    const initial=JSON.parse(fs.readFileSync('docs/test-evidence/case-governance/private-db/migration-certified.json','utf8'));assert.equal(initial.initialFlagOff,true);assert.equal(initial.newChecksum,fresh.checksum);
    assert.equal(flag.enabled,true,'Shared private test flag must remain ON');
    relation=migrations.find(x=>x.migration_name==='20261006073000_case_relation_disclosure_pin');assert.ok(relation.finished_at&&!relation.rolled_back_at);
    assert.equal(relation.checksum,'c204177f3802fbd330c44fe82d109f993f1bc45165661483930f4825cbf161c3');
    assert.equal(relation.checksum,crypto.createHash('sha256').update(fs.readFileSync('backend/prisma/migrations/20261006073000_case_relation_disclosure_pin/migration.sql')).digest('hex'));
    const columns=(await db.query("SELECT column_name FROM information_schema.columns WHERE table_name='case_relations' AND column_name IN ('revision','revokedAt','deletedAt','revokedById')")).rows.map(x=>x.column_name).sort();assert.deepEqual(columns,['deletedAt','revision','revokedAt','revokedById']);
  }else assert.equal(flag.enabled,false,'Initial Case flag must be OFF');
  const additional={};
  if(latest){
    for(const [name,sha] of [['20261006074500_case_principal_access_mode','86369ffc65591c763dcca58c16a78ca415b408e90348dc19d5abf9d5c39a93f4'],['20261006080000_case_receipt_custody_field_policy','232276cc4c4627deb0a12d3a277d4db0eaa9b4c4f1fafbb2a9534016f95c2fe9'],['20261006083000_case_disposition_receipt_pin','919dd540b29168a072ea0b92575afdb718357412c557a735c57a7e0d073b503e'],['20261006090000_case_active_relation_unique','696c5179ba101b752641c5680ba608b53093ea2f28e7ea849062eb25c79387a6']]){
      const migration=migrations.find(x=>x.migration_name===name);assert.ok(migration.finished_at&&!migration.rolled_back_at);assert.equal(migration.checksum,sha);assert.equal(sha,crypto.createHash('sha256').update(fs.readFileSync('backend/prisma/migrations/'+name+'/migration.sql')).digest('hex'));additional[name]=sha;
    }
    const fixture=JSON.parse(fs.readFileSync(require('node:path').join(process.env.CASE_UAT_RUNTIME||'','case-browser-fixture.json'),'utf8'));assert.equal(fixture.synthetic,true);const actorIds=Object.values(fixture.actors).map(a=>a.id);
    const actors=(await db.query('SELECT "caseAccessMode","caseAccessRevision" FROM users WHERE id=ANY($1::text[])',[actorIds])).rows;assert.equal(actors.length,7);assert.ok(actors.every(a=>a.caseAccessMode==='INTERNAL'&&a.caseAccessRevision===0),'All seven pre130 browser actors keep original internal mode');
    for(const [table,column] of [['case_handoffs','recipientId'],['case_handoffs','receiptFacts'],['case_handoffs','resolutionFacts'],['case_custody_events','sourceDocumentId'],['case_custody_events','sourceDocumentUpdatedAt'],['case_disclosure_packet_items','fieldDefinitionVersionId'],['case_disposition_requests','receiptDocumentId'],['case_disposition_requests','receiptDocumentUpdatedAt'],['case_disposition_requests','receiptSha256'],['case_disposition_requests','receiptByteLength']]){const exists=await db.query('SELECT1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2'.replace('SELECT1','SELECT 1'),[table,column]);assert.equal(exists.rowCount,1,table+'.'+column);}
    const indexes=(await db.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='case_relations'")).rows;
    assert.ok(!indexes.some(x=>x.indexname==='case_relations_sourceCaseId_targetCaseId_type_key'),'Old global uniqueness must be replaced, not retained');
    const active=indexes.find(x=>x.indexname==='case_relations_active_pair_type_key');assert.ok(active&&active.indexdef.includes('UNIQUE')&&active.indexdef.includes('revokedAt')&&active.indexdef.includes('deletedAt')&&active.indexdef.includes('IS NULL'),'Active-only relation uniqueness must exist');
    assert.ok(indexes.some(x=>x.indexname==='case_relations_sourceCaseId_targetCaseId_type_idx'),'Historical relation lookup index retained');
  }
  const report={timestamp:new Date().toISOString(),verdict:'PASS',target:'ownloopback55441/pc02_case_governance_uat',baselineMigrations:127,releaseMigrations:latest?133:additive?129:128,newChecksum:fresh.checksum,relationChecksum:relation?.checksum,additionalChecksums:latest?additional:undefined,activeRelationUniquenessVerified:latest||undefined,pre130BrowserActorDefaultsRetained:latest||undefined,sentinelUnchanged:true,unknownStagePhaseRemainNull:true,initialFlagOff:true,currentTestFlagEnabled:flag.enabled,sharedTestFlagUnchanged:additive||undefined};
  fs.writeFileSync('docs/test-evidence/case-governance/private-db/'+(latest?'migration-latest-certified.json':additive?'migration-relation-certified.json':'migration-certified.json'),JSON.stringify(report,null,2));
  if(process.argv[2]==='--enable-test-flag'){await db.query('UPDATE feature_flags SET enabled=TRUE,"updatedAt"=now() WHERE key=$1',['CASE_GOVERNANCE_V1']);report.testFlagEnabled=true;}
  console.log(JSON.stringify(report));
 }finally{await db.end();}
}
main().catch(e=>{console.error(e.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted]'));process.exitCode=1});
