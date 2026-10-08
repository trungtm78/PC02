const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {Client}=require('../../backend/node_modules/pg');
const root=path.resolve(__dirname,'../..');
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
async function main(){
 const url=new URL(process.env.DATABASE_URL||'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55441');assert.equal(url.pathname,'/pc02_case_governance_uat');
 const runtime=path.resolve(process.env.CASE_UAT_RUNTIME||'');assert.ok(runtime.includes('pc02-incident-uat-'));assert.ok(!runtime.toLowerCase().startsWith(root.toLowerCase()));
 const dbReport=JSON.parse(fs.readFileSync(path.join(root,'docs/test-evidence/case-governance/private-db/restore-rehearsal.json'),'utf8'));
 assert.equal(dbReport.verdict,'PASS');assert.match(dbReport.target,/^pc02_case_restore_uat_\d{14}$/);
 url.pathname='/'+dbReport.target;const db=new Client({connectionString:url.toString()});
 const uploadRoot=fs.realpathSync(path.join(root,'backend/uploads/documents'));
 const tempRoot=fs.realpathSync(require('node:os').tmpdir());
 const fixtureLeaves=new Set(['original.bin','other.bin','unapproved.bin','protected-original.bin','public-reviewed.bin','custody-receipt.bin','related-original.bin']);
 const out=path.join(runtime,dbReport.target+'-files');fs.mkdirSync(out,{recursive:true});
 const results=[],excluded=[];
 try{
  await db.connect();
  const assets=(await db.query('SELECT a.id,a.sha256,d."filePath" FROM case_asset_versions a JOIN documents d ON d.id=a."documentId" ORDER BY a.id')).rows;
  for(const asset of assets){
   const candidate=path.resolve(root,'backend',asset.filePath);
   if(!fs.existsSync(candidate)){excluded.push({assetId:asset.id,reason:'File absent in source test runtime; not claimed recovered'});continue;}
   const real=fs.realpathSync(candidate);
   const privateFixture=path.dirname(path.dirname(real)).toLowerCase()===tempRoot.toLowerCase()&&/^pc02-evidence-db-[A-Za-z0-9_-]+$/.test(path.basename(path.dirname(real)))&&fixtureLeaves.has(path.basename(real));
   if(!real.toLowerCase().startsWith(uploadRoot.toLowerCase()+path.sep.toLowerCase())&&!privateFixture){excluded.push({assetId:asset.id,reason:'Outside explicitly owned upload/test roots; no bytes read'});continue;}
   const buffer=fs.readFileSync(real),actual=sha(buffer);
   if(actual!==asset.sha256){excluded.push({assetId:asset.id,reason:'Ledger differs from observed test bytes; not claimed recovered'});continue;}
   const safe=sha(asset.id),backup=path.join(out,safe+'.backup'),restored=path.join(out,safe+'.restored');
   if(fs.existsSync(backup)||fs.existsSync(restored))throw new Error('Never overwrite prior file recovery evidence');
   fs.copyFileSync(real,backup,fs.constants.COPYFILE_EXCL);fs.copyFileSync(backup,restored,fs.constants.COPYFILE_EXCL);
   assert.equal(sha(fs.readFileSync(restored)),asset.sha256);
   results.push({assetId:asset.id,sha256:actual,bytes:buffer.length,restored:true});
  }
  assert.ok(results.length>0,'Require actual verified original bytes');
  const report={timestamp:new Date().toISOString(),target:dbReport.target,scope:'Recovery of ledger-matching immutable test files; missing or tampered test fixtures explicitly excluded, not complete dataset health',verifiedFiles:results,excluded,sourceFilesUnchanged:true,verdict:'PASS',production:false};
  fs.writeFileSync(path.join(root,'docs/test-evidence/case-governance/private-db/file-restore-rehearsal.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({verifiedFiles:results.length,excluded:excluded.length,verdict:report.verdict,scope:report.scope}));
 }finally{await db.end();}
}
main().catch(e=>{console.error(String(e.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g,'[redacted]'));process.exitCode=1;});
