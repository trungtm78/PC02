#!/usr/bin/env node
/**
 * Lint ratchet.
 *
 * Linting the whole repo is not actionable today: the backend alone reports
 * ~8.5k problems, accumulated because CI never invoked eslint at all. Gating
 * on that would block every PR on unrelated cleanup, and a gate people have to
 * disable is worse than no gate.
 *
 * So the rule is monotonic rather than absolute: a file this branch touches
 * may not carry MORE problems than the recorded baseline. New files must be
 * clean. The debt can shrink, never grow.
 *
 * Usage:
 *   node scripts/governance/lint-changed.cjs [baseRef]
 *   node scripts/governance/lint-changed.cjs --write-baseline   # full-repo rescan
 *
 * baseRef defaults to origin/main, then main, then HEAD~1.
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const BASELINE_PATH = path.join(__dirname, 'lint-baseline.json');

/** Workspaces with their own eslint config. */
const WORKSPACES = [
  { prefix: 'backend/', dir: path.join(REPO_ROOT, 'backend'), scan: ['src', 'test'] },
  { prefix: 'frontend/', dir: path.join(REPO_ROOT, 'frontend'), scan: ['src'] },
];

/**
 * Resolve eslint's JS entry point and run it with the current node binary.
 *
 * Not `npx`: Node 24 on Windows refuses to spawn `.cmd` files without
 * `shell: true` (CVE-2024-27980), and enabling the shell would mean quoting
 * every path by hand. Calling the entry script directly sidesteps both.
 */
function eslintBin(wsDir) {
  const candidates = [
    path.join(wsDir, 'node_modules', 'eslint', 'bin', 'eslint.js'),
    path.join(REPO_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js'),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error(
      `eslint not found for ${wsDir} — run npm ci in that workspace first.`,
    );
  }
  return found;
}

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function resolveBaseRef(explicit) {
  for (const ref of explicit ? [explicit] : ['origin/main', 'main', 'HEAD~1']) {
    try {
      git(['rev-parse', '--verify', `${ref}^{commit}`]);
      return ref;
    } catch {
      /* try next */
    }
  }
  return null;
}

function changedFiles(baseRef) {
  let base;
  try {
    base = git(['merge-base', baseRef, 'HEAD']);
  } catch {
    base = baseRef;
  }
  const sets = [
    git(['diff', '--name-only', '--diff-filter=ACMR', base, 'HEAD']),
    git(['diff', '--name-only', '--diff-filter=ACMR', '--cached']),
    git(['diff', '--name-only', '--diff-filter=ACMR']),
  ];
  return [...new Set(sets.join('\n').split('\n'))].map((f) => f.trim()).filter(Boolean);
}

/**
 * Problem count per repo-relative path. Counts errors AND warnings: the gate
 * is "do not make this file worse", and a warning left to rot becomes an error
 * the next time the config tightens.
 */
function lintCounts(ws, targets) {
  if (targets.length === 0) return {};
  const res = spawnSync(
    process.execPath,
    [eslintBin(ws.dir), '--format', 'json', ...targets],
    { cwd: ws.dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const raw = (res.stdout || '').trim();
  if (!raw) return {};
  const counts = {};
  for (const entry of JSON.parse(raw)) {
    const rel = path
      .relative(REPO_ROOT, entry.filePath)
      .replace(/\\/g, '/');
    counts[rel] = entry.errorCount + entry.warningCount;
  }
  return counts;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return {};
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).files ?? {};
}

function writeBaseline() {
  const files = {};
  for (const ws of WORKSPACES) {
    Object.assign(files, lintCounts(ws, ws.scan));
  }
  const withProblems = Object.fromEntries(
    Object.entries(files)
      .filter(([, n]) => n > 0)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
  fs.writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify(
      {
        note: 'Per-file eslint problem counts (errors + warnings). Ratchet: a touched file may not exceed its entry; files absent here must be clean. Regenerate only to record improvements.',
        generatedFrom: 'scripts/governance/lint-changed.cjs --write-baseline',
        totalProblems: Object.values(withProblems).reduce((a, b) => a + b, 0),
        files: withProblems,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `Lint baseline written: ${Object.keys(withProblems).length} file(s), ` +
      `${Object.values(withProblems).reduce((a, b) => a + b, 0)} problem(s).`,
  );
}

function main() {
  if (process.argv.includes('--write-baseline')) return writeBaseline();

  const baseRef = resolveBaseRef(process.argv[2]);
  if (!baseRef) {
    console.log('Lint ratchet: no base ref to compare against — skipping.');
    return;
  }

  const changed = changedFiles(baseRef).filter(
    (f) => /\.(ts|tsx)$/.test(f) && fs.existsSync(path.join(REPO_ROOT, f)),
  );
  if (changed.length === 0) {
    console.log(`Lint ratchet: no TypeScript changes vs ${baseRef}.`);
    return;
  }

  const baseline = loadBaseline();
  const current = {};
  for (const ws of WORKSPACES) {
    const owned = changed
      .filter((f) => f.startsWith(ws.prefix))
      .map((f) => f.slice(ws.prefix.length));
    Object.assign(current, lintCounts(ws, owned));
  }

  const worse = [];
  const better = [];
  for (const file of changed) {
    const now = current[file] ?? 0;
    const was = baseline[file] ?? 0;
    if (now > was) worse.push({ file, now, was });
    else if (now < was) better.push({ file, now, was });
  }

  if (worse.length > 0) {
    console.error('Lint ratchet: these files got worse\n');
    for (const w of worse) {
      console.error(`  ${w.file}: ${w.was} → ${w.now} problem(s)`);
    }
    console.error(
      '\nFix the new problems (most formatting ones: npx eslint --fix <file>).\n' +
        'Pre-existing debt elsewhere is not your problem, but a file this branch touches\n' +
        'must not carry more than it already did.',
    );
    process.exit(1);
  }

  console.log(
    `Lint ratchet: ${changed.length} changed file(s), none worse than baseline.`,
  );
  if (better.length > 0) {
    const removed = better.reduce((a, b) => a + (b.was - b.now), 0);
    console.log(
      `${removed} problem(s) removed across ${better.length} file(s) — ` +
        'run --write-baseline to tighten the ratchet.',
    );
  }
}

if (require.main === module) main();

module.exports = { resolveBaseRef, changedFiles, lintCounts, WORKSPACES };
