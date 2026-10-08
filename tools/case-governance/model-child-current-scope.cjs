const fs = require('node:fs');
const path = require('node:path');
const ts = require('../../backend/node_modules/typescript');
const root = path.resolve(__dirname, '../..');
for (const module of ['subjects','lawyers','conclusions','investigation-supplements']) {
  const file = path.join(root, `backend/src/${module}/${module}.service.spec.ts`);
  let source = fs.readFileSync(file,'utf8');
  const ast = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  const db = source.includes('const mockPrisma') ? 'mockPrisma' : source.includes('const prisma') ? 'prisma' : 'prismaMock';
  const inserts = new Map();
  const changes = [];
  const visit = node => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const expr = node.expression.getText(ast), name = node.expression.name.text;
      if (expr.startsWith('service.') && ['getList','getById','create','update','delete'].includes(name)) {
        let statement = node;
        while (statement.parent && !ts.isExpressionStatement(statement) && !ts.isVariableStatement(statement)) statement = statement.parent;
        if (ts.isExpressionStatement(statement) || ts.isVariableStatement(statement)) {
          const scopeIndex = ['getList','getById'].includes(name) ? 1 : name === 'update' ? 4 : 3;
          const scope = node.arguments[scopeIndex]?.getText(ast) ?? 'null';
          inserts.set(statement.getStart(ast), `setOrdinaryCurrentScope(${db}, ${scope});\n`);
        }
      }
      if (name === 'toHaveBeenCalledWith' && node.expression.expression.getText(ast) === 'expect(mockAudit.log)' && node.arguments.length === 1)
        changes.push({start:node.arguments.end,end:node.arguments.end,text:`, ${db}`});
    }
    ts.forEachChild(node,visit);
  };
  visit(ast);
  for (const [start,text] of inserts) changes.push({start,end:start,text});
  for (const edit of changes.sort((a,b)=>b.start-a.start)) source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
  source=source.replace('import { ordinaryChildFixture }','import { ordinaryChildFixture, setOrdinaryCurrentScope }');
  if (['subjects','lawyers'].includes(module)) source=source.replace('where: { deletedAt: null },','where: { deletedAt: null, AND: [{ case: {} }] },');
  if (module==='subjects') source=source.replace("where: { id: 'sub-001' },", "where: { id: 'sub-001', caseId: FAKE_SUBJECT.caseId, updatedAt: FAKE_SUBJECT.updatedAt },");
  if (module==='lawyers') source=source.replace("where: { id: 'law-001' },", "where: { id: 'law-001', caseId: FAKE_LAWYER.caseId, updatedAt: FAKE_LAWYER.updatedAt },");
  fs.writeFileSync(file,source);
  const controllerFile=path.join(root,`backend/src/${module}/${module}.controller.ts`);
  let controller=fs.readFileSync(controllerFile,'utf8');
  controller=controller.replace(/getList\(([^\n]+)@Req\(\) req: ScopedRequest\)/,'getList($1@Req() req: ScopedRequest, @CurrentUser() user: AuthUser)');
  controller=controller.replace(/getById\(([^\n]+)@Req\(\) req: ScopedRequest\)/,'getById($1@Req() req: ScopedRequest, @CurrentUser() user: AuthUser)');
  controller=controller.replaceAll('req.user.id','user.id');
  fs.writeFileSync(controllerFile,controller);
  const controllerSpec=path.join(root,`backend/src/${module}/${module}.controller.spec.ts`);
  if (!fs.existsSync(controllerSpec)) continue;
  let spec=fs.readFileSync(controllerSpec,'utf8');
  const specAst=ts.createSourceFile(controllerSpec,spec,ts.ScriptTarget.Latest,true), specEdits=[];
  const specVisit=node=>{
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
      const expr=node.expression.getText(specAst);
      if(['controller.getList','controller.getById'].includes(expr)&&node.arguments.length===2)
        specEdits.push({start:node.arguments.end,end:node.arguments.end,text:', req.user as never'});
      if(node.expression.name.text==='toHaveBeenCalledWith'&&['expect(mockService.getList)','expect(mockService.getById)'].includes(node.expression.expression.getText(specAst))&&node.arguments.length===2)
        specEdits.push({start:node.arguments.end,end:node.arguments.end,text:', (req.user as { id: string }).id'});
    }
    ts.forEachChild(node,specVisit);
  };
  specVisit(specAst);
  for(const edit of specEdits.sort((a,b)=>b.start-a.start)) spec=spec.slice(0,edit.start)+edit.text+spec.slice(edit.end);
  fs.writeFileSync(controllerSpec,spec);
}
