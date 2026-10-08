const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
function git(args,accepted=[0]){const r=spawnSync('rtk',['proxy','git',...args],{cwd:root,encoding:'utf8',maxBuffer:30*1024*1024});if(!accepted.includes(r.status))throw new Error(r.stderr||'Git read failed');return r.stdout;}
const evidenceDir=path.join(root,'backend/src/cases/evidence-governance');
const files=fs.readdirSync(evidenceDir).filter(x=>x.endsWith('.ts')).map(x=>'backend/src/cases/evidence-governance/'+x);
for(const name of ['documents.service.ts','documents.service.spec.ts','documents.controller.ts','documents.controller.spec.ts','documents.module.ts','tep-hai-cha-tai-duoc.gate.spec.ts','document-governance.spec.ts','document-hydration.spec.ts','document-immutable-storage.ts','document-immutable-storage.spec.ts'])files.push('backend/src/documents/'+name);
files.push('backend/src/xlsx-imports/commit.service.ts','backend/src/xlsx-imports/commit.service.spec.ts','backend/src/legacy-migration/legacy-migration.service.ts','backend/src/legacy-migration/legacy-migration.service.spec.ts','backend/src/legacy-migration/cli/seed-ho-so-di-tru-mau.ts','backend/src/legacy-migration/cli/verify-backfill-parity.ts');
const untracked=new Set(git(['ls-files','--others','--exclude-standard']).split(/\r?\n/));
const out=path.join(root,'.superpowers/sdd/PLAN/t3-review-20261006.md'),manifest={};
let body='# T3 first read-only source review\n\nBaseline10030bed, uncommitted frozen T3 source. Product/test diff below; owned SHA256 in adjacent t3-review-20261006.md.sha256.json; no index/HEAD changes.\n';
for(const file of files){manifest[file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');body+='\n## '+file+'\n\n'+(untracked.has(file)?git(['diff','--no-index','-U10','--','.superpowers/sdd/PLAN/review-empty.txt',file],[0,1]):git(['diff','-U10','10030bed','--',file]));}
fs.writeFileSync(out,body);fs.writeFileSync(out+'.sha256.json',JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({files:files.length,package:out,hashes:out+'.sha256.json'}));
