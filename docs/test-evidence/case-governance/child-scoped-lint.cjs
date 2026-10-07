const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../..');
const raw=fs.readFileSync(path.join(__dirname,'child-final-lint.log'),'utf8');
const start=raw.indexOf('[{'),end=raw.lastIndexOf('}]')+2,rows=JSON.parse(raw.slice(start,end)),checked=[];
for(const row of rows){
 const relative=path.relative(path.join(root,'backend/src'),row.filePath).replaceAll('\\','/');
 const baseline=path.join(root,'.superpowers/sdd/PLAN/child-measure-baselines',relative.replaceAll('/','__'));
 const diff=cp.spawnSync('rtk',['proxy','git','diff','--no-index','--unified=0','--',baseline,row.filePath],{cwd:root,encoding:'utf8',windowsHide:true});
 const ranges=[...diff.stdout.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)].map(m=>[+m[1],+m[1]+ +(m[2]??1)-1]);
 const scoped=row.messages.filter(m=>ranges.some(([a,b])=>m.line<=b&&(m.endLine??m.line)>=a));
 if(process.argv.includes('--fix-format')) {
  let source=fs.readFileSync(row.filePath,'utf8');
  for(const fix of scoped.filter(m=>m.ruleId==='prettier/prettier'&&m.fix).map(m=>m.fix).sort((a,b)=>b.range[0]-a.range[0])) source=source.slice(0,fix.range[0])+fix.text+source.slice(fix.range[1]);
  fs.writeFileSync(row.filePath,source);
 }
 checked.push({file:relative,totalErrors:row.errorCount,totalWarnings:row.warningCount,changedDiagnostics:scoped});
}
const result={timestamp:new Date().toISOString(),method:'Fresh ESLint whole-owned-file JSON; diagnostics intersect exact added hunks from recorded owned baselines. Unchanged legacy diagnostics separately retained.',scopedErrors:checked.flatMap(r=>r.changedDiagnostics).filter(m=>m.severity===2).length,scopedWarnings:checked.flatMap(r=>r.changedDiagnostics).filter(m=>m.severity===1).length,rows:checked};
fs.writeFileSync(path.join(__dirname,'child-scoped-lint.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({errors:result.scopedErrors,warnings:result.scopedWarnings,failures:checked.filter(r=>r.changedDiagnostics.length).map(r=>({file:r.file,diagnostics:r.changedDiagnostics.map(m=>({line:m.line,rule:m.ruleId}))}))}));
process.exitCode=result.scopedErrors?1:0;
