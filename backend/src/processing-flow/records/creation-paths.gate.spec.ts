import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';

/**
 * GATE: every place that creates a petition, an incident or a case also asks for its processing flow.
 *
 * A record is given its flow by a worker, after it is saved; the only thing the saving code does is write one row in
 * its own transaction (`processingOutbox.enqueue`). A new creation path that forgets that row would save records that
 * never get a flow, with no error anywhere: the steps tab of those records would just stay empty. So a file that
 * creates one of the three records must either call `processingOutbox.enqueue`, or be listed below with the reason
 * it is allowed not to. A listed file that no longer creates a record is a stale entry and fails too, so the list
 * cannot rot into a blanket permission.
 */
const SRC = path.resolve(__dirname, '..', '..');

const MODELS = new Set(['petition', 'incident', 'case']);
const CREATING_METHODS = new Set(['create', 'createMany', 'createManyAndReturn', 'upsert']);

/** Files (relative to `src`, with forward slashes) that create records without asking for a flow, and why. */
const ALLOWLIST: Record<string, string> = {
  'legacy-migration/legacy-migration.service.ts':
    'Historical data copied from the old system: closed records must not get steps; a later CLI applies flows to the open ones on purpose.',
  'legacy-migration/cli/seed-ho-so-di-tru-mau.ts':
    'Migration command line: writes sample migrated records; flows are applied to open records on purpose by a later command.',
  'legacy-migration/cli/verify-backfill-parity.ts':
    'Migration command line: creates a throwaway record to check the backfill; it must not queue work for a worker.',
};

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

/** `<anything>.petition|incident|case.create|createMany|createManyAndReturn|upsert(...)`: parsed, so comments and strings never count. */
function isRecordCreation(node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) return false;
  const method = node.expression;
  if (!ts.isPropertyAccessExpression(method) || !CREATING_METHODS.has(method.name.text)) return false;
  const model = method.expression;
  return ts.isPropertyAccessExpression(model) && MODELS.has(model.name.text);
}

/** `<anything>.processingOutbox.enqueue(...)` or `processingOutbox.enqueue(...)`, with or without `?.`. */
function isEnqueueCall(node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) return false;
  const method = node.expression;
  if (!ts.isPropertyAccessExpression(method) || method.name.text !== 'enqueue') return false;
  const owner = method.expression;
  const ownerName = ts.isPropertyAccessExpression(owner) ? owner.name.text : ts.isIdentifier(owner) ? owner.text : '';
  return ownerName === 'processingOutbox';
}

function scan(file: string): { creations: number; enqueues: number } {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let creations = 0;
  let enqueues = 0;
  const visit = (node: ts.Node): void => {
    if (isRecordCreation(node)) creations += 1;
    if (isEnqueueCall(node)) enqueues += 1;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { creations, enqueues };
}

const relative = (file: string): string => path.relative(SRC, file).split(path.sep).join('/');

describe('Every path that creates a petition, an incident or a case asks for its processing flow', () => {
  const found = sourceFiles(SRC)
    .map((file) => ({ file: relative(file), ...scan(file) }))
    .filter((entry) => entry.creations > 0);

  it('sees the creation paths at all (a gate that finds nothing proves nothing)', () => {
    const files = found.map((entry) => entry.file);
    expect(files).toEqual(expect.arrayContaining([
      'petitions/petitions.service.ts',
      'incidents/incidents.service.ts',
      'cases/cases.service.ts',
      'cases/governance/legal-workflow.service.ts',
      'xlsx-imports/commit.service.ts',
      'legacy-migration/legacy-migration.service.ts',
    ]));
  });

  it('every file that creates a record calls processingOutbox.enqueue, or is on the allowlist', () => {
    const missing = found
      .filter((entry) => entry.enqueues === 0 && !(entry.file in ALLOWLIST))
      .map((entry) => `${entry.file} creates a record (${entry.creations}x) but never calls processingOutbox.enqueue`);
    expect(missing).toEqual([]);
  });

  it('every allowlisted file still creates a record, and says why it may skip the flow', () => {
    const creating = new Set(found.map((entry) => entry.file));
    const stale = Object.keys(ALLOWLIST).filter((file) => !creating.has(file));
    expect(stale.map((file) => `${file} is allowlisted but no longer creates a record: remove it`)).toEqual([]);
    const unexplained = Object.entries(ALLOWLIST).filter(([, reason]) => reason.trim().length < 20);
    expect(unexplained.map(([file]) => `${file} has no real reason`)).toEqual([]);
  });

  it('an allowlisted file does not also enqueue (then it would not need the entry)', () => {
    const redundant = found.filter((entry) => entry.file in ALLOWLIST && entry.enqueues > 0).map((entry) => entry.file);
    expect(redundant).toEqual([]);
  });
});
