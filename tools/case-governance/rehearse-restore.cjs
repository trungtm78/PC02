// Restore only a new, uniquely named synthetic loopback database. Never drop/overwrite.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const {Client} = require('../../backend/node_modules/pg');
const root = path.resolve(__dirname,'../..');
const bin = 'C:/Program Files/PostgreSQL/16/bin/';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function identifier(value) { assert.match(value,/^[a-zA-Z_][a-zA-Z0-9_]*$/);return '"'+value+'"'; }
async function digest(db) {
  const names=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map(r=>r.tablename);
  const tables={};
  for(const name of names) {
    const rows=(await db.query('SELECT to_jsonb(t)::text AS value FROM public.'+identifier(name)+' t ORDER BY to_jsonb(t)::text')).rows;
    tables[name]={rows:rows.length,sha256:sha(rows.map(r=>r.value).join('\n'))};
  }
  return tables;
}
async function main() {
  const sourceURL=new URL(process.env.DATABASE_URL||'');
  assert.equal(sourceURL.hostname,'127.0.0.1');assert.equal(sourceURL.port,'55441');assert.equal(sourceURL.pathname,'/pc02_case_governance_uat');
  const runtime=path.resolve(process.env.CASE_UAT_RUNTIME||'');assert.ok(runtime.includes('pc02-incident-uat-'));assert.ok(!runtime.toLowerCase().startsWith(root.toLowerCase()));
  const restoreName='pc02_case_restore_uat_'+new Date().toISOString().replace(/\D/g,'').slice(0,14);
  const restoreURL=new URL(sourceURL);restoreURL.pathname='/'+restoreName;
  const controlURL=new URL(sourceURL);controlURL.pathname='/postgres';
  const source=new Client({connectionString:sourceURL.toString()}),control=new Client({connectionString:controlURL.toString()}),restored=new Client({connectionString:restoreURL.toString()});
  const artifact=path.join(runtime,restoreName+'.dump');
  const pgEnv={...process.env,PGHOST:'127.0.0.1',PGPORT:'55441',PGUSER:decodeURIComponent(sourceURL.username),PGPASSWORD:decodeURIComponent(sourceURL.password),PGDATABASE:'pc02_case_governance_uat'};
  try {
    await source.connect();await source.query("SET TIME ZONE 'UTC'");await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot=(await source.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
    const before=await digest(source);
    assert.ok((before.case_decisions?.rows||0)>0,'Meaningful rehearsal needs decision history');
    assert.ok((before.case_asset_versions?.rows||0)>0,'Meaningful rehearsal needs asset lineage');
    assert.ok((before.case_custody_events?.rows||0)>0,'Meaningful rehearsal needs physical custody');
    const dump=spawnSync(bin+'pg_dump.exe',['--format=custom','--no-owner','--no-privileges','--snapshot='+snapshot,'--file='+artifact],{env:pgEnv,encoding:'utf8',windowsHide:true});
    assert.equal(dump.status,0,'Synthetic backup command must pass');
    await source.query('COMMIT');
    await control.connect();const existing=await control.query('SELECT 1 FROM pg_database WHERE datname=$1',[restoreName]);assert.equal(existing.rowCount,0,'Never overwrite a restore target');
    await control.query('CREATE DATABASE '+identifier(restoreName));
    const result=spawnSync(bin+'pg_restore.exe',['--no-owner','--no-privileges','--exit-on-error','--dbname='+restoreName,artifact],{env:{...pgEnv,PGDATABASE:restoreName},encoding:'utf8',windowsHide:true});
    fs.writeFileSync(path.join(runtime,restoreName+'-restore.log'),result.stderr||'');
    assert.equal(result.status,0,'New isolated target restore must pass');
    await restored.connect();await restored.query("SET TIME ZONE 'UTC'");const after=await digest(restored);assert.deepEqual(after,before,'Every table must preserve exact snapshot content');
    const report={timestamp:new Date().toISOString(),scope:'Database snapshot restoration only; separate immutable file and application recovery checks remain required',source:'loopback55441/pc02_case_governance_uat',target:restoreName,backupSHA256:sha(fs.readFileSync(artifact)),backupCommandExit:dump.status,restoreCommandExit:result.status,tables:after,verdict:'PASS',data:'synthetic only',production:false};
    fs.writeFileSync(path.join(root,'docs/test-evidence/case-governance/private-db/restore-rehearsal.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({target:restoreName,tables:Object.keys(after).length,backupCommandExit:dump.status,restoreCommandExit:result.status,verdict:report.verdict,scope:report.scope}));
  } finally {await Promise.allSettled([source.end(),control.end(),restored.end()]);}
}
main().catch(error=>{console.error(String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted]'));process.exitCode=1;});
