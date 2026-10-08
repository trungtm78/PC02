/* Read-only SHA manifest for the T1a foundation freeze. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd();
const files=[
'backend/prisma/schema.prisma','backend/prisma/seed-permissions.ts','backend/prisma/seed.ts','backend/prisma/seed-quyen.ts',
...['20261006060000_case_governance','20261006073000_case_relation_disclosure_pin','20261006074500_case_principal_access_mode','20261006080000_case_receipt_custody_field_policy'].map(name=>'backend/prisma/migrations/'+name+'/migration.sql'),
...['case-governance.contract.ts','case-governance.contract.spec.ts','case-governance.service.ts','case-governance.service.spec.ts','case-governance.controller.ts','case-global-capabilities.controller.ts','case-governance.module.ts','case-governance-foundation.module.ts','case-field-policy.module.ts','case-principal-access.service.ts','case-principal-access.service.spec.ts','case-principal-access.controller.ts','foundation-integration.spec.ts','foundation.database.spec.ts','case-ordinary-test.fixture.ts','schema-contract.spec.ts'].map(name=>'backend/src/cases/governance/'+name),
...['cases.service.ts','cases.controller.ts','cases.module.ts','cases-journey.service.ts','case-statistic.builder.ts','case-statistic.builder.spec.ts','cases.service.spec.ts','cases.controller.spec.ts','cases-incident-prosecution.spec.ts','cases-journey.controller.spec.ts','cases-mot-where.spec.ts','cases-stats.service.spec.ts','cases-utdt-stats.service.spec.ts','cases-utdt.service.spec.ts','cases-vu-an-phuong.service.spec.ts','cases-xuat-danh-sach.spec.ts','cases.update-ban-ghi-con.spec.ts'].map(name=>'backend/src/cases/'+name),
'backend/src/cases/bulk/cases.bulk.service.ts','backend/src/cases/bulk/cases.bulk.service.spec.ts',
...['create-case.dto.ts','update-case.dto.ts','update-case.dto.spec.ts','query-cases.dto.ts','assign-case.dto.ts'].map(name=>'backend/src/cases/dto/'+name),
...['audit.service.ts','audit.controller.ts','audit.controller.spec.ts','audit.module.ts','case-audit-policy.service.ts','case-audit-policy.spec.ts'].map(name=>'backend/src/audit/'+name),
'backend/src/common/utils/scope-filter.util.ts','backend/src/common/utils/kiem-vu-an-cha.ts','backend/src/seed/case-governance-permissions.spec.ts'
];
const sha256=Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const result={baseline:'10030bed',frozenAt:new Date().toISOString(),status:'DONE_WITH_CONCERNS_NOT_T1_COMPLETE',files:files.length,sha256,excluded:'T1b/T2/T3/T4 products, source snapshots, loose SQL and one-off integration scripts; full CG release remains open.'};
fs.writeFileSync(path.join(root,'docs/test-evidence/case-governance/t1-foundation-source-hashes.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({frozenAt:result.frozenAt,files:files.length,status:result.status}));
