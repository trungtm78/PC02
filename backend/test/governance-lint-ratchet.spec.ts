/**
 * Tests for the lint ratchet (scripts/governance/lint-changed.cjs).
 *
 * The ratchet is what stops lint debt from growing, so its own failure modes
 * matter more than usual: a gate that silently passes is worse than no gate,
 * and a gate that fails on files it cannot record is one people will disable.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'governance',
  'lint-changed.cjs',
);
const BASELINE_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'governance',
  'lint-baseline.json',
);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ratchet = require(SCRIPT_PATH) as {
  ownedBy: (
    ws: { prefix: string; scan: string[] },
    relPath: string,
  ) => boolean;
  lintCounts: (
    ws: { dir: string; prefix: string },
    targets: string[],
  ) => Record<string, number>;
  WORKSPACES: Array<{ prefix: string; dir: string; scan: string[] }>;
};

const backend = ratchet.WORKSPACES.find((w) => w.prefix === 'backend/')!;
const frontend = ratchet.WORKSPACES.find((w) => w.prefix === 'frontend/')!;

describe('lint ratchet', () => {
  describe('ownedBy — the gate and the baseline must cover the same territory', () => {
    it.each([
      'backend/src/admin/admin.service.ts',
      'backend/test/enums-sync.spec.ts',
      'backend/prisma/seed.ts',
      'backend/scripts/generate-shared-enums.cjs',
    ])('covers %s', (rel) => {
      expect(ratchet.ownedBy(backend, rel)).toBe(true);
    });

    it('covers frontend sources', () => {
      expect(ratchet.ownedBy(frontend, 'frontend/src/App.tsx')).toBe(true);
    });

    it('does not claim files from another workspace', () => {
      expect(ratchet.ownedBy(backend, 'frontend/src/App.tsx')).toBe(false);
      expect(ratchet.ownedBy(frontend, 'backend/src/main.ts')).toBe(false);
    });

    it('ignores paths outside the scanned directories', () => {
      // Nothing generates a baseline entry for these, so linting them would
      // fail at "0 → n" with no way to record the existing state.
      expect(ratchet.ownedBy(backend, 'backend/dist/main.js')).toBe(false);
      expect(ratchet.ownedBy(backend, 'backend/package.json')).toBe(false);
    });

    it('does not treat a prefix match as a directory match', () => {
      expect(ratchet.ownedBy(backend, 'backend/srcfoo/a.ts')).toBe(false);
    });
  });

  describe('lintCounts', () => {
    it('reports a count for a real file', () => {
      const counts = ratchet.lintCounts(backend, [
        'src/common/constants/role.constants.ts',
      ]);
      expect(
        counts['backend/src/common/constants/role.constants.ts'],
      ).toBeDefined();
    });

    it('returns nothing for an empty target list without invoking eslint', () => {
      expect(ratchet.lintCounts(backend, [])).toEqual({});
    });

    it('throws instead of reporting zero when eslint cannot run', () => {
      // A crashed linter must never be read as "no problems found" — that is
      // the failure mode where the gate goes green while checking nothing.
      expect(() =>
        ratchet.lintCounts({ ...backend, dir: path.join(REPO_ROOT, 'nope') }, [
          'src/x.ts',
        ]),
      ).toThrow(/eslint not found/);
    });
  });

  describe('baseline', () => {
    const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as {
      files: Record<string, number>;
      totalProblems: number;
    };

    it('only records paths the gate actually covers', () => {
      const uncovered = Object.keys(baseline.files).filter(
        (f) => !ratchet.WORKSPACES.some((ws) => ratchet.ownedBy(ws, f)),
      );
      expect(uncovered).toEqual([]);
    });

    it('records a positive count for every listed file', () => {
      const nonPositive = Object.entries(baseline.files).filter(
        ([, n]) => !(n > 0),
      );
      expect(nonPositive).toEqual([]);
    });

    it('keeps totalProblems consistent with the per-file counts', () => {
      const sum = Object.values(baseline.files).reduce((a, b) => a + b, 0);
      expect(baseline.totalProblems).toBe(sum);
    });
  });
});
