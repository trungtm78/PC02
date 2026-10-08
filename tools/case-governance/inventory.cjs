const fs=require('node:fs'),path=require('node:path'),ts=require('../../frontend/node_modules/typescript');
const root=path.resolve(__dirname,'../..');
const file='frontend/src/features/cases/legacy-form-layout.def.ts';
const text=fs.readFileSync(path.join(root,file),'utf8');const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
const aliases={},fields=new Map();
function name(p){return p.name&&(ts.isIdentifier(p.name)||ts.isStringLiteral(p.name))?p.name.text:undefined;}
function walk(node){
  if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='LEGACY_FIELD_TO_COLUMN'&&node.initializer&&ts.isObjectLiteralExpression(node.initializer)){for(const p of node.initializer.properties)if(ts.isPropertyAssignment(p)&&ts.isStringLiteral(p.initializer))aliases[name(p)]=p.initializer.text;}
  if(ts.isObjectLiteralExpression(node)){const props=node.properties.filter(ts.isPropertyAssignment);const f=props.find(p=>name(p)==='field');if(f&&ts.isStringLiteral(f.initializer)){const key=f.initializer.text;const label=props.find(p=>name(p)==='caption');const kind=props.find(p=>name(p)==='kind');const row=fields.get(key)||{key,labels:[],placements:[],kind:kind&&ts.isStringLiteral(kind.initializer)?kind.initializer.text:'legacy'};if(label&&ts.isStringLiteral(label.initializer)&&!row.labels.includes(label.initializer.text))row.labels.push(label.initializer.text);row.placements.push(source.getLineAndCharacterOfPosition(node.getStart(source)).line+1);fields.set(key,row);}}
  ts.forEachChild(node,walk);
}walk(source);
const prisma=fs.readFileSync(path.join(root,'backend/prisma/schema.prisma'),'utf8');
const model=prisma.match(/model Case \{([\s\S]*?)\n\}/)[1];const columns=new Map([...model.matchAll(/^\s+(\w+)\s+(\w+[?\[\]]*)/gm)].map(m=>[m[1],m[2]]));
const rows=[...fields.values()].map(row=>{const column=aliases[row.key]||row.key;return{...row,column,storage:row.key.startsWith('statistic.')?'CaseStatistic.'+row.key.slice(10):columns.has(column)?'Case.'+column:'metadata.'+row.key,type:columns.get(column)||row.kind,canonicalClear:'explicit clear wins; metadata legacy fallback only when canonical is unmapped/unverified and not explicitly cleared',source:file,requirement:'CG01',uat:['create/read','edit/read','explicit-clear/read','clone','relevant search/export/detail consistency']};}).sort((a,b)=>a.key.localeCompare(b.key));
const report={timestamp:new Date().toISOString(),source:file,uniqueKeys:rows.length,placements:rows.reduce((n,r)=>n+r.placements.length,0),tabCount:10,rows};
if(report.uniqueKeys!==132||report.placements!==181||rows.some(row=>!row.labels.length))throw Error('Inventory baseline drift/missing captions; investigate, do not change expected count');
fs.mkdirSync(path.join(root,'docs/requirements/case-governance'),{recursive:true});fs.writeFileSync(path.join(root,'docs/requirements/case-governance/field-inventory.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({uniqueKeys:report.uniqueKeys,placements:report.placements,tabCount:10}));
