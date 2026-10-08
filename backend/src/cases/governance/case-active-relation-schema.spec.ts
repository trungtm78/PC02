import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
describe('legal-R4 active relation uniqueness preserves corrected history', () => {
  it('uses additive133 active-only uniqueness and keeps old migrations unchanged', async () => {
    const schema = await readFile(
      join(process.cwd(), 'prisma/schema.prisma'),
      'utf8',
    );
    const relation = schema.match(/model CaseRelation\s*\{([\s\S]*?)\n\}/)?.[1];
    expect(relation).toBeDefined();
    expect(relation).not.toMatch(
      /@@unique\(\[sourceCaseId,\s*targetCaseId,\s*type\]/,
    );
    const migration = await readFile(
      join(
        process.cwd(),
        'prisma/migrations/20261006090000_case_active_relation_unique/migration.sql',
      ),
      'utf8',
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX[\s\S]+WHERE "revokedAt" IS NULL AND "deletedAt" IS NULL/,
    );
    expect(migration).toContain(
      'DROP INDEX "case_relations_sourceCaseId_targetCaseId_type_key"',
    );
    expect(migration.indexOf('CREATE UNIQUE INDEX')).toBeLessThan(
      migration.indexOf('DROP INDEX'),
    );
  });
});
