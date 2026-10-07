const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const root = path.resolve(__dirname,'../../..');
const owned = [
  'admin/admin.service.ts','admin/case-authority.guard.ts','admin/bulk/bulk-import.service.ts','admin/bulk/bulk-import.processor.ts','auth/services/enrollment.service.ts',
  'subjects/subjects.service.ts','lawyers/lawyers.service.ts','conclusions/conclusions.service.ts','investigation-supplements/investigation-supplements.service.ts',
  'case-child-access/case-child-access.service.ts','case-child-access/case-source-creation.service.ts',
  'cases/governance/case-field-schema.service.ts','cases/governance/legal-action.validation.ts','cases/governance/case-operations.service.ts','cases/governance/case-civil-day.ts',
  'incidents/incidents.service.ts','petitions/petitions.service.ts',
  'subjects/bulk/subjects.bulk.service.ts','lawyers/bulk/lawyers.bulk.service.ts',
  'incidents/bulk/incidents.bulk.service.ts','petitions/bulk/petitions.bulk.service.ts',
  'proposals/proposals.service.ts','delegations/delegations.service.ts','case-child-access/case-graph.interceptor.ts',
  'cases/cases.service.ts','cases/bulk/cases.bulk.service.ts',
  'incidents/dto/prosecute-incident.dto.ts','petitions/dto/convert-case.dto.ts',
  ...['subjects','lawyers','conclusions','investigation-supplements','proposals','delegations','incidents','petitions'].flatMap(module => [`${module}/${module}.controller.ts`,`${module}/${module}.module.ts`]),
  'case-child-access/case-child-access.module.ts',
];
const baselineOverrides = {
  'cases/governance/case-field-schema.service.ts': '.superpowers/sdd/PLAN/field-required-before/case-field-schema.service.ts',
  'cases/governance/legal-action.validation.ts': '.superpowers/sdd/PLAN/t1-confirmed-before/backend/src/cases/governance/legal-action.validation.ts',
  'cases/governance/case-operations.service.ts': '.superpowers/sdd/PLAN/civil-overdue-before/backend/src/cases/governance/case-operations.service.ts',
  'cases/cases.service.ts': '.superpowers/sdd/PLAN/civil-overdue-before/backend/src/cases/cases.service.ts',
  'cases/bulk/cases.bulk.service.ts': '.superpowers/sdd/PLAN/bulk-assignment-before/backend/src/cases/bulk/cases.bulk.service.ts',
};
module.exports.owned = owned;
if (process.argv.includes('--paths')) { console.log(JSON.stringify(owned)); process.exit(0); }
const coverageFile = path.join(root,'backend/docs/test-evidence/case-governance/child-coverage/coverage-final.json');
const coverage = JSON.parse(fs.readFileSync(coverageFile,'utf8'));
fs.copyFileSync(coverageFile,path.join(__dirname,'child-coverage-final.json'));
const baselineDir = path.join(root,'.superpowers/sdd/PLAN/child-measure-baselines');
fs.mkdirSync(baselineDir,{ recursive: true });
const rows = [];
for (const relative of owned) {
  const file = 'backend/src/' + relative, currentPath = path.join(root,file);
  const baselinePath = path.join(baselineDir,relative.replaceAll('/','__'));
  let baseline;
  if (baselineOverrides[relative]) baseline = fs.readFileSync(path.join(root,baselineOverrides[relative]),'utf8');
  else {
    const result = cp.spawnSync('rtk',['proxy','git','show','10030bed:' + file],{ cwd: root,encoding: 'utf8',windowsHide: true });
    baseline = result.status === 0 ? result.stdout.replace(/^\[rtk\].*\r?\n/,'') : '';
  }
  fs.writeFileSync(baselinePath,baseline);
  const diff = cp.spawnSync('rtk',['proxy','git','diff','--no-index','--unified=0','--',baselinePath,currentPath],{ cwd: root,encoding:'utf8',windowsHide:true });
  const changed = new Set(); let line;
  for (const text of diff.stdout.split(/\r?\n/)) {
    const hunk = text.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { line = Number(hunk[1]); continue; }
    if (line === undefined || text.startsWith('+++')) continue;
    if (text.startsWith('+')) { changed.add(line); line++; }
    else if (!text.startsWith('-') && !text.startsWith('\\')) line++;
  }
  const item = Object.entries(coverage).find(([key]) => path.resolve(key).toLowerCase() === path.resolve(currentPath).toLowerCase())?.[1];
  if (!item) { rows.push({ file,missingCoverage:true }); continue; }
  const executable = new Map();
  for (const [id,statement] of Object.entries(item.statementMap)) {
    const at = statement.start.line;
    if (changed.has(at)) executable.set(at,(executable.get(at)??false)||item.s[id]>0);
  }
  const outcomes = Object.entries(item.branchMap).flatMap(([id,branch]) => changed.has(branch.loc.start.line) ? item.b[id] : []);
  rows.push({ file,baseline:baselineOverrides[relative]??'10030bed (empty for new file)',sha256:crypto.createHash('sha256').update(fs.readFileSync(currentPath)).digest('hex'), changedLines:[...changed].sort((a,b)=>a-b), executableChangedLines:executable.size,coveredExecutableChangedLines:[...executable.values()].filter(Boolean).length,changedBranchOutcomes:outcomes.length,coveredChangedBranchOutcomes:outcomes.filter(value=>value>0).length,uncoveredExecutableLines:[...executable].filter(([,covered])=>!covered).map(([at])=>at) });
}
const total = rows.reduce((sum,row)=>({ executable:sum.executable+(row.executableChangedLines??0),covered:sum.covered+(row.coveredExecutableChangedLines??0),branches:sum.branches+(row.changedBranchOutcomes??0),coveredBranches:sum.coveredBranches+(row.coveredChangedBranchOutcomes??0) }),{ executable:0,covered:0,branches:0,coveredBranches:0 });
const result = { timestamp:new Date().toISOString(),status:'FROZEN_IMPLEMENTATION_PENDING_INDEPENDENT_REVIEW_AND_UAT',method:'Istanbul executable statement start lines intersecting exact owned baseline added hunks; all 45 owned/transferred product files included. Transferred files use root before-fix snapshots. No uncovered executable-file exclusions.',...total,linePercent:100*total.covered/total.executable,branchPercent:100*total.coveredBranches/total.branches,rows };
fs.writeFileSync(path.join(__dirname,'child-patch-coverage.json'),JSON.stringify(result,null,2));
fs.writeFileSync(path.join(__dirname,'child-source-hashes.json'),JSON.stringify({timestamp:result.timestamp,status:result.status,rows:rows.map(({file,sha256})=>({file,sha256}))},null,2));
console.log(JSON.stringify({ timestamp:result.timestamp,...total,linePercent:result.linePercent,branchPercent:result.branchPercent,missing:rows.filter(row=>row.missingCoverage).map(row=>row.file) }));
