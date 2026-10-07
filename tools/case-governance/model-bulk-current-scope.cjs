const fs=require('node:fs'),path=require('node:path'),ts=require('../../backend/node_modules/typescript');
for(const module of ['subjects','lawyers'])for(const suffix of ['service.spec.ts','export.spec.ts']){
 const file=path.resolve(__dirname,`../../backend/src/${module}/bulk/${module}.bulk.${suffix}`);let s=fs.readFileSync(file,'utf8');const ast=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true),inserts=new Map();
 const visit=node=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&['service.bulkDelete','service.bulkExport'].includes(node.expression.getText(ast))&&ts.isObjectLiteralExpression(node.arguments[0])){
  const input=node.arguments[0],scope=input.properties.find(p=>p.name?.getText(ast)==='dataScope')?.initializer?.getText(ast)??'null';
  let statement=node;while(statement.parent&&!ts.isExpressionStatement(statement)&&!ts.isVariableStatement(statement))statement=statement.parent;
  if(ts.isExpressionStatement(statement)||ts.isVariableStatement(statement))inserts.set(statement.getStart(ast),`setOrdinaryCurrentScope(mockPrisma,${scope});\n`);
 }ts.forEachChild(node,visit);};visit(ast);
 for(const[start,text]of [...inserts].sort((a,b)=>b[0]-a[0]))s=s.slice(0,start)+text+s.slice(start);
 s=s.replace('import { ordinaryChildFixture }','import { ordinaryChildFixture, setOrdinaryCurrentScope }');fs.writeFileSync(file,s);
}
