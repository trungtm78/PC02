// This is one API evidence stage of the requirements-derived UAT, not full UAT.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),runtime=path.resolve(process.env.CASE_UAT_RUNTIME||'');
assert.ok(runtime.includes('pc02-incident-uat-')&&!runtime.toLowerCase().startsWith(root.toLowerCase()));
const freezePath=path.join(root,'docs/test-evidence/case-governance/final-source-freeze.json');
assert.ok(fs.existsSync(freezePath),'Require finalized reviewed source manifest before runtime UAT');
const freeze=JSON.parse(fs.readFileSync(freezePath,'utf8'));
assert.equal(freeze.reviewGate,'PASS');
for(const [file,hash] of Object.entries(freeze.sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,'Source changed: '+file);
const fixture=JSON.parse(fs.readFileSync(path.join(runtime,'case-browser-fixture.json'),'utf8'));
assert.equal(fixture.synthetic,true);assert.equal(fixture.database,'pc02_case_governance_uat');assert.equal(fixture.api,'http://127.0.0.1:3001/api/v1');
const fieldFixtures=JSON.parse(fs.readFileSync(path.join(runtime,'case-field-uat-values.json'),'utf8'));
assert.equal(fieldFixtures.synthetic,true);assert.equal(fieldFixtures.source,'approved132fieldInventory');
const inventory=JSON.parse(fs.readFileSync(path.join(root,'docs/requirements/case-governance/field-inventory.json'),'utf8'));
assert.equal(inventory.rows.length,132);
assert.deepEqual(Object.keys(fieldFixtures.values).sort(),inventory.rows.map(x=>x.key).sort());
const out=path.join(root,'docs/test-evidence/case-governance/private-db/field-api-stage.json');
const operationPath=path.join(runtime,'case-field-uat-operation.json');
const resume=process.argv.includes('--resume');
assert.ok(!fs.existsSync(operationPath)||resume,'Existing UAT operation: inspect/resume explicitly; never create duplicates');
const operation=fs.existsSync(operationPath)?JSON.parse(fs.readFileSync(operationPath,'utf8')):{synthetic:true,namespace:'case-fields-uat-'+crypto.randomUUID(),createdAt:new Date().toISOString(),caseId:null};
assert.equal(operation.synthetic,true);if(resume)assert.equal(typeof operation.caseId,'string');
const namespace=operation.namespace,results=[];
if(!fs.existsSync(operationPath))fs.writeFileSync(operationPath,JSON.stringify(operation,null,2),{flag:'wx'});
async function request(route,method,body){
 const response=await fetch(fixture.api+route,{method,headers:{Authorization:'Bearer '+fixture.actors.author.accessToken,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const text=await response.text();let value;try{value=JSON.parse(text);}catch{throw new Error('Non-JSON response on '+method+' '+route+' status'+response.status);}
 assert.equal(response.status<300,true,'Unexpected status '+response.status+' '+method+' '+route+' '+JSON.stringify(value));
 assert.notEqual(value.success,false,'Application rejected '+method+' '+route);
 return value.data??value;
}
function columnFor(row){return row.storage.startsWith('CaseStatistic.')?row.column.replace(/^statistic\./,''):row.column;}
function valueAt(record,row){return row.storage.startsWith('CaseStatistic.')?record.statistic?.[columnFor(row)]:record[columnFor(row)];}
function compare(value,expected,row){
 if(row.type==='DateTime?'&&expected!==null){assert.equal(new Date(value).toISOString(),new Date(expected).toISOString());return;}
 if(row.type==='date'&&expected!==null){assert.equal(new Date(value).toISOString().slice(0,10),expected);return;}
 if(Array.isArray(expected)){assert.deepEqual([...value].sort(),[...expected].sort());return;}
 assert.deepEqual(value,expected);
}
function save(){fs.writeFileSync(out,JSON.stringify({timestamp:new Date().toISOString(),kind:'API CREATE stage only; visible-detail/form/export/access/clone and action UAT still NOT_RUN',namespace,caseId:operation.caseId,sourceFreeze:freezePath,results,verdict:results.length===132&&results.every(x=>x.status==='PASS')?'API_STAGE_PASS_NOT_FULL_UAT':'FAIL'},null,2)+'\n');}
async function main(){
 const body={name:namespace,caseProvenance:'DIRECT_DISCOVERY',sourceDocumentNote:'Synthetic local UAT, no actual dossier',assignedTeamId:fixture.teamId,investigatorId:fixture.actors.author.id,statistic:{}};
 for(const row of inventory.rows){const target=row.storage.startsWith('CaseStatistic.')?body.statistic:body;assert.equal(typeof row.column,'string');target[columnFor(row)]=fieldFixtures.values[row.key];}
 if(!operation.caseId){const created=await request('/cases','POST',body);assert.equal(typeof created.id,'string');operation.caseId=created.id;fs.writeFileSync(operationPath,JSON.stringify(operation,null,2));}
 const record=await request('/cases/'+operation.caseId,'GET');
 for(const [index,row] of inventory.rows.entries()){
  const result={id:'CG01-F'+String(index+1).padStart(3,'0')+'-CREATE',stage:'API_TYPED_VALUE_PERSISTENCE',field:row.key,status:'NOT_RUN',fullCriticalUatStatus:'NOT_RUN'};
  try{compare(valueAt(record,row),fieldFixtures.values[row.key],row);result.status='PASS';}catch(error){result.status='FAIL';result.reason=error.message;}
  results.push(result);
 }
 save();const failed=results.filter(x=>x.status==='FAIL');console.log(JSON.stringify({caseId:operation.caseId,stage:'API_CREATE_ONLY',passed:132-failed.length,failed:failed.map(x=>({field:x.field,reason:x.reason})),fullCriticalUat:'NOT_RUN'}));if(failed.length)process.exitCode=1;
}
main().catch(error=>{save();console.error(error.message);process.exitCode=1;});
