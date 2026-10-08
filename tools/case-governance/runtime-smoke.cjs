const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const runtime = path.resolve(process.env.CASE_UAT_RUNTIME || '');
assert.ok(runtime.includes('pc02-incident-uat-'));
const fixture = JSON.parse(fs.readFileSync(path.join(runtime, 'case-browser-fixture.json'), 'utf8'));
assert.equal(fixture.synthetic, true); assert.equal(fixture.database, 'pc02_case_governance_uat');
assert.equal(fixture.api, 'http://127.0.0.1:3001/api/v1');
async function main() {
  const checks = [
    ['health', '/health', null, [200]],
    ['current-auth-profile', '/auth/me', 'author', [200]],
    ['normal-detail', '/cases/' + fixture.cases.normal.id, 'readonly', [200]],
    ['restricted-denied', '/cases/' + fixture.cases.restricted.id, 'readonly', [403,404]],
    ['restricted-authorized', '/cases/' + fixture.cases.restricted.id, 'author', [200]],
    ['governance-route', '/cases/' + fixture.cases.normal.id + '/governance', 'author', [200]],
    ['capabilities-route', '/cases/' + fixture.cases.normal.id + '/capabilities', 'author', [200]],
    ['catalog-route', '/cases/governance/catalog', 'author', [200]],
    ['evidence-route', '/cases/' + fixture.cases.normal.id + '/evidence-governance', 'author', [200]],
    ['inactive-token-denied', '/cases/' + fixture.cases.normal.id, 'inactive', [401]],
    ['frontend-shell', fixture.frontend + '/cases/' + fixture.cases.normal.id, null, [200]]
  ];
  const results = [];
  for (const [id, route, actor, statuses] of checks) {
    const started = Date.now();
    const response = await fetch(route.startsWith('http') ? route : fixture.api + route, { headers: actor ? { Authorization: 'Bearer ' + fixture.actors[actor].accessToken } : {}, signal: AbortSignal.timeout(20000) });
    await response.arrayBuffer();
    results.push({ id, status: response.status, expected: statuses, elapsedMs: Date.now() - started, passed: statuses.includes(response.status) });
  }
  const report = { timestamp: new Date().toISOString(), kind: 'Technical local runtime smoke, not full UAT or final source certification', host: '127.0.0.1', synthetic: true, results, verdict: results.every(r => r.passed) ? 'PASS' : 'FAIL' };
  fs.writeFileSync(path.join(root, 'docs/test-evidence/case-governance/private-db/runtime-smoke.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report)); if (report.verdict !== 'PASS') process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
