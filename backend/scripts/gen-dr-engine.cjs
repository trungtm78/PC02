#!/usr/bin/env node
/**
 * Copies the dynamic-reports pure engine (backend/src/dynamic-reports/engine/)
 * byte-for-byte into the frontend, so the grid can run the exact same
 * decimal/token/period/expr/aggregate/access/status/paste logic the server
 * uses — live fx recompute and client-side validation never disagree with
 * what the server will eventually accept or reject (design spec §10 R2).
 *
 * The backend copy is the only source of truth. Never hand-edit anything
 * under frontend/src/features/dynamic-reports/engine/generated/ — re-run
 * this script instead. No header/banner is added to the copied files
 * themselves (that would break the gen-dr-engine.gate.spec.ts byte-equality
 * check); this file and that gate are the only things enforcing the rule.
 *
 * Run: npm run gen:dr-engine (from backend/)
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', 'src', 'dynamic-reports', 'engine');
const OUT_DIR = path.resolve(
  __dirname,
  '..',
  '..',
  'frontend',
  'src',
  'features',
  'dynamic-reports',
  'engine',
  'generated',
);

function main() {
  const entries = fs
    .readdirSync(SRC_DIR)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'));

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Remove stale generated files that no longer have a backend source, so
  // a renamed/deleted engine file doesn't leave an orphaned copy behind.
  const existing = fs.existsSync(OUT_DIR)
    ? fs.readdirSync(OUT_DIR).filter((name) => name.endsWith('.ts'))
    : [];
  for (const stale of existing) {
    if (!entries.includes(stale)) {
      fs.unlinkSync(path.join(OUT_DIR, stale));
      console.log(`removed stale ${stale}`);
    }
  }

  for (const name of entries) {
    const srcPath = path.join(SRC_DIR, name);
    const outPath = path.join(OUT_DIR, name);
    fs.copyFileSync(srcPath, outPath);
    console.log(`copied ${name}`);
  }

  console.log(`\n${entries.length} engine file(s) copied to ${path.relative(process.cwd(), OUT_DIR)}`);
}

main();
