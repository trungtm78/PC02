const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const files=JSON.parse(fs.readFileSync(path.join(root,'docs/test-evidence/case-governance/t3-final-source.sha256.json'),'utf8').trimStart());
const empty=path.join(root,'.superpowers/sdd/PLAN/review-empty.txt');assert.equal(fs.statSync(empty).size,0);
let output='# Combined T3 R1–R4 + core sensitivity/relation scoped re-review\n\nExact43 current hashes verified by host. Before snapshots immutable; added files diff against empty. No index mutations.\n';
for(const file of files){const current=path.join(root,file.path),bytes=fs.readFileSync(current);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),file.sha256,file.path);
 const candidates=['.superpowers/sdd/PLAN/t3-before','.superpowers/sdd/PLAN/t1-confirmed-before'].map(p=>path.join(root,p,file.path));
 const before=candidates.find(p=>fs.existsSync(p))||empty;
 const result=spawnSync('rtk',['proxy','git','diff','--no-index','-U8','--',before,current],{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});assert.ok([0,1].includes(result.status),file.path+' diff failed');
 if(result.stdout.includes('@@'))output+='\n## '+file.path+'\n'+result.stdout;
}
const file='.superpowers/sdd/PLAN/t3-combined-fix-review.md';fs.writeFileSync(path.join(root,file),output);console.log(JSON.stringify({files:files.length,bytes:Buffer.byteLength(output),package:file,sha256:crypto.createHash('sha256').update(output).digest('hex')}));
