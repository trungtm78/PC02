/* Read-only reproducible baseline/coverage comparison; no product edits. */
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=process.cwd(),evidence=path.join(root,'docs/test-evidence/case-governance');
const coverage=JSON.parse(fs.readFileSync(path.join(evidence,'foundation-coverage-final.json'),'utf8'));
const files=['cases/governance/case-governance.service.ts','cases/governance/case-governance.contract.ts','cases/governance/case-principal-access.service.ts','cases/cases.service.ts','cases/bulk/cases.bulk.service.ts','cases/case-statistic.builder.ts','audit/case-audit-policy.service.ts','audit/audit.service.ts','audit/audit.controller.ts','common/utils/scope-filter.util.ts','common/utils/kiem-vu-an-cha.ts','common/bca-excel.helper.ts'].map(file=>'backend/src/'+file);
const normalize=value=>value.replace(/\\/g,'/').toLowerCase();
const git=args=>cp.execFileSync('rtk',['proxy','git',...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
const rows=[];
for(const filename of files){
 const actual=path.join(root,filename),record=Object.entries(coverage).find(([key])=>normalize(key)===normalize(actual))?.[1];
 if(!record)throw new Error('Missing owned-product coverage: '+filename);
 let exists=true;try{git(['cat-file','-e','10030bed:'+filename]);}catch{exists=false;}
 const changed=new Set();
 if(!exists)fs.readFileSync(actual,'utf8').split('\n').forEach((_,index)=>changed.add(index+1));
 else for(const match of git(['diff','--no-color','--unified=0','10030bed','--',filename]).matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)){
  const count=match[2]===undefined?1:Number(match[2]);for(let offset=0;offset<count;offset++)changed.add(Number(match[1])+offset);
 }
 const lines=new Map(),branches=[];
 for(const [id,location]of Object.entries(record.statementMap))if(changed.has(location.start.line))lines.set(location.start.line,Math.max(lines.get(location.start.line)??0,record.s[id]));
 for(const [id,branch]of Object.entries(record.branchMap)){
  let affected=false;for(let line=branch.loc.start.line;line<=branch.loc.end.line;line++)if(changed.has(line))affected=true;
  if(affected)branches.push(...record.b[id]);
 }
 rows.push({filename,addedFile:!exists,changedLines:changed.size,executableLines:lines.size,coveredLines:[...lines.values()].filter(hits=>hits>0).length,changedBranchOutcomes:branches.length,coveredBranchOutcomes:branches.filter(hits=>hits>0).length,uncoveredLines:[...lines].filter(([,hits])=>!hits).map(([line])=>line)});
}
const total=rows.reduce((sum,row)=>{for(const key of ['executableLines','coveredLines','changedBranchOutcomes','coveredBranchOutcomes'])sum[key]+=row[key];return sum;},{executableLines:0,coveredLines:0,changedBranchOutcomes:0,coveredBranchOutcomes:0});
total.lineCoverage=100*total.coveredLines/total.executableLines;total.branchCoverage=100*total.coveredBranchOutcomes/total.changedBranchOutcomes;
const result={baseline:'10030bed',measuredAt:new Date().toISOString(),method:'12 owned executable boundary products (original 11 plus newly authorized BCA Excel helper); added files fully included, tracked files git added hunks; Istanbul statement-start line max hits and intersecting branch outcomes. Controllers/modules/DTO/decorators/seed declarations outside this executable measure remain type/lint/schema/permission tests.',total,rows};
fs.writeFileSync(path.join(evidence,'foundation-patch-coverage.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result.total,null,2));
