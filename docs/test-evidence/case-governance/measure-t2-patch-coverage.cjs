/* Reproducible changed-executable-line/branch coverage; no product edits. */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const root = process.cwd();
const evidence = path.join(root, 'docs/test-evidence/case-governance');
const manifest = JSON.parse(fs.readFileSync(path.join(evidence, 't2-fix1-source-hashes.json'), 'utf8'));
const coverage = Object.assign({}, ...['t2-fix1-frontend-coverage', 't2-fix1-backend-coverage'].map(directory => JSON.parse(fs.readFileSync(path.join(evidence, directory, 'coverage-final.json'), 'utf8'))));
const normalized = value => value.replace(/\\/g, '/').toLowerCase();
const command = args => cp.execFileSync('rtk', ['proxy', 'git', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const intersects = (location, changed) => {
  for (let line = location.start.line; line <= location.end.line; line++) if (changed.has(line)) return true;
  return false;
};
const rows = [];
for (const filename of Object.keys(manifest.sha256)) {
  const actual = path.join(root, filename);
  const record = Object.entries(coverage).find(([key]) => normalized(key) === normalized(actual))?.[1];
  if (!record) throw new Error(`Missing owned-product coverage: ${filename}`);
  let existsAtBaseline = true;
  try { command(['cat-file', '-e', `10030bed:${filename}`]); } catch { existsAtBaseline = false; }
  const changed = new Set();
  if (!existsAtBaseline) fs.readFileSync(actual, 'utf8').split('\n').forEach((_, index) => changed.add(index + 1));
  else {
    const diff = command(['diff', '--no-color', '--unified=0', '10030bed', '--', filename]);
    for (const match of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
      const start = Number(match[1]), count = match[2] === undefined ? 1 : Number(match[2]);
      for (let offset = 0; offset < count; offset++) changed.add(start + offset);
    }
  }
  // Standard Istanbul line coverage: statement start lines, with their max hit count.
  const lines = new Map();
  for (const [id, location] of Object.entries(record.statementMap)) {
    const line = location.start.line;
    if (changed.has(line)) lines.set(line, Math.max(lines.get(line) ?? 0, record.s[id]));
  }
  const branchHits = [];
  for (const [id, branch] of Object.entries(record.branchMap)) {
    if (intersects(branch.loc, changed)) branchHits.push(...record.b[id]);
  }
  const counts = Array.from(lines.values());
  rows.push({ filename, addedFile: !existsAtBaseline, changedLines: changed.size,
    executableLines: counts.length, coveredLines: counts.filter(value => value > 0).length,
    changedBranchOutcomes: branchHits.length, coveredBranchOutcomes: branchHits.filter(value => value > 0).length,
    uncoveredLines: Array.from(lines).filter(([, count]) => count === 0).map(([line]) => line) });
}
const total = rows.reduce((sum, row) => {
  for (const key of ['executableLines', 'coveredLines', 'changedBranchOutcomes', 'coveredBranchOutcomes']) sum[key] += row[key];
  return sum;
}, { executableLines: 0, coveredLines: 0, changedBranchOutcomes: 0, coveredBranchOutcomes: 0 });
total.lineCoverage = total.executableLines ? 100 * total.coveredLines / total.executableLines : 100;
total.branchCoverage = total.changedBranchOutcomes ? 100 * total.coveredBranchOutcomes / total.changedBranchOutcomes : 100;
const result = { baseline: '10030bed', measuredAt: new Date().toISOString(), method: 'All 14 owned products; new files fully included, tracked files git hunks; Istanbul executable statement-start lines and intersecting changed branch outcomes. Unchanged existing code is not patch coverage.', total, rows };
fs.writeFileSync(path.join(evidence, 't2-fix1-patch-coverage.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
