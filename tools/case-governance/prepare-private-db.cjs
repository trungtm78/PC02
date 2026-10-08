const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {Client}=require('../../backend/node_modules/pg');
const assert=require('node:assert/strict');
async function main(){
  const target=new URL(process.env.DATABASE_URL||'');assert.equal(target.hostname,'127.0.0.1');assert.equal(target.port,'55441');assert.equal(target.pathname,'/pc02_case_governance_uat');
  const source=new URL(target);source.pathname='/pc02_incident_release_uat';
  const control=new URL(target);control.pathname='/postgres';
  const master=new Client({connectionString:control.toString()}),prior=new Client({connectionString:source.toString()});
  const out=path.resolve('docs/test-evidence/case-governance/private-db');fs.mkdirSync(out,{recursive:true});
  try{
    await master.connect();const existing=await master.query('SELECT 1 FROM pg_database WHERE datname=$1',['pc02_case_governance_uat']);const resume=process.argv[2]==='--resume-metadata';if(existing.rowCount&&!resume)throw Error('Do not overwrite an existing Case UAT database');
    await prior.connect();const migrations=(await prior.query('SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name')).rows;assert.equal(migrations.length,127);
    const dump=path.join(out,'baseline-schema.sql');
    const pgEnv={...process.env,PGHOST:'127.0.0.1',PGPORT:'55441',PGUSER:decodeURIComponent(source.username),PGPASSWORD:decodeURIComponent(source.password),PGDATABASE:'pc02_incident_release_uat'};
    const dumped=spawnSync('C:/Program Files/PostgreSQL/16/bin/pg_dump.exe',['--schema-only','--no-owner','--no-privileges','--file',dump],{env:pgEnv,encoding:'utf8',windowsHide:true});assert.equal(dumped.status,0,'Own schema-only export must succeed');
    if(!existing.rowCount){await master.query('CREATE DATABASE pc02_case_governance_uat');const restore=spawnSync('C:/Program Files/PostgreSQL/16/bin/psql.exe',['-v','ON_ERROR_STOP=1','-f',dump],{env:{...pgEnv,PGDATABASE:'pc02_case_governance_uat'},encoding:'utf8',windowsHide:true});assert.equal(restore.status,0,'Private schema restore must succeed');}
    const db=new Client({connectionString:target.toString()});await db.connect();
    try{if(existing.rowCount){const empty=await db.query('SELECT (SELECT COUNT(*) FROM cases)::int AS cases,(SELECT COUNT(*) FROM users)::int AS users,(SELECT COUNT(*) FROM _prisma_migrations)::int AS migrations');assert.deepEqual(empty.rows[0],{cases:0,users:0,migrations:0},'Resume only the pristine schema-only DB from interrupted metadata setup');}await db.query('BEGIN');for(const migration of migrations)await db.query('INSERT INTO _prisma_migrations(id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES(gen_random_uuid()::text,$1,now(),$2,now(),1)',[migration.checksum,migration.migration_name]);await db.query('INSERT INTO cases(id,name,"updatedAt","ngayDeXuat","caseProvenance","sourceDocumentNote") VALUES($1,$2,$3,$4,$5,$6)',['synthetic-case-migration-sentinel','Synthetic Case migration sentinel','2026-10-06T00:00:00Z','2026-09-12T00:00:00Z','DIRECT_DISCOVERY','Synthetic schema-rehearsal provenance only']);await db.query('COMMIT');}finally{await db.end();}
    const report={timestamp:new Date().toISOString(),verdict:'PASS',target:'loopback55441/pc02_case_governance_uat',baselineMigrations:migrations.length,data:'schema-only from own prior compatible UAT DB, no business rows copied',syntheticSentinel:true};fs.writeFileSync(path.join(out,'preparation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{await prior.end();await master.end();}
}
main().catch(e=>{console.error(e.message.replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted]'));process.exitCode=1});
