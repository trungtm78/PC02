const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/test-evidence/case-governance/child-review-impact-manifest.json'),'utf8').trimStart());
function git(args){const result=spawnSync('rtk',['proxy','git',...args],{cwd:root,encoding:'utf8',maxBuffer:50*1024*1024});assert.ok([0,1].includes(result.status),'Read-only git diff failed');return result.stdout;}
const untracked=new Set(git(['ls-files','--others','--exclude-standard']).split(/\r?\n/));
let body='# Child/source/account/scope final first read-only review package\n\n45 products +79 tests/fixtures. Every current source SHA checked; baseline10030bed unless bounded transfer before snapshot exists. No index/HEAD mutations.\n';
for(const row of manifest.rows){const current=path.join(root,row.file);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(current)).digest('hex'),row.sha256,row.file);
 const bases=['.superpowers/sdd/PLAN/civil-overdue-before','.superpowers/sdd/PLAN/bulk-assignment-before','.superpowers/sdd/PLAN/t1-confirmed-before'].map(dir=>path.join(root,dir,row.file));
 if(row.file.includes('case-field-schema.service'))bases.unshift(path.join(root,'.superpowers/sdd/PLAN/field-required-before',path.basename(row.file)));
 const before=bases.find(file=>fs.existsSync(file));
 const diff=before?git(['diff','--no-index','-U8','--',before,current]):untracked.has(row.file)?git(['diff','--no-index','-U8','--','.superpowers/sdd/PLAN/review-empty.txt',row.file]):git(['diff','-U8','10030bed','--',row.file]);
 if(diff.includes('@@'))body+='\n## '+row.kind+' '+row.file+'\n'+diff;
}
const output='.superpowers/sdd/PLAN/child-final-review.md';fs.writeFileSync(path.join(root,output),body);console.log(JSON.stringify({products:manifest.productCount,tests:manifest.testFixtureCount,bytes:Buffer.byteLength(body),file:output,sha256:crypto.createHash('sha256').update(body).digest('hex')}));
