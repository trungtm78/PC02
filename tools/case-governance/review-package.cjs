// Read-only source snapshot for task review, including files not yet committed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const task = process.argv[2];
if (!['t2', 't2-fix'].includes(task)) throw new Error('Only T2 packages are registered');
const evidence = path.join(root, 'docs/test-evidence/case-governance');
const pinned = JSON.parse(fs.readFileSync(path.join(evidence, task === 't2-fix' ? 't2-fix1-source-hashes.json' : 't2-source-hashes.json'), 'utf8'));
const files = Object.keys(pinned.sha256);
for (const file of files) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  if (actual !== pinned.sha256[file]) throw new Error(`Frozen source changed: ${file}`);
}
function git(argv, accepted = [0]) {
  const r = spawnSync('rtk', ['proxy', 'git', ...argv], { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (!accepted.includes(r.status)) throw new Error(r.stderr || r.error || `git exit ${r.status}`);
  return r.stdout;
}
const listed = git(['ls-files', '--others', '--exclude-standard']).trim().split(/\r?\n/);
const untracked = new Set(listed);
for (const file of listed) {
  if (file === 'backend/src/cases/case-canonical-fields.spec.ts' ||
      /^frontend\/src\/features\/cases\/__tests__\//.test(file) ||
      /^frontend\/src\/pages\/cases\/.*__tests__\//.test(file)) files.push(file);
}
files.push('frontend/src/pages/cases/CaseFormPage/__tests__/LegacyTabBody.test.tsx');
const unique = [...new Set(files)];
const outDir = path.join(root, '.superpowers/sdd/PLAN');
fs.mkdirSync(outDir, { recursive: true });
const empty = path.join(outDir, 'review-empty.txt');
if (!fs.existsSync(empty)) fs.writeFileSync(empty, '');
if (fs.statSync(empty).size !== 0) throw new Error('Review empty input is not empty');
const manifest = {};
let body = '# T2 read-only review package\n\nBaseline: 10030bed. Working-tree snapshot; no commits or index changes.\n\n';
for (const file of unique) {
  manifest[file] = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  body += `\n## ${file}\n\n`;
  const before = path.join(outDir, 't2-before', file);
  if (task === 't2-fix' && fs.existsSync(before)) {
    body += git(['diff', '--no-index', '-U10', '--', before, file], [0, 1]);
  } else {
    if (task === 't2-fix') body += 'New file or unsnapshotted test: diff against original branch baseline, rather than prior-review product snapshot.\n\n';
    body += untracked.has(file)
      ? git(['diff', '--no-index', '-U10', '--', empty, file], [0, 1])
      : git(['diff', '-U10', '10030bed', '--', file]);
  }
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join(outDir, `${task}-review-${stamp}.md`);
fs.writeFileSync(out, body);
fs.writeFileSync(out + '.sha256.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ task, fileCount: unique.length, reviewPackage: out, sourceHashes: out + '.sha256.json' }));
