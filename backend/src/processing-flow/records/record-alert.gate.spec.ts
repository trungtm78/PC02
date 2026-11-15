import * as fs from 'fs';
import * as path from 'path';
import ts from 'typescript';

/**
 * GATE: whoever writes a step of a record, a pause of its clock or its flow also refreshes the stored alert.
 *
 * The three lists and the tracking screen read the alert from four stored columns (`refreshRecordAlert`). A new write
 * path that changes a step's status or deadline and forgets the refresh would leave those columns saying yesterday's
 * colour, with no error anywhere. So a file that writes one of the three tables must either call `refreshRecordAlert`
 * itself, or be listed below as running inside the command layer (`ProcessingCommandService.write` / `writeStep`, which
 * refreshes after every job) and really do so. A listed file that no longer writes is a stale entry and fails too.
 *
 * What this cannot see (that a refresh is reached on EVERY branch) is what `record-alert.database.spec.ts` measures.
 */
const SRC = path.resolve(__dirname, '..', '..');

const MODELS = new Set(['procRecordStep', 'procRecordPause', 'procRecordFlow']);
const WRITING_METHODS = new Set(['create', 'createMany', 'createManyAndReturn', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany']);

/** Files (relative to `src`) whose writes run inside a job of the command layer, which refreshes when the job ends. */
const INSIDE_COMMAND_LAYER: Record<string, string> = {
  'processing-flow/records/processing-assignment.service.ts': 'Naming the person of a party is a job of `commands.writeStep` (it bumps the revision of the step).',
  'processing-flow/records/processing-deadline.service.ts': 'Adjusting and extending a deadline are jobs of `commands.writeStep`.',
};

/** The one file that writes the alert columns themselves. */
const ALERT_WRITER = 'processing-flow/records/record-alert.ts';

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

/** `<anything>.procRecordStep|procRecordPause|procRecordFlow.<a writing method>(...)`: parsed, so comments never count. */
function isFlowWrite(node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) return false;
  const method = node.expression;
  if (!ts.isPropertyAccessExpression(method) || !WRITING_METHODS.has(method.name.text)) return false;
  const model = method.expression;
  return ts.isPropertyAccessExpression(model) && MODELS.has(model.name.text);
}

const isCallOf = (node: ts.Node, names: readonly string[]): boolean => {
  if (!ts.isCallExpression(node)) return false;
  const callee = node.expression;
  const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
  return names.includes(name);
};

function scanText(file: string, text: string): { writes: number; refreshes: number; commandJobs: number } {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found = { writes: 0, refreshes: 0, commandJobs: 0 };
  const visit = (node: ts.Node): void => {
    if (isFlowWrite(node)) found.writes += 1;
    if (isCallOf(node, ['refreshRecordAlert'])) found.refreshes += 1;
    if (isCallOf(node, ['write', 'writeStep'])) found.commandJobs += 1;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

const relative = (file: string) => path.relative(SRC, file).split(path.sep).join('/');
const scanned = sourceFiles(SRC).map((file) => ({ file: relative(file), ...scanText(file, fs.readFileSync(file, 'utf8')) }));
const writers = scanned.filter((entry) => entry.writes > 0 && entry.file !== ALERT_WRITER);

describe('gate: every writer of a record flow refreshes the stored alert', () => {
  it('the scan sees the writers that exist today', () => {
    expect(writers.map((entry) => entry.file).sort()).toEqual([
      'processing-flow/records/flow-application.service.ts',
      'processing-flow/records/processing-assignment.service.ts',
      'processing-flow/records/processing-command.service.ts',
      'processing-flow/records/processing-deadline.service.ts',
      'processing-flow/records/processing-pause.service.ts',
    ]);
  });

  it('a writer calls refreshRecordAlert itself, or is listed as a job of the command layer', () => {
    const forgetful = writers.filter((entry) => entry.refreshes === 0 && !(entry.file in INSIDE_COMMAND_LAYER)).map((entry) => entry.file);
    expect(forgetful).toEqual([]);
  });

  it('a listed file really writes, and really runs its writes as jobs of the command layer', () => {
    for (const file of Object.keys(INSIDE_COMMAND_LAYER)) {
      const entry = scanned.find((candidate) => candidate.file === file);
      expect({ file, writes: (entry?.writes ?? 0) > 0, commandJobs: (entry?.commandJobs ?? 0) > 0 }).toEqual({ file, writes: true, commandJobs: true });
    }
  });

  it('the command layer refreshes inside `write`, the door every command goes through', () => {
    const text = fs.readFileSync(path.join(SRC, 'processing-flow/records/processing-command.service.ts'), 'utf8');
    const door = text.slice(text.indexOf('  async write('), text.indexOf('  writeStep('));
    expect(door).toContain('await job(tx, flow);');
    expect(door.indexOf('refreshRecordAlert(')).toBeGreaterThan(door.indexOf('await job(tx, flow);'));
  });

  it('the scan would see a write and a refresh if they were there, and not a mention in a comment', () => {
    expect(scanText('planted.ts', 'async function f(tx) { await tx.procRecordStep.update({ where: { id }, data: {} }); }')).toMatchObject({ writes: 1, refreshes: 0 });
    expect(scanText('planted.ts', 'async function f(tx) { await this.prisma.procRecordPause.create({ data: {} }); await refreshRecordAlert(tx, g, k, id); }')).toMatchObject({ writes: 1, refreshes: 1 });
    expect(scanText('planted.ts', '// tx.procRecordStep.update(...) then refreshRecordAlert(...)\nconst rows = tx.procRecordStep.findMany({});')).toMatchObject({ writes: 0, refreshes: 0 });
  });
});
