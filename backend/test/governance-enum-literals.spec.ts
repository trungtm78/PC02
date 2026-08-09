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
import * as os from 'os';
import * as path from 'path';
import * as guard from '../../scripts/governance/check-enum-literals.cjs';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * Scan a throwaway tree instead of the real source.
 *
 * Asserting that production code still contains a violation would make the
 * suite fail the moment somebody does what the guard's own error message tells
 * them to do.
 */
function scanFixture(files: Record<string, string>, values: string[]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'enum-guard-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(root, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
    return guard.findViolations(new Set(values), [root], root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

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
    it.each([
      ['equality', `if (c.status === 'TIEP_NHAN') return 1;`],
      ['inequality', `if (c.status !== 'TIEP_NHAN') return 1;`],
      ['reversed operands', `if ('TIEP_NHAN' === c.status) return 1;`],
      ['switch case', `switch (s) { case 'TIEP_NHAN': break; }`],
      ['array membership', `if (list.includes('TIEP_NHAN')) return 1;`],
    ])('flags a %s comparison', (_label, code) => {
      const hits = scanFixture({ 'src/a.ts': code }, ['TIEP_NHAN']);
      expect(hits).toHaveLength(1);
      expect(hits[0].value).toBe('TIEP_NHAN');
    });

    it('ignores an enum value that is only mentioned in a comment', () => {
      const hits = scanFixture(
        {
          'src/a.ts': `// status === 'TIEP_NHAN' is handled elsewhere\nconst x = 1;`,
        },
        ['TIEP_NHAN'],
      );
      expect(hits).toEqual([]);
    });

    it('does not flag a string that is not an enum member', () => {
      const hits = scanFixture(
        { 'src/a.ts': `if (x === 'NOT_AN_ENUM_VALUE') return 1;` },
        ['TIEP_NHAN'],
      );
      expect(hits).toEqual([]);
    });

    it.each([
      'src/shared/enums/generated.ts',
      'src/common/constants/case.constants.ts',
      'src/pages/__tests__/thing.test.ts',
      'src/thing.spec.ts',
      'prisma/seed.ts',
    ])('never flags %s, whose job is to spell values out', (rel) => {
      const hits = scanFixture(
        { [rel]: `if (c.status === 'TIEP_NHAN') return 1;` },
        ['TIEP_NHAN'],
      );
      expect(hits).toEqual([]);
    });

    it('matches the allow-list against the repo-relative path, not the absolute one', () => {
      // The fixture root itself lives under a temp directory. If the allow-list
      // were applied to absolute paths, an unlucky checkout directory could
      // switch the guard off for the entire repo.
      const hits = scanFixture(
        { 'src/app/service.ts': `if (c.status === 'TIEP_NHAN') return 1;` },
        ['TIEP_NHAN'],
      );
      expect(hits).toHaveLength(1);
      expect(hits[0].file).toBe('src/app/service.ts');
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
