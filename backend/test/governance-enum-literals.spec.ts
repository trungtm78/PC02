/**
 * Tests for the enum-literal guard (scripts/governance/check-enum-literals.cjs).
 *
 * The guard is what enforces the rule CLAUDE.md has always claimed CI checked,
 * so it needs to be correct in both directions: it must catch a real
 * comparison against an enum value, and it must stay quiet on the things that
 * legitimately spell those values out (the generated enum file, constants,
 * fixtures in tests).
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GUARD_PATH = path.join(
  REPO_ROOT,
  'scripts',
  'governance',
  'check-enum-literals.cjs',
);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const guard = require(GUARD_PATH) as {
  parseEnumValues: (schemaSource: string) => Set<string>;
  findViolations: (values: Set<string>) => Array<{
    file: string;
    line: number;
    value: string;
    text: string;
  }>;
};

describe('enum-literal guard', () => {
  describe('parseEnumValues', () => {
    it('collects UPPER_CASE values from schema enums', () => {
      const values = guard.parseEnumValues(`
        enum CaseStatus {
          TIEP_NHAN // Tiếp nhận
          DA_LUU_TRU
          @@map("case_status")
        }
      `);
      expect(values.has('TIEP_NHAN')).toBe(true);
      expect(values.has('DA_LUU_TRU')).toBe(true);
    });

    it('ignores lowercase status values, which collide with ordinary UI strings', () => {
      // `filterStatus === 'active'` has nothing to do with DeadlineRuleStatus;
      // guarding these would bury the real findings under false positives.
      const values = guard.parseEnumValues(`
        enum DeadlineRuleStatus {
          draft
          active
          rejected
        }
      `);
      expect(values.has('active')).toBe(false);
      expect(values.has('draft')).toBe(false);
    });

    it('ignores values shorter than three characters', () => {
      const values = guard.parseEnumValues(`enum Tiny {\n  AB\n  ABC\n}`);
      expect(values.has('AB')).toBe(false);
      expect(values.has('ABC')).toBe(true);
    });
  });

  describe('findViolations', () => {
    it('flags a comparison against a known enum value', () => {
      const hits = guard.findViolations(new Set(['TIEP_NHAN']));
      // The repo genuinely contains these today; the baseline is what keeps
      // them from failing CI. If this ever returns nothing, the scanner has
      // stopped looking at the source tree.
      expect(hits.length).toBeGreaterThan(0);
      expect(hits.every((h) => h.value === 'TIEP_NHAN')).toBe(true);
    });

    it('does not flag a value that is not an enum member', () => {
      expect(guard.findViolations(new Set(['NOT_AN_ENUM_VALUE_XYZ']))).toEqual([]);
    });

    it('never flags the generated enum file or shared constants', () => {
      const values = guard.parseEnumValues(
        fs.readFileSync(
          path.join(REPO_ROOT, 'backend', 'prisma', 'schema.prisma'),
          'utf8',
        ),
      );
      const files = guard.findViolations(values).map((h) => h.file);
      expect(files.some((f) => f.includes('shared/enums/'))).toBe(false);
      expect(files.some((f) => f.includes('common/constants/'))).toBe(false);
      expect(files.some((f) => f.includes('__tests__/'))).toBe(false);
      expect(files.some((f) => /\.(spec|test)\.tsx?$/.test(f))).toBe(false);
    });
  });

  describe('baseline', () => {
    it('covers every violation currently in the tree, so CI starts green', () => {
      const values = guard.parseEnumValues(
        fs.readFileSync(
          path.join(REPO_ROOT, 'backend', 'prisma', 'schema.prisma'),
          'utf8',
        ),
      );
      const baseline = new Set(
        (
          JSON.parse(
            fs.readFileSync(
              path.join(
                REPO_ROOT,
                'scripts',
                'governance',
                'enum-literals-baseline.json',
              ),
              'utf8',
            ),
          ) as { violations: Array<{ file: string; value: string }> }
        ).violations.map((v) => `${v.file}:${v.value}`),
      );

      const unlisted = guard
        .findViolations(values)
        .filter((v) => !baseline.has(`${v.file}:${v.value}`));

      expect(unlisted).toEqual([]);
    });
  });
});
