import fs from 'fs';
import path from 'path';
import { CORE_FEATURE_KEYS } from './core-features.constants';

/**
 * E4–E6. Turning a flag off has to close the API, not just hide the menu — a
 * hidden menu is a suggestion, and `curl` does not read menus.
 *
 * The pairing between a manifest saying `gating: 'api'` and its controller
 * carrying `@FeatureFlag(key)` is checked in BOTH directions, because each
 * direction fails differently and both fail quietly:
 *
 *  - manifest says gated, controller is not → the admin switches the module
 *    off, the sidebar empties, and every endpoint stays open.
 *  - controller is gated, manifest does not say so → nobody reviewing the
 *    module knows a flag can take its API away, and the outage looks like a bug.
 */
const SRC = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const ALL_FILES = walk(SRC);

/** Every `feature.manifest.ts`, with its key and whether it declares API gating. */
const MANIFESTS = ALL_FILES.filter((f) =>
  f.endsWith('feature.manifest.ts'),
).map((f) => {
  const src = fs.readFileSync(f, 'utf8');
  return {
    file: path.relative(SRC, f).replace(/\\/g, '/'),
    dir: path.dirname(f),
    key: /key:\s*'([^']+)'/.exec(src)?.[1] ?? '',
    gated: /gating:\s*'api'/.test(src),
  };
});

/** Controllers grouped by the directory their manifest lives in. */
function controllersFor(dir: string) {
  return ALL_FILES.filter(
    (f) =>
      f.startsWith(dir + path.sep) &&
      f.endsWith('.controller.ts') &&
      !f.endsWith('.spec.ts'),
  ).map((f) => ({
    file: path.relative(SRC, f).replace(/\\/g, '/'),
    keys: [
      ...fs.readFileSync(f, 'utf8').matchAll(/@FeatureFlag\('([^']+)'\)/g),
    ].map((m) => m[1]),
  }));
}

describe('feature gating: manifest ⇔ controller', () => {
  it('finds the manifests at all — a silent zero would pass vacuously', () => {
    expect(MANIFESTS.length).toBeGreaterThan(20);
    expect(MANIFESTS.every((m) => m.key)).toBe(true);
  });

  it('every manifest that claims API gating has a gated controller', () => {
    const broken = MANIFESTS.filter((m) => m.gated).filter((m) => {
      const ctrls = controllersFor(m.dir);
      return ctrls.length > 0 && !ctrls.some((c) => c.keys.includes(m.key));
    });

    expect(broken.map((b) => b.file)).toEqual([]);
  });

  it('every gated controller belongs to a manifest that says so', () => {
    const undeclared: string[] = [];
    for (const m of MANIFESTS) {
      for (const c of controllersFor(m.dir)) {
        if (c.keys.includes(m.key) && !m.gated) undeclared.push(c.file);
      }
    }

    expect(undeclared).toEqual([]);
  });

  it('a gated controller names its own module key, not another one', () => {
    // A typo here switches the wrong module off, and the symptom appears in a
    // module nobody touched.
    const mismatched: string[] = [];
    const knownKeys = new Set(MANIFESTS.map((m) => m.key));
    for (const m of MANIFESTS) {
      for (const c of controllersFor(m.dir)) {
        for (const k of c.keys) {
          if (k !== m.key && knownKeys.has(k))
            mismatched.push(`${c.file} → ${k}`);
        }
      }
    }

    expect(mismatched).toEqual([]);
  });

  it('never gates a core module', () => {
    // `isEnabled()` returns true for these regardless, so a gate here is dead
    // code that reads like a working switch — and if that ever changed, the
    // flag admin screen would take itself away.
    const core = new Set(CORE_FEATURE_KEYS);
    const gatedCore = MANIFESTS.filter((m) => m.gated && core.has(m.key));

    expect(gatedCore.map((m) => m.key)).toEqual([]);
  });

  it('never gates notifications or the lookup catalogues', () => {
    // Notifications is the bell on the shell of every screen; the catalogues
    // are state-issued reference data other modules read while doing their own
    // work. Switching either off breaks modules that are still switched on.
    const NEVER = new Set([
      'notifications',
      'directory',
      'admin-units',
      'master-class',
      'crimes',
      'catalog',
      'address-mapping',
    ]);
    const gated = MANIFESTS.filter((m) => m.gated && NEVER.has(m.key));

    expect(gated.map((m) => m.key)).toEqual([]);
  });

  it('gates the modules the waves called for', () => {
    // Named explicitly so dropping one is a failing test rather than a quiet
    // omission discovered when an admin switches something off and nothing
    // happens.
    const gated = new Set(MANIFESTS.filter((m) => m.gated).map((m) => m.key));
    const expected = [
      // E4
      'kpi',
      'lawyers',
      'document-numbers',
      // E5
      'subjects',
      'documents',
      'guidance',
      'exchanges',
      'delegations',
      'conclusions',
      'proposals',
      'investigation-supplements',
      'document-templates',
      // E6
      'cases',
      'incidents',
      'petitions',
      'calendar',
      'teams',
      'reports',
    ];

    expect(expected.filter((k) => !gated.has(k))).toEqual([]);
  });
});
