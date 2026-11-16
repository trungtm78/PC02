import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Gate: a team's state has ONE writer, TeamLifecycleService.
 *
 * `status` and `isActive` describe the same state. The database trigger reconciles them, but transition rules, archive
 * stamps and the audit row live in the service, so a second writer would silently skip all three.
 */
const SRC = join(__dirname, '..');
const LIFECYCLE = join('teams', 'team-lifecycle.service.ts');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith('.ts') && !/\.(spec|d)\.ts$/.test(full) ? [full] : [];
  });
}

/**
 * The texts of the writes to the TEAMS table in one source: the argument of `<client>.team.update|updateMany|upsert(`
 * up to its closing parenthesis, and raw `UPDATE "teams" ...` statements. `archivedById` is a column of other models
 * too (a ward assignment request is archived by PC02): what matters is who writes it ON A TEAM.
 */
export function teamWrites(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\.team\s*\.\s*(update|updateMany|upsert)\s*\(/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < text.length && depth > 0; i += 1) {
      if (text[i] === '(') depth += 1;
      else if (text[i] === ')') depth -= 1;
    }
    out.push(text.slice(m.index, i));
  }
  for (const m of text.matchAll(/UPDATE\s+"?teams"?\s[^;`]*/gi)) out.push(m[0]);
  return out;
}

describe('team state writers', () => {
  const files = sourceFiles(SRC).map((f) => ({
    path: f.slice(SRC.length + 1),
    text: readFileSync(f, 'utf8'),
  }));
  /** The files that write `re` into a team. */
  const writingTeams = (re: RegExp) => files.filter((f) => teamWrites(f.text).some((w) => re.test(w))).map((f) => f.path);

  it('negative control: a team write is told apart from a write of another model with the same column', () => {
    expect(teamWrites('await db.team.update({ where: { id }, data: { archivedById: x, note: f(a) } });').join()).toMatch(/archivedById:/);
    expect(teamWrites('await tx.wardAssignment.update({ data: { archivedAt: now, archivedById: actor.id } })')).toEqual([]);
    expect(teamWrites('await tx.$executeRaw`UPDATE "teams" SET "archivedById" = 1`').join()).toMatch(/archivedById/);
  });

  it('the detector sees the lifecycle service (it is anchored on a file that must match)', () => {
    expect(writingTeams(/archivedById:/)).toContain(LIFECYCLE);
  });

  it('only the lifecycle service writes the archive stamp of a team (`archivedAt` and `archivedById` are shared with other models)', () => {
    expect(writingTeams(/archivedById/)).toEqual([LIFECYCLE]);
  });

  it('the teams service no longer writes isActive straight to the row', () => {
    const service = files.find((f) => f.path === join('teams', 'teams.service.ts'));
    expect(service).toBeDefined();
    // `isActive: dto.isActive` was the old direct write; creation may still pass the flag (the trigger reconciles it).
    expect(service!.text).not.toMatch(/\.\.\.\(dto\.isActive/);
  });
});
