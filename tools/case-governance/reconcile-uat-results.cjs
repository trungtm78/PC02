const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const planPath = path.join(root, 'docs/uat/case-governance/uat-plan.json');
const evidencePath = 'docs/test-evidence/case-governance/private-db/field-api-stage.json';
const evidence = JSON.parse(fs.readFileSync(path.join(root, evidencePath), 'utf8'));
assert.equal(evidence.verdict, 'API_STAGE_PASS_NOT_FULL_UAT');
assert.equal(evidence.results.length, 132);
assert.ok(evidence.results.every((item) => item.status === 'PASS'));
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
// API lifecycle evidence is useful regression evidence, but it does not prove
// the required UI/detail/export/history acceptance paths. Keep those cases
// NOT_RUN until their complete UAT oracle has been executed.
for (const testCase of plan.cases) {
  if (/(?:-EDIT|-CLEAR|-CLONE)$/.test(testCase.id)) {
    testCase.status = 'NOT_RUN';
    delete testCase.actual;
    delete testCase.evidence;
  }
}
const resultById = new Map(evidence.results.map((item) => [item.id, item]));
let updated = 0;
for (const testCase of plan.cases) {
  const result = resultById.get(testCase.id);
  if (!result) continue;
  testCase.status = 'PASS';
  testCase.actual = `Typed value persisted and reloaded through compiled loopback API for field ${result.field}.`;
  testCase.evidence = [evidencePath];
  updated++;
}
assert.equal(updated, 132);
fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n');
const counts = plan.cases.reduce((all, item) => ({ ...all, [item.status]: (all[item.status] || 0) + 1 }), {});
console.log(JSON.stringify({ updated, counts, total: plan.cases.length }));
