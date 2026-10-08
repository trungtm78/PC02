// Candidate entrypoints from source AST. This inventory is not an authorization verdict.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const ts = require('../../backend/node_modules/typescript');
const root = path.resolve(__dirname, '../..');
function rg(args) {
  const result = spawnSync('rtk', ['proxy','rg',...args], {cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
  if(result.status!==0) throw new Error(result.stderr||'rg failed');
  return result.stdout.split(/\r?\n/).map(s=>s.replace(/\\/g,'/')).filter(s=>s.startsWith('backend/src/'));
}
const services = rg(['-l','caseId|CaseWhereInput|assertCase|readableCase','backend/src','-g','*service.ts','-g','*worker.ts']);
const modules = new Set(services.map(file=>file.split('/')[2]));
modules.add('admin');
const controllers = rg(['--files','backend/src','-g','*controller.ts']).filter(file=>modules.has(file.split('/')[2]));
const rows = [];
const verbs = new Set(['Get','Post','Put','Patch','Delete']);
function decorators(node) { return ts.canHaveDecorators(node) ? ts.getDecorators(node)||[] : []; }
function calls(node) { return decorators(node).map(d=>d.expression).filter(ts.isCallExpression); }
for(const file of controllers) {
  const source = ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true);
  for(const klass of source.statements.filter(ts.isClassDeclaration)) {
    const classCalls = calls(klass);
    const controller = classCalls.find(c=>c.expression.getText(source)==='Controller');
    if(!controller) continue;
    const base = controller.arguments[0]&&ts.isStringLiteralLike(controller.arguments[0]) ? controller.arguments[0].text : '';
    const classPermissions = classCalls.filter(c=>['RequirePermissions','UseGuards'].includes(c.expression.getText(source))).map(c=>c.getText(source));
    for(const method of klass.members.filter(ts.isMethodDeclaration)) {
      const methodCalls = calls(method);
      const route = methodCalls.find(c=>verbs.has(c.expression.getText(source)));
      if(!route) continue;
      const suffix = route.arguments[0]&&ts.isStringLiteralLike(route.arguments[0]) ? route.arguments[0].text : '';
      const position = source.getLineAndCharacterOfPosition(method.getStart(source));
      const invoked = [];
      function inspect(node) {
        if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.expression.getText(source).startsWith('this.')) invoked.push(node.expression.getText(source));
        ts.forEachChild(node,inspect);
      }
      if(method.body) inspect(method.body);
      rows.push({route:'/api/v1/'+[base,suffix].filter(Boolean).join('/'),verb:route.expression.getText(source).toUpperCase(),module:file.split('/')[2],file,line:position.line+1,handler:method.name.getText(source),permissions:[...classPermissions,...methodCalls.filter(c=>['RequirePermissions','UseGuards'].includes(c.expression.getText(source))).map(c=>c.getText(source))],parameters:method.parameters.map(p=>p.getText(source)),serviceCalls:[...new Set(invoked)],requirement:'CG14',reviewStatus:'NOT_REVIEWED',evidence:[]});
    }
  }
}
rows.sort((a,b)=>a.route.localeCompare(b.route)||a.verb.localeCompare(b.verb));
const output = path.join(root,'docs/requirements/case-governance/entrypoint-inventory.json');
fs.writeFileSync(output,JSON.stringify({timestamp:new Date().toISOString(),kind:'Case-related candidate AST inventory; every row needs service/query/serialization and runtime review',candidateServices:services,candidateModules:[...modules].sort(),routeCount:rows.length,rows},null,2)+'\n');
console.log(JSON.stringify({candidateServices:services.length,candidateModules:modules.size,routes:rows.length,status:'NOT_REVIEWED'}));
