const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const packageFile='.superpowers/sdd/PLAN/t1-review-20261006.md';
const manifest=JSON.parse(fs.readFileSync(path.join(root,packageFile+'.sha256.json'),'utf8'));
const body=fs.readFileSync(path.join(root,packageFile),'utf8');
const sections=new Map(body.split(/\n## /).slice(1).map(x=>[x.slice(0,x.indexOf('\n')), '\n## '+x]));
const groups={core:[],read:[],legal:[],policy:[]};
for(const file of Object.keys(manifest)){
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),manifest[file],file+' changed after freeze');
 assert.ok(sections.has(file),file+' absent from diff');
 let group='core';
 if(/\/(audit|common|seed)\/|seed[^/]*\.ts$|cases-(mot-where|stats|utdt|vu-an-phuong|xuat-danh-sach)/.test(file))group='read';
 if(/\/(legal-|split-allocation|case-deadline-effect)/.test(file))group='legal';
 if(/\/(configuration\.validation|case-configuration|case-field-schema|case-native-field-policy|case-policy-search|case-operations|case-outbox|representation-policy-search)/.test(file))group='policy';
 groups[group].push(file);
}
const documents=['docs/requirements/BRD.md','docs/requirements/FRD.md','docs/requirements/acceptance-criteria.md','docs/architecture/CASE_GOVERNANCE.md','docs/plans/PLAN.md','docs/test-evidence/case-governance/t1-core-finish.md','docs/test-evidence/case-governance/t1b-workflows.md'];
const commonFiles=['backend/src/cases/governance/case-governance.service.ts','backend/src/cases/governance/case-field-schema.service.ts','backend/src/cases/governance/case-native-field-policy.ts','backend/src/common/utils/scope-filter.util.ts','backend/src/cases/governance/case-policy-search.ts','backend/src/cases/governance/case-governance.contract.ts','backend/prisma/schema.prisma'];
for(const [group,primary] of Object.entries(groups)){
 const files=[...new Set([...primary,...commonFiles])];
 let prompt=`Perform an independent FIRST READ-ONLY source review of T1 group ${group}. ALL required source diff, requirements and evidence are INCLUDED BELOW. DO NOT invoke tools, shell, MCP, skills discovery, agents, network, filesystem operations or tests: the Windows read-only execution policy blocks subprocesses, so this is a text-only review. No need to read any files; complete review directly from the inline content. Never edit code or manufacture PASS. The host verified every source SHA256 against the frozen 99-file package before supplying this input. You did not independently execute hashchecks or tests; disclose that limitation. Other three groups are reviewed separately; do not claim whole T1 approved. Full scope is retained; check concrete logic, rights/scope/current principal, concurrency, transaction, idempotency, field inference, lifecycle, legal dates, deadlines, approvals, history, query/export and test oracles. Shared dependencies are included to reason about call boundaries. Report SPEC PASS/FAIL, QUALITY PASS/FAIL; strengths; BLOCKER/MAJOR/MINOR findings with stable ID T1-${group}-R1 etc, exact source file and diff new-line reference, actual defect/impact/proof/closure conditions. Distinguish confirmed findings from unverifiable cross-task/runtime risks. No findings should rely on implementer claims alone. User approved implementation plus autonomous fixing, but this pass only reports findings BEFORE fixes. Human production GO, full JWT UAT, child/evidence/UI integration remain separate gates. No scope reduction. Coverage gate >=90% executable patch lines, do not invent branch gate. Partial legacy dates must never become verified decisions. All21 legacy actions and132 fields remain.\n\nPrimary files in this group:\n${primary.join('\n')}\n\n`;
 for(const file of documents)prompt+='\n## DOCUMENT '+file+'\n'+fs.readFileSync(path.join(root,file),'utf8');
 prompt+='\n## REVIEW DISCIPLINE\nFirst review is read-only. Judge original requirements before existing behavior; do not trust reports. Look for missing or misinterpreted requirements, transaction/concurrency/ACL bugs, invalid authority/data flow, privacy via query/count/export/audit, weak assertions and evidence gaps. Findings require evidence and closure condition. Do not run/recommend blanket suite repetition merely to confirm reported results. Frozen baseline10030bed; no Case commit or deployment. Diff context is source; additions use +line. Independent text review cannot certify actual JWT/runtime/legal publication.\n';
 for(const file of files)prompt+=sections.get(file);
 const output='.superpowers/sdd/PLAN/t1-inline-'+group+'.md';fs.writeFileSync(path.join(root,output),prompt);
 console.log(JSON.stringify({group,primary:primary.length,withDependencies:files.length,bytes:Buffer.byteLength(prompt),prompt:output,sha256:crypto.createHash('sha256').update(prompt).digest('hex')}));
}
assert.equal(Object.values(groups).flat().length,Object.keys(manifest).length);
