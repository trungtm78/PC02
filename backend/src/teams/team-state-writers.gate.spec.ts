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

describe('team state writers', () => {
  const files = sourceFiles(SRC).map((f) => ({
    path: f.slice(SRC.length + 1),
    text: readFileSync(f, 'utf8'),
  }));
  const writing = (re: RegExp) => files.filter((f) => re.test(f.text)).map((f) => f.path);

  it('the detector sees the lifecycle service (it is anchored on a file that must match)', () => {
    expect(writing(/archivedById:/)).toContain(LIFECYCLE);
  });

  it('only the lifecycle service writes the archive stamp (`archivedAt` alone is shared with other models)', () => {
    expect(writing(/archivedById:/)).toEqual([LIFECYCLE]);
  });

  it('the teams service no longer writes isActive straight to the row', () => {
    const service = files.find((f) => f.path === join('teams', 'teams.service.ts'));
    expect(service).toBeDefined();
    // `isActive: dto.isActive` was the old direct write; creation may still pass the flag (the trigger reconciles it).
    expect(service!.text).not.toMatch(/\.\.\.\(dto\.isActive/);
  });
});
