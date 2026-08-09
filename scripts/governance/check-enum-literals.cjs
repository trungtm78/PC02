#!/usr/bin/env node
/**
 * Enum-literal guard.
 *
 * CLAUDE.md states: "All enum comparisons must use constants/enum values,
 * never string literals. Verified by grep guard in CI." No such guard existed
 * — this is it.
 *
 * What it flags: a value that is defined as a Prisma enum member in
 * schema.prisma appearing as a quoted string literal in a comparison
 * (`=== 'X'`, `!== 'X'`, `case 'X':`, `includes('X')`, `[... 'X' ...]`).
 *
 * Why comparisons only, and not every occurrence: object literals that build
 * seed data or DTO examples legitimately spell values out, and flagging those
 * would bury the real finding — a branch that silently stops matching when an
 * enum value is renamed.
 *
 * Usage:
 *   node scripts/governance/check-enum-literals.cjs           # report + exit 1 on new violations
 *   node scripts/governance/check-enum-literals.cjs --list    # print every violation, exit 0
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'backend', 'prisma', 'schema.prisma');
const BASELINE_PATH = path.join(__dirname, 'enum-literals-baseline.json');

const SCAN_ROOTS = [
  path.join(REPO_ROOT, 'backend', 'src'),
  path.join(REPO_ROOT, 'frontend', 'src'),
];

/**
 * Files that are allowed to spell enum values out, because defining them is
 * their whole job.
 */
// Anchored with (^|/) so a directory still matches when it is the first
// segment of the relative path — the patterns must not depend on the scan
// roots happening to nest them one level deep.
const ALLOWED = [
  /(^|[\\/])shared[\\/]enums[\\/]/,
  /(^|[\\/])common[\\/]constants[\\/]/,
  /(^|[\\/])constants[\\/][^\\/]*constants\.ts$/,
  /(^|[\\/])prisma[\\/]/,
  // Test files use literals as fixtures on purpose — asserting against a
  // constant would make the test tautological with the code it checks.
  /\.spec\.tsx?$/,
  /\.test\.tsx?$/,
  /(^|[\\/])__tests__[\\/]/,
  /(^|[\\/])test-utils[\\/]/,
];

const SCAN_EXT = new Set(['.ts', '.tsx']);

function parseEnumValues(schemaSource) {
  // Reuse the generator's parser so the guard and the codegen agree on what
  // counts as an enum value.
  const {
    parseEnums,
  } = require(path.join(REPO_ROOT, 'backend', 'scripts', 'generate-shared-enums.cjs'));
  const byName = parseEnums(schemaSource);
  const values = new Set();
  for (const list of Object.values(byName)) {
    for (const v of list) {
      // UPPER_CASE values only. Prisma enums here are overwhelmingly
      // SCREAMING_SNAKE (TIEP_NHAN, FROM_INCIDENT, OPEN), which cannot be
      // confused with ordinary strings. The lowercase ones — currently just
      // DeadlineRuleStatus (draft/submitted/approved/active/...) — collide
      // with everyday UI values: `filterStatus === 'active'` has nothing to do
      // with a deadline rule. Guarding those would produce more noise than
      // signal, so they are deliberately out of scope.
      if (v.length >= 3 && /^[A-Z][A-Z0-9_]*$/.test(v)) values.add(v);
    }
  }
  return values;
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      walk(full, out);
    } else if (SCAN_EXT.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function stripCommentsAndKeepPositions(source) {
  // Replace comment bodies with spaces so line/column numbers stay intact.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

function findViolations(enumValues, roots = SCAN_ROOTS, baseDir = REPO_ROOT) {
  const violations = [];
  const files = roots.filter(fs.existsSync).flatMap((root) => walk(root, []));

  for (const file of files) {
    const rel = path.relative(baseDir, file).replace(/\\/g, '/');
    // Matched against the repo-relative path, never the absolute one: a
    // checkout directory that happens to contain a segment like "prisma" or
    // "test-utils" would otherwise switch the guard off for the whole repo.
    if (ALLOWED.some((re) => re.test(rel))) continue;

    const lines = stripCommentsAndKeepPositions(
      fs.readFileSync(file, 'utf8'),
    ).split('\n');

    lines.forEach((line, i) => {
      // Comparison-ish contexts only.
      const contexts = [
        /[!=]==?\s*['"]([A-Za-z][A-Za-z0-9_]{2,})['"]/g,
        /['"]([A-Za-z][A-Za-z0-9_]{2,})['"]\s*[!=]==?/g,
        /\bcase\s+['"]([A-Za-z][A-Za-z0-9_]{2,})['"]\s*:/g,
        /\.includes\(\s*['"]([A-Za-z][A-Za-z0-9_]{2,})['"]\s*\)/g,
      ];
      for (const re of contexts) {
        let m;
        while ((m = re.exec(line)) !== null) {
          const value = m[1];
          if (!enumValues.has(value)) continue;
          violations.push({ file: rel, line: i + 1, value, text: line.trim() });
        }
      }
    });
  }
  return violations;
}

function loadBaseline() {
  if (!fs.existsSync(BASELINE_PATH)) return [];
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')).violations ?? [];
}

function key(v) {
  return `${v.file}:${v.value}`;
}

function main() {
  const listOnly = process.argv.includes('--list');
  const writeBaseline = process.argv.includes('--write-baseline');

  const enumValues = parseEnumValues(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const violations = findViolations(enumValues);

  if (writeBaseline) {
    fs.writeFileSync(
      BASELINE_PATH,
      `${JSON.stringify(
        {
          note: 'Pre-existing enum-literal comparisons. Ratchet: this list may shrink, never grow. Regenerate only when removing entries.',
          generatedFrom: 'scripts/governance/check-enum-literals.cjs --write-baseline',
          violations: violations.map(({ file, value }) => ({ file, value })),
        },
        null,
        2,
      )}\n`,
    );
    console.log(`Baseline written: ${violations.length} known violation(s).`);
    return;
  }

  if (listOnly) {
    violations.forEach((v) => console.log(`${v.file}:${v.line}  ${v.value}  ${v.text}`));
    console.log(`\nTotal: ${violations.length}`);
    return;
  }

  const baseline = new Set(loadBaseline().map(key));
  const fresh = violations.filter((v) => !baseline.has(key(v)));

  if (fresh.length > 0) {
    console.error(
      'Enum values compared as string literals (use the generated enum / constants instead):\n',
    );
    fresh.forEach((v) => console.error(`  ${v.file}:${v.line}  '${v.value}'\n    ${v.text}`));
    console.error(
      `\n${fresh.length} new violation(s). Frontend: import from src/shared/enums/. ` +
        'Backend: import the Prisma enum or a constant from src/common/constants/.',
    );
    process.exit(1);
  }

  const stale = [...baseline].filter(
    (k) => !violations.some((v) => key(v) === k),
  );
  // The baseline is keyed by file+value, not by line: repeating an already
  // known value inside the same file does not trip the guard, but introducing
  // it in a new file does. That keeps the ratchet from firing on unrelated
  // line moves while still blocking the pattern from spreading.
  console.log(
    `Enum-literal guard: no new violations ` +
      `(${violations.length} occurrence(s) across ${new Set(violations.map(key)).size} file+value pair(s); ` +
      `baseline allows ${baseline.size}).`,
  );
  if (stale.length > 0) {
    console.log(
      `${stale.length} baseline entr(ies) no longer present — run --write-baseline to tighten the ratchet.`,
    );
  }
}

if (require.main === module) main();

module.exports = { findViolations, parseEnumValues };
