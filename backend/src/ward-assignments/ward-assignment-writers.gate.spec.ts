import * as fs from 'fs';
import * as path from 'path';

/**
 * GATE: the tables of ward assignment requests have known writers, and only those.
 *
 * Every state change of a request must lock its row, compare the form the person acted on, check reach and state,
 * and write an audit line, together. Inside the module that is the two command services; the query service and the
 * rules never write. Outside the module there is one writer, the team merge, which moves the team columns of the
 * merged-away unit by its strategy table (`ward_assignments.assignedTeamId` …) and is tested for these tables in
 * `teams/team-merge.database.spec.ts`. Any other writer is a request approved without a round, a submission not
 * counted, a ward unit's request moved to another unit.
 */
const SRC = path.resolve(__dirname, '..');
const MODULE_WRITERS = ['ward-assignments/ward-assignment-command.service.ts', 'ward-assignments/ward-investigators.service.ts'];
/** Outside the module: the team merge, through its strategy table (dynamic SQL a pattern cannot see; asserted below). */
const MERGE = 'teams/team-merge.service.ts';
const WARD_TABLES = ['ward_assignments', 'ward_assignment_subjects', 'ward_assignment_rounds', 'ward_assignment_decisions', 'ward_assignment_deadline_changes', 'ward_investigators'];
const WRITE = /\.(wardAssignment|wardAssignmentSubject|wardAssignmentRound|wardAssignmentDecision|wardAssignmentDeadlineChange|wardInvestigator)\s*\.\s*(create|createMany|createManyAndReturn|update|updateMany|updateManyAndReturn|upsert|delete|deleteMany)\s*\(/g;
const RAW = new RegExp(`(INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+"?(${WARD_TABLES.join('|')})\\b`, 'gi');

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

const relative = (file: string) => path.relative(SRC, file).split(path.sep).join('/');

describe('GATE: the ward assignment tables have known writers only', () => {
  const files = sourcesUnder(SRC);
  const writers = new Map(files.map((f) => [relative(f), writesIn(fs.readFileSync(f, 'utf8'))] as const).filter(([, w]) => w.length > 0));

  it('the scan reads the source and finds the writers it expects (it is not looking at nothing)', () => {
    expect(files.length).toBeGreaterThan(300);
    expect(writers.get(MODULE_WRITERS[0])).toEqual(expect.arrayContaining(['wardAssignment.create', 'wardAssignment.update', 'wardAssignmentRound.create']));
    expect(writers.get(MODULE_WRITERS[1])).toEqual(expect.arrayContaining(['wardInvestigator.create', 'wardInvestigator.update']));
  });

  it('negative control: the patterns catch every way of writing', () => {
    expect(writesIn('await tx.wardAssignment.update({ where })')).toEqual(['wardAssignment.update']);
    expect(writesIn('prisma.wardAssignmentRound\n  .createMany(')).toEqual(['wardAssignmentRound.createMany']);
    expect(writesIn('await tx.$executeRaw`UPDATE "ward_assignments" SET status = 1`')).toEqual(['UPDATE ward_assignments']);
    expect(writesIn('DELETE FROM ward_investigators WHERE')).toEqual(['DELETE FROM ward_investigators']);
    expect(writesIn('prisma.wardAssignment.findMany({})')).toEqual([]);
  });

  it('no file but the two command services writes them', () => {
    expect([...writers.keys()].sort()).toEqual([...MODULE_WRITERS].sort());
  });

  it('the team merge is the one writer outside: by its strategy table, for the team columns only', () => {
    const merge = fs.readFileSync(path.join(SRC, MERGE), 'utf8');
    const named = [...merge.matchAll(/'(ward_[a-z_]+)\.([A-Za-z]+)':\s*'(\w[\w-]*)'/g)].map((m) => `${m[1]}.${m[2]}=${m[3]}`);
    expect(named.sort()).toEqual([
      'ward_assignment_decisions.followUpTeamId=history',
      'ward_assignments.assignedTeamId=repoint',
      'ward_assignments.followUpTeamId=repoint',
      'ward_investigators.teamId=repoint',
    ]);
    // Any other mention of a ward table in the merge is a write this gate has not been told about.
    const mentions = WARD_TABLES.filter((t) => new RegExp(`\\b${t}\\b`).test(merge.replace(/'ward_[a-z_]+\.[A-Za-z]+':/g, '').replace(/(FROM|JOIN)\s+ward_[a-z_]+/g, '')));
    expect(mentions).toEqual([]);
  });
});
