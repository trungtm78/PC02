import * as fs from 'fs';
import * as path from 'path';
import { FEATURE_REGISTRY } from '../src/feature-flags/feature-registry';

/**
 * The bug this suite exists to stop has happened three times.
 *
 * The frontend auto-discovers its feature modules with `import.meta.glob`, so
 * dropping a folder in is enough to get a menu entry. The backend registry was
 * a hand-written import list. When the two drifted, `listAll()` — which builds
 * its answer from the backend registry — never returned the key, so the menu
 * item silently vanished and the page stayed reachable only by typing its URL.
 * That is `comprehensive` (v0.37.2.1), `document-templates` (v0.69.0.1) and
 * `edit-window-requests`, which was still broken when this was written.
 *
 * The relationship is **FE ⊆ BE**, not equality: the backend has infrastructure
 * modules with no screen (metrics, email, scheduler), and that is fine. What is
 * never fine is a frontend key the backend has never heard of.
 */
const FE_FEATURES_DIR = path.join(
  __dirname,
  '..',
  '..',
  'frontend',
  'src',
  'features',
);

/** Read `key: '...'` out of a frontend feature manifest. */
function frontendKeys(): { key: string; module: string }[] {
  const out: { key: string; module: string }[] = [];
  for (const entry of fs.readdirSync(FE_FEATURES_DIR, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    const manifest = path.join(
      FE_FEATURES_DIR,
      entry.name,
      'feature.manifest.ts',
    );
    if (!fs.existsSync(manifest)) continue;
    const source = fs.readFileSync(manifest, 'utf8');
    const match = source.match(/key:\s*'([^']+)'/);
    if (match) out.push({ key: match[1], module: entry.name });
  }
  return out;
}

describe('feature registry parity (FE ⊆ BE)', () => {
  it('every frontend feature key exists in the backend registry', () => {
    const backend = new Set(FEATURE_REGISTRY.map((m) => m.key));
    const orphans = frontendKeys().filter((f) => !backend.has(f.key));

    // Named so the failure tells you which folder to fix, not just a count.
    expect(orphans.map((o) => `${o.module} → ${o.key}`)).toEqual([]);
  });

  it('finds frontend manifests at all — a silent zero would pass vacuously', () => {
    expect(frontendKeys().length).toBeGreaterThan(10);
  });

  it('backend keys are unique', () => {
    const keys = FEATURE_REGISTRY.map((m) => m.key);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect([...new Set(dupes)]).toEqual([]);
  });

  it('every backend manifest on disk is in the generated registry', () => {
    // Catches a stale generated file: somebody added a manifest and did not
    // run the generator, so the module exists but the flag does not.
    const srcDir = path.join(__dirname, '..', 'src');
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name === 'feature.manifest.ts') found.push(full);
      }
    };
    walk(srcDir);

    expect(FEATURE_REGISTRY.length).toBe(found.length);
  });
});
