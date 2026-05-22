/**
 * CI Guard: every `@RequirePermissions({action, subject})` decorator usage
 * must have a matching entry in `prisma/seed-permissions.ts`.
 *
 * Why this exists (v0.34.0.0):
 * - v0.21.3.0: Setting perm missing → /admin/settings 403 for ALL roles
 * - v0.32.0.0: restore:Case missing → admin couldn't restore deleted cases
 * - v0.33.0.0: review_reset_request missing initially → admin saw 403 on queue
 *
 * Pattern: missing permission row makes ADMIN auto-grant block silently no-op
 * (it queries findMany over rows that don't exist). Hard to debug. CI catches
 * before merge.
 */

import * as fs from 'fs';
import * as path from 'path';

// __dirname = backend/src/seed → SRC_DIR = backend/src ; SEED_PATH = backend/prisma/seed-permissions.ts
const SRC_DIR = path.resolve(__dirname, '..');
const SEED_PATH = path.resolve(__dirname, '..', '..', 'prisma', 'seed-permissions.ts');

interface DecoratorUsage {
  file: string;
  line: number;
  action: string;
  subject: string;
}

/**
 * Walk src/ recursively, find all `@RequirePermissions({action: '...', subject: '...'})`
 * usages. Handles single-line and multi-line decorator formats.
 */
function findDecoratorUsages(dir: string): DecoratorUsage[] {
  const usages: DecoratorUsage[] = [];
  const stack: string[] = [dir];

  while (stack.length > 0) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        // Skip node_modules + test files (decorator usages tested separately)
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        stack.push(full);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        // Skip *.spec.ts and *.test.ts
        if (entry.name.includes('.spec.') || entry.name.includes('.test.')) continue;
        const content = fs.readFileSync(full, 'utf8');
        // Match @RequirePermissions({ action: '...', subject: '...' })
        // Allows multi-line formatting
        const pattern =
          /@RequirePermissions\(\s*\{\s*action:\s*['"]([\w]+)['"]\s*,\s*subject:\s*['"]([\w]+)['"]/g;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(content)) !== null) {
          // Compute line number from match index
          const line = content.slice(0, match.index).split('\n').length;
          usages.push({
            file: path.relative(path.dirname(__dirname), full),
            line,
            action: match[1],
            subject: match[2],
          });
        }
      }
    }
  }
  return usages;
}

/**
 * Parse SEED_PERMISSIONS array into a Set of "action:subject" keys.
 */
function parseSeedPermissions(): Set<string> {
  const content = fs.readFileSync(SEED_PATH, 'utf8');
  const pattern = /\{\s*action:\s*['"]([\w]+)['"]\s*,\s*subject:\s*['"]([\w]+)['"]/g;
  const seeded = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    seeded.add(`${match[1]}:${match[2]}`);
  }
  return seeded;
}

describe('Permissions coverage — every @RequirePermissions has a seed entry', () => {
  let usages: DecoratorUsage[];
  let seeded: Set<string>;

  beforeAll(() => {
    usages = findDecoratorUsages(SRC_DIR);
    seeded = parseSeedPermissions();
  });

  it('finds at least 10 @RequirePermissions usages', () => {
    expect(usages.length).toBeGreaterThanOrEqual(10);
  });

  it('seed-permissions.ts parses to a non-empty registry', () => {
    expect(seeded.size).toBeGreaterThanOrEqual(20);
  });

  it('every decorator usage has matching seed entry', () => {
    const missing: DecoratorUsage[] = [];
    for (const u of usages) {
      const key = `${u.action}:${u.subject}`;
      if (!seeded.has(key)) {
        missing.push(u);
      }
    }
    if (missing.length > 0) {
      const report = missing
        .map((m) => `  ${m.file}:${m.line}  @RequirePermissions({ action: '${m.action}', subject: '${m.subject}' })`)
        .join('\n');
      throw new Error(
        `Missing ${missing.length} permission(s) in prisma/seed-permissions.ts:\n${report}\n` +
          `\nAdd these entries to SEED_PERMISSIONS array, otherwise ADMIN auto-grant ` +
          `(seed.ts loop over Permission.findMany) silently skips them → 403 cho mọi role.`,
      );
    }
  });
});
