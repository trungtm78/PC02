// Read-only source probe: execute the existing pure queue membership function.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),ts=require('../../backend/node_modules/typescript');
const file='backend/src/cases/governance/case-operations.service.ts';
const text=fs.readFileSync(path.join(root,file),'utf8');
const start=text.indexOf('function member('),end=text.indexOf('@Injectable()',start);
assert.ok(start>=0&&end>start,'Pure member source boundary changed');
const js=ts.transpileModule(text.slice(start,end)+'\nexports.member=member;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const sandbox={exports:{},Date};vm.runInNewContext(js,sandbox,{timeout:1000});
const clock=new Date('2026-10-06T05:00:00.000Z'); // Noon HCM on the entered deadline day.
const record={id:'synthetic-probe',status:'DANG_DIEU_TRA',deadline:new Date('2026-10-06'),name:'Synthetic',investigationPhase:'INITIAL',ngayKhoiTo:new Date('2026-08-06')};
const actual=sandbox.exports.member('overdue',record,new Set(),{actorId:'probe'},clock);
const report={timestamp:new Date().toISOString(),kind:'Read-only pure source probe; no DB/runtime mutation',source:file,clock:clock.toISOString(),enteredCivilDeadline:'2026-10-06',storedDeadline:record.deadline.toISOString(),expectedOverdue:false,actualOverdue:actual,verdict:actual===false?'PASS':'FAIL',requirement:'CG16 civil deadline and queue/list/count/export parity'};
fs.writeFileSync(path.join(root,'docs/test-evidence/case-governance/civil-overdue-probe.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
if(report.verdict==='FAIL')process.exitCode=1;
