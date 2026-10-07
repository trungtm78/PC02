/* Preserve predecessor manifest; check applied 128-131 checksums before freeze. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),evidence=path.join(root,'docs/test-evidence/case-governance');
const previous=JSON.parse(fs.readFileSync(path.join(evidence,'t1-foundation-source-hashes.json'),'utf8'));
const files=[...Object.keys(previous.sha256),'backend/src/common/bca-excel.helper.ts','backend/src/common/bca-excel-footer.spec.ts','backend/prisma/migrations/20261006083000_case_disposition_receipt_pin/migration.sql'];
const sha256=Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
for(const file of Object.keys(previous.sha256).filter(file=>file.includes('/migrations/')))
  if(previous.sha256[file]!==sha256[file])throw new Error('Applied migration checksum changed: '+file);
if(sha256['backend/prisma/migrations/20261006083000_case_disposition_receipt_pin/migration.sql']!=='919dd540b29168a072ea0b92575afdb718357412c557a735c57a7e0d073b503e')throw new Error('Applied migration 132 checksum changed');
const result={baseline:previous.baseline,frozenAt:new Date().toISOString(),status:'CORE_IMPLEMENTATION_FROZEN_AWAITING_INDEPENDENT_REVIEW_NOT_T1_COMPLETE',files:files.length,sha256,changesSinceFoundationFreeze:files.filter(file=>previous.sha256[file]!==sha256[file]),migration128Through131Unchanged:true,excluded:'Other writers T1b/T2/T3/T4 and child/admin/auth products; offline schema snapshot/config and private runner scripts are test tooling, not release sources.'};
fs.writeFileSync(path.join(evidence,'t1-core-finish-source-hashes.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({frozenAt:result.frozenAt,files:result.files,changesSinceFoundationFreeze:result.changesSinceFoundationFreeze,migration128Through131Unchanged:true}));
