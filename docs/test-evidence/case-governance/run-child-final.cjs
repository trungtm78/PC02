const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),backend=path.join(root,'backend');
const query=cp.spawnSync('rtk',['proxy','node',path.join(__dirname,'measure-child-checkpoint.cjs'),'--paths'],{cwd:root,encoding:'utf8',windowsHide:true});
const files=JSON.parse(query.stdout.slice(query.stdout.indexOf('[')).replace(/^\[rtk\].*\r?\n/,''));
const mode=process.argv[2];
let args;
if(mode==='format') args=['proxy','npx','prettier','--write',...files.filter(f=>f!=='cases/cases.service.ts').map(f=>'src/'+f)];
else if(mode==='lint') args=['proxy','npx','eslint',...files.map(f=>'src/'+f),'--format','json'];
else if(mode==='coverage') args=['proxy','npx','jest','--runInBand','--silent','--coverage','--coverageReporters=json','--coverageDirectory=../docs/test-evidence/case-governance/child-coverage','--json','--outputFile=../docs/test-evidence/case-governance/child-final-affected.json','--testPathPatterns=admin|auth/services/enrollment|case-child-access|subjects|lawyers|conclusions|investigation-supplements|proposals|delegations|incidents|petitions|cases/bulk|case-field-schema|legal-action.validation|case-action-catalog|case-civil-day|case-operations|cases-civil-overdue',...files.map(f=>'--collectCoverageFrom='+f)];
else throw new Error('Unknown final gate');
const result=cp.spawnSync('rtk',args,{cwd:backend,encoding:'utf8',windowsHide:true,maxBuffer:30*1024*1024});
fs.writeFileSync(path.join(__dirname,`child-final-${mode}.log`),`${result.stdout}\n${result.stderr}\nExit: ${result.status}\n`);
if(mode==='lint') {
  const at=result.stdout.indexOf('[{');
  const rows=at<0?[]:JSON.parse(result.stdout.slice(at));
  console.log(JSON.stringify({exit:result.status,errors:rows.reduce((n,r)=>n+r.errorCount,0),warnings:rows.reduce((n,r)=>n+r.warningCount,0),failures:rows.filter(r=>r.errorCount).map(r=>({file:r.filePath,messages:r.messages}))}));
} else console.log((result.stdout+'\n'+result.stderr).slice(-9000));
process.exitCode=result.status??1;
