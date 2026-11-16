import * as fs from 'fs';
import * as path from 'path';

/**
 * GATE: the tables of ward assignment requests are written by this module's services only.
 *
 * Every state change of a request must lock its row, compare the form the person acted on, check reach and state,
 * and write an audit line, together (`WardAssignmentCommandService`). A write from anywhere else would skip all of it:
 * a request approved without a round, a submission not counted, a ward unit's request moved to another unit.
 */
const SRC = path.resolve(__dirname, '..');
const MODULE = path.resolve(__dirname);
const WRITE = /\.(wardAssignment|wardAssignmentSubject|wardAssignmentRound|wardAssignmentDecision|wardAssignmentDeadlineChange|wardInvestigator)\s*\.\s*(create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\s*\(/g;
const RAW = /(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?(ward_assignments|ward_assignment_subjects|ward_assignment_rounds|ward_assignment_decisions|ward_assignment_deadline_changes|ward_investigators)\b/gi;

function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourcesUnder(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) out.push(full);
  }
  return out;
}

/** The writes of one source text: `table.method` or the raw statement. */
export function writesIn(text: string): string[] {
  return [...[...text.matchAll(WRITE)].map((m) => `${m[1]}.${m[2]}`), ...[...text.matchAll(RAW)].map((m) => `${m[1].toUpperCase()} ${m[2]}`)];
}

describe('GATE: only the ward assignment module writes its tables', () => {
  const files = sourcesUnder(SRC);

  it('the scan reads the module and the rest of the source (it is not looking at nothing)', () => {
    expect(files.length).toBeGreaterThan(300);
    const inModule = files.filter((f) => f.startsWith(MODULE)).flatMap((f) => writesIn(fs.readFileSync(f, 'utf8')));
    expect(inModule).toEqual(expect.arrayContaining(['wardAssignment.create', 'wardAssignment.update', 'wardAssignmentRound.create', 'wardInvestigator.updateMany']));
  });

  it('negative control: the patterns catch every way of writing', () => {
    expect(writesIn('await tx.wardAssignment.update({ where })')).toEqual(['wardAssignment.update']);
    expect(writesIn('prisma.wardAssignmentRound\n  .createMany(')).toEqual(['wardAssignmentRound.createMany']);
    expect(writesIn('await tx.$executeRaw`UPDATE "ward_assignments" SET status = 1`')).toEqual(['UPDATE ward_assignments']);
    expect(writesIn('DELETE FROM ward_investigators WHERE')).toEqual(['DELETE FROM ward_investigators']);
    expect(writesIn('prisma.wardAssignment.findMany({})')).toEqual([]);
  });

  it('no file outside the module writes them', () => {
    const outside = files
      .filter((f) => !f.startsWith(MODULE))
      .flatMap((f) => writesIn(fs.readFileSync(f, 'utf8')).map((w) => `${path.relative(SRC, f)}: ${w}`));
    expect(outside).toEqual([]);
  });
});
