const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(process.cwd(),'..'),dir=path.join(root,'docs/test-evidence/case-governance');
const baseline=JSON.parse(fs.readFileSync(path.join(dir,'graph-access-baseline.json'),'utf8'));
const roots=['calendar','kpi','reports','shared/action-plans','shared/vks-meetings','notifications'];const products=[];
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,entry.name);if(entry.isDirectory())walk(f);else if(f.endsWith('.ts')&&!f.endsWith('.spec.ts')&&!f.endsWith('.d.ts')){
 const rel=path.relative(root,f).replace(/\\/g,'/');const before=baseline.sources[rel];if(!before||before.hash!==crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'))products.push(rel);
}}}
roots.forEach(name=>walk(path.join(root,'backend/src',name)));products.push('backend/src/document-templates/dynamic-export.service.ts','backend/src/cases/governance/case-outbox.worker.ts');
const collect=products.filter(f=>f.endsWith('.service.ts')||f.endsWith('.worker.ts')||f.endsWith('.scheduler.ts')||f.endsWith('.interceptor.ts'));
fs.writeFileSync(path.join(dir,'graph-access-products.json'),JSON.stringify({products,collect},null,2));
const args=['proxy','npx','jest','src/calendar','src/kpi','src/reports','src/shared/action-plans','src/shared/vks-meetings','src/notifications','src/document-templates','src/cases/governance/case-outbox','--runInBand','--silent','--json','--outputFile='+path.join(dir,'graph-access-affected.json'),'--coverage',...collect.map(f=>'--collectCoverageFrom='+f.replace('backend/src/','')),'--coverageDirectory='+path.join(dir,'graph-access-coverage')];
const log=fs.openSync(path.join(dir,'graph-access-affected.log'),'w');const startedAt=new Date().toISOString();
const result=cp.spawnSync('rtk',args,{stdio:['ignore',log,log],shell:false});fs.closeSync(log);
fs.writeFileSync(path.join(dir,'graph-access-affected-command.json'),JSON.stringify({command:'rtk '+args.join(' '),startedAt,completedAt:new Date().toISOString(),exitCode:result.status},null,2));
const data=JSON.parse(fs.readFileSync(path.join(dir,'graph-access-affected.json'),'utf8'));console.log(JSON.stringify({exit:result.status,suites:data.numPassedTestSuites,passed:data.numPassedTests,failed:data.numFailedTests,skipped:data.numPendingTests,failures:data.testResults.filter(r=>r.status==='failed').map(r=>({file:r.name.split('backend')[1],first:r.assertionResults.find(t=>t.status==='failed')?.failureMessages[0].split('\n').slice(0,4).join(' ')}))}));process.exit(result.status??1);
