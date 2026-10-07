const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const roots=['calendar','kpi','reports','shared/action-plans','shared/vks-meetings','notifications'];
const files=[];function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,item.name);if(item.isDirectory())walk(f);else if(f.endsWith('.ts'))files.push(f.replace(/\\/g,'/'));}}
for(const root of roots)walk('backend/src/'+root);
files.push('backend/src/document-templates/dynamic-export.service.ts','backend/src/document-templates/document-templates.module.ts','backend/src/document-templates/document-templates.controller.ts');
const sources=Object.fromEntries(files.map(f=>[f,{hash:crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),text:fs.readFileSync(f,'utf8')} ]));
fs.writeFileSync('docs/test-evidence/case-governance/graph-access-baseline.json',JSON.stringify({at:new Date().toISOString(),sources}));
const matrix=JSON.parse(fs.readFileSync('docs/test-evidence/case-governance/child-entrypoint-matrix.json','utf8'));
const rows=matrix.rows.filter(r=>['calendar','kpi','reports','shared','notifications','document-templates'].includes(r.module));
fs.writeFileSync('docs/test-evidence/case-governance/graph-access-matrix.json',JSON.stringify({at:new Date().toISOString(),rows:rows.map(r=>({...r,owner:'graph-access',closureStatus:'OPEN_GRAPH_IMPLEMENTATION',reviewStatus:'NOT_REVIEWED'}))},null,2));
console.log(JSON.stringify({files:files.length,candidates:rows.length,byModule:rows.reduce((a,r)=>(a[r.module]=(a[r.module]||0)+1,a),{})}));
