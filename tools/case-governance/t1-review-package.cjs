const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
function git(args,accepted=[0]){const r=spawnSync('rtk',['proxy','git',...args],{cwd:root,encoding:'utf8',maxBuffer:50*1024*1024});if(!accepted.includes(r.status))throw new Error(r.stderr||'Git read failed');return r.stdout;}
const pinned=JSON.parse(fs.readFileSync(path.join(root,'docs/test-evidence/case-governance/t1-core-finish-source-hashes.json'),'utf8'));
const files=Object.keys(pinned.sha256);
for(const file of files){const hash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');if(hash!==pinned.sha256[file])throw new Error('Core freeze changed: '+file);}
const sources=['legal-action.catalog','legal-action.validation','legal-workflow.validation','configuration.validation','case-configuration.service','legal-workflow.service','legal-workflow.controller','case-field-schema.service','case-native-field-policy','case-policy-search','case-operations.service','case-operations.controller','case-outbox.worker','split-allocation.service','case-deadline-effect'];
const specs=['legal-action.catalog','legal-action.validation','legal-workflow.validation','configuration.validation','case-configuration.service','legal-workflow.service','case-field-schema.service','case-operations.service','case-operations.filters','case-outbox.worker','case-outbox.retry','case-native-field-policy','case-policy-search','legal-action.capabilities','legal-relation-revision','legal-classification','legal-deadline-integration','legal-split-source','split-allocation.service','representation-policy-search','case-deadline-effect','legal-validation.boundaries','legal-workflow.private-db','legal-workflow.private-http'];
for(const name of sources)files.push('backend/src/cases/governance/'+name+'.ts');
for(const name of specs)files.push('backend/src/cases/governance/'+name+'.spec.ts');
const untracked=new Set(git(['ls-files','--others','--exclude-standard']).split(/\r?\n/)),manifest={};
const out=path.join(root,'.superpowers/sdd/PLAN/t1-review-20261006.md');
let body='# T1 core/legal/deadline first independent review package\n\nBaseline10030bed; frozen uncommitted source. Adjacent .sha256.json identifies exact files. No index/HEAD mutations.\n';
for(const file of [...new Set(files)]){manifest[file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');body+='\n## '+file+'\n\n'+(untracked.has(file)?git(['diff','--no-index','-U10','--','.superpowers/sdd/PLAN/review-empty.txt',file],[0,1]):git(['diff','-U10','10030bed','--',file]));}
fs.writeFileSync(out,body);fs.writeFileSync(out+'.sha256.json',JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({files:Object.keys(manifest).length,package:out,hashes:out+'.sha256.json'}));
