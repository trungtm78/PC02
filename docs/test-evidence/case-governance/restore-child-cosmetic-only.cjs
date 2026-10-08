const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),ts=require(path.join(root,'backend/node_modules/typescript')),prettier=require(path.join(root,'backend/node_modules/prettier'));
async function run(){
 const query=cp.spawnSync('rtk',['proxy','node',path.join(__dirname,'measure-child-checkpoint.cjs'),'--paths'],{cwd:root,encoding:'utf8',windowsHide:true});
 const owned=JSON.parse(query.stdout.replace(/^\[rtk\].*\r?\n/,''));
 let restored=0;
 for(const relative of owned){
  const baselinePath=path.join(root,'.superpowers/sdd/PLAN/child-measure-baselines',relative.replaceAll('/','__'));
  const baseline=fs.readFileSync(baselinePath,'utf8');if(!baseline)continue;
  const target=path.join(root,'backend/src',relative),current=fs.readFileSync(target,'utf8');
  const oldAst=ts.createSourceFile(relative,baseline,ts.ScriptTarget.Latest,true),newAst=ts.createSourceFile(relative,current,ts.ScriptTarget.Latest,true),edits=[];
  const format=fragment=>prettier.format(fragment,{parser:'typescript'});
  const classes=ast=>ast.statements.filter(ts.isClassDeclaration);
  for(const cls of classes(newAst)){
   const old=classes(oldAst).find(c=>c.name?.text===cls.name?.text);if(!old)continue;
   for(const member of cls.members){
    const name=member.name?.getText(newAst)??(ts.isConstructorDeclaration(member)?'constructor':null);if(!name)continue;
    const prior=old.members.find(m=>(m.name?.getText(oldAst)??(ts.isConstructorDeclaration(m)?'constructor':null))===name);if(!prior)continue;
    const a=prior.getText(oldAst),b=member.getText(newAst);if(a===b)continue;
    if(await format('class Test {\n'+a+'\n}')===await format('class Test {\n'+b+'\n}')){edits.push({start:member.getStart(newAst),end:member.end,text:a});restored++;}
   }
  }
  let result=current;for(const edit of edits.sort((a,b)=>b.start-a.start))result=result.slice(0,edit.start)+edit.text+result.slice(edit.end);
  fs.writeFileSync(target,result);
 }
 console.log(JSON.stringify({restoredFormattingEquivalentUnchangedMembers:restored}));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
