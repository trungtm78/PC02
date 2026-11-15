/**
 * Applies the processing flow the configuration has for a record to the records that are ALREADY open (decision R6:
 * records that existed before the feature are otherwise absent from the tracking screen and the backlog).
 *
 * A record is a candidate when it is not deleted, its status is not finished or suspended (`clocklessStatuses`), and it
 * has no flow. Candidates are read in pages, in the order of their id.
 *
 * DRY RUN by default: for each candidate the real `applyIn` runs inside a transaction that is ALWAYS rolled back, so
 * what is printed is what a real run would do, and nothing is stored. It prints the counts, a sample, and stops.
 *
 * A real run needs `--that`. It applies one record per transaction, goes on after a record that fails, and may be
 * stopped and started again: a record that has its flow is no longer a candidate, so a second run finds nothing to do.
 *
 * Use (after `set -a && source .env && set +a`):
 *   npm run proc:apply-flows --                                   # dry run, every kind, writes NOTHING
 *   npm run proc:apply-flows -- --kind PETITION --limit 200       # dry run of a part
 *   npm run proc:apply-flows -- --since 2026-01-01                # only records created from that day on
 *   npm run proc:apply-flows -- --that --actor <username>         # the real run
 *   npm run proc:apply-flows -- --that --even-if-off              # the real run while the switch is OFF (see below)
 * On the server, where only the build exists: `node dist/src/processing-flow/cli/apply-flows-to-open-records.js …`.
 *
 * While the switch `processing_flow_records` is OFF a real run is refused. `--even-if-off` applies anyway: the flows
 * and their steps are stored, but nobody sees them (the tabs, the tracking screen and the alert column are behind the
 * switch). The deadline column of a record IS still rewritten when its flow is confirmed and the step that sets the
 * deadline of the record is legally verified (`RecordDeadlineWriter.sync` does not read the switch): the dry run counts
 * those records.
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { AuditService } from '../../audit/audit.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';
import { TeamsService } from '../../teams/teams.service';
import { WorkingCalendarService } from '../calendar/working-calendar.service';
import { CaseAdapter } from '../gateway/case.adapter';
import { IncidentAdapter } from '../gateway/incident.adapter';
import { PetitionAdapter } from '../gateway/petition.adapter';
import { RecordGateway } from '../gateway/record-gateway';
import { RECORD_KINDS, type RecordKind } from '../gateway/record-snapshot';
import { FlowApplicationService, type ApplyOutcome } from '../records/flow-application.service';
import { clocklessStatuses } from '../records/record-alert';
import { RecordDeadlineWriter, RECORDS_SWITCH } from '../records/record-deadline-writer.service';

export const REAL_RUN_FLAG = '--that';
export const EVEN_IF_OFF_FLAG = '--even-if-off';
const PAGE_SIZE = 500;
const PROGRESS_EVERY = 500;
const SAMPLE_SIZE = 20;
const MAX_ERRORS_KEPT = 50;

export interface ApplyFlowsOptions {
  kinds: RecordKind[];
  /** `false`: dry run. */
  write: boolean;
  evenIfOff: boolean;
  /** At most this many candidates, over all kinds. */
  limit?: number;
  /** Only records created at or after this instant. */
  since?: Date;
  /** The user the flows and the audit entry are written for; `null`: the system. */
  actorId: string | null;
  /** Narrows the selection to these record ids. For the database spec only: the scratch database is shared. */
  onlyIds?: string[];
  pageSize?: number;
}

export interface ApplyFlowsDeps {
  db: PrismaClient;
  applier: Pick<FlowApplicationService, 'apply' | 'applyIn'>;
  gateway: Pick<RecordGateway, 'load'>;
  audit: Pick<AuditService, 'log'>;
  isSwitchOn: () => Promise<boolean>;
  print?: (line: string) => void;
}

export interface ApplyFlowsResult {
  dryRun: boolean;
  switchOn: boolean;
  /** A real run that did not start, and why. */
  refused: 'SWITCH_OFF' | null;
  candidates: number;
  /** Per kind, per outcome (`APPLIED:TYPE`, `APPLIED:GROUP`, `APPLIED:DEFAULT`, `APPLIED:UNKNOWN_TYPE`, `NO_FLOW`, … `ERROR`). */
  counts: Record<string, Record<string, number>>;
  applied: number;
  /** Records at least one of whose deadlines is provisional (dry run only: a real run does not read the steps back). */
  provisional: number;
  /** Records whose own deadline column the flow would rewrite (dry run only). */
  deadlineRewritten: number;
  errors: Array<{ kind: RecordKind; recordId: string; message: string }>;
  errorCount: number;
  sample: string[];
}

interface Preview {
  outcome: ApplyOutcome;
  code: string | null;
  informationType: string | null;
  flowName: string | null;
  firstDue: Date | null;
  provisional: boolean;
  deadlineRewritten: boolean;
}

/** Carries the result of a dry run out of a transaction that must not commit. */
class DryRunRollback extends Error {
  constructor(readonly preview: Preview) {
    super('dry run: rolled back');
  }
}

/** `APPLIED` is counted by how the flow was found; an unknown type is a proposal a person must confirm. */
export function outcomeKey(outcome: ApplyOutcome): string {
  return outcome.outcome === 'APPLIED' ? `APPLIED:${outcome.match}` : outcome.outcome;
}

const vietnamTime = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' });

/** One page of candidate ids of a kind, after `afterId`, in the order of the id. */
async function candidatePage(db: PrismaClient, kind: RecordKind, afterId: string | null, take: number, options: ApplyFlowsOptions): Promise<string[]> {
  const where = {
    deletedAt: null,
    status: { notIn: clocklessStatuses(kind) },
    procFlow: { is: null },
    ...(options.since ? { createdAt: { gte: options.since } } : {}),
    id: { ...(afterId ? { gt: afterId } : {}), ...(options.onlyIds ? { in: options.onlyIds } : {}) },
  };
  const args = { select: { id: true }, orderBy: { id: 'asc' as const }, take };
  const rows =
    kind === 'PETITION'
      ? await db.petition.findMany({ ...args, where: where as Prisma.PetitionWhereInput })
      : kind === 'INCIDENT'
        ? await db.incident.findMany({ ...args, where: where as Prisma.IncidentWhereInput })
        : await db.case.findMany({ ...args, where: where as Prisma.CaseWhereInput });
  return rows.map((row) => row.id);
}

/** What `applyIn` does for one record, read back and then thrown away with the transaction. */
async function preview(deps: ApplyFlowsDeps, kind: RecordKind, recordId: string, actorId: string | null): Promise<Preview> {
  try {
    await deps.db.$transaction(
      async (tx) => {
        const snapshot = await deps.gateway.load(kind, recordId, tx);
        const outcome = await deps.applier.applyIn(tx, { kind, recordId, reason: 'CLI', actorId });
        let flowName: string | null = null;
        let firstDue: Date | null = null;
        let provisional = false;
        if (outcome.outcome === 'APPLIED') {
          flowName = (await tx.procFlow.findUnique({ where: { id: outcome.flowId }, select: { name: true } }))?.name ?? null;
          const steps = await tx.procRecordStep.findMany({ where: { recordFlowId: outcome.recordFlowId }, select: { regulatoryDueAt: true, provisional: true } });
          for (const step of steps) {
            if (step.provisional) provisional = true;
            if (step.regulatoryDueAt && (!firstDue || step.regulatoryDueAt < firstDue)) firstDue = step.regulatoryDueAt;
          }
        }
        const after = outcome.outcome === 'APPLIED' ? await deps.gateway.load(kind, recordId, tx) : snapshot;
        const deadlineRewritten = (after?.deadline?.getTime() ?? null) !== (snapshot?.deadline?.getTime() ?? null);
        throw new DryRunRollback({ outcome, code: snapshot?.code ?? null, informationType: snapshot?.informationType ?? null, flowName, firstDue, provisional, deadlineRewritten });
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  } catch (error) {
    if (error instanceof DryRunRollback) return error.preview;
    throw error;
  }
  throw new Error('The dry-run transaction ended without rolling back');
}

function sampleLine(kind: RecordKind, recordId: string, seen: Preview): string {
  const { outcome } = seen;
  const head = `  ${kind.padEnd(8)} ${(seen.code ?? recordId).padEnd(16)} type: ${seen.informationType ?? '(none)'}`;
  if (outcome.outcome !== 'APPLIED') return `${head} | ${outcome.outcome}`;
  const due = seen.firstDue ? vietnamTime.format(seen.firstDue) : '(no deadline yet)';
  const marks = `${outcome.confirmed ? '' : ' [proposal, to confirm]'}${seen.provisional ? ' [provisional]' : ''}${seen.deadlineRewritten ? ' [rewrites the deadline of the record]' : ''}`;
  return `${head} | flow: ${seen.flowName ?? outcome.flowId} | match: ${outcome.match} | steps: ${outcome.steps} | first deadline: ${due}${marks}`;
}

/** The whole of the command, without the process around it. */
export async function applyFlowsToOpenRecords(deps: ApplyFlowsDeps, options: ApplyFlowsOptions): Promise<ApplyFlowsResult> {
  const print = deps.print ?? ((line: string) => console.log(line));
  const switchOn = await deps.isSwitchOn();
  const result: ApplyFlowsResult = { dryRun: !options.write, switchOn, refused: null, candidates: 0, counts: {}, applied: 0, provisional: 0, deadlineRewritten: 0, errors: [], errorCount: 0, sample: [] };

  print(`Switch ${RECORDS_SWITCH}: ${switchOn ? 'ON' : 'OFF'}`);
  if (options.write && !switchOn && !options.evenIfOff) {
    result.refused = 'SWITCH_OFF';
    print(`REFUSED: the switch ${RECORDS_SWITCH} is OFF. Nothing was written.`);
    print(`With ${EVEN_IF_OFF_FLAG} the flows are created anyway, but they stay INVISIBLE (tabs, tracking and the alert column are behind the switch). The deadline column of a record with a confirmed flow and a legally verified deadline step is still rewritten.`);
    return result;
  }
  if (options.write && !switchOn) print(`${EVEN_IF_OFF_FLAG}: the flows are created but stay INVISIBLE until the switch is turned ON.`);
  print(options.write ? 'REAL RUN: one record per transaction.' : 'DRY RUN: every transaction is rolled back, nothing is stored.');

  const count = (kind: RecordKind, key: string) => {
    const ofKind = (result.counts[kind] ??= {});
    ofKind[key] = (ofKind[key] ?? 0) + 1;
  };
  const pageSize = options.pageSize ?? PAGE_SIZE;

  for (const kind of options.kinds) {
    let afterId: string | null = null;
    for (;;) {
      const left = options.limit === undefined ? pageSize : Math.min(pageSize, options.limit - result.candidates);
      if (left <= 0) break;
      const ids = await candidatePage(deps.db, kind, afterId, left, options);
      if (ids.length === 0) break;
      afterId = ids[ids.length - 1];

      for (const recordId of ids) {
        result.candidates += 1;
        try {
          if (options.write) {
            const outcome = await deps.applier.apply({ kind, recordId, reason: 'CLI', actorId: options.actorId });
            count(kind, outcomeKey(outcome));
            if (outcome.outcome === 'APPLIED') result.applied += 1;
          } else {
            const seen = await preview(deps, kind, recordId, options.actorId);
            count(kind, outcomeKey(seen.outcome));
            if (seen.outcome.outcome === 'APPLIED') result.applied += 1;
            if (seen.provisional) result.provisional += 1;
            if (seen.deadlineRewritten) result.deadlineRewritten += 1;
            if (result.sample.length < SAMPLE_SIZE) result.sample.push(sampleLine(kind, recordId, seen));
          }
        } catch (error) {
          // One record that cannot get its flow does not stop the others; it stays a candidate for the next run.
          count(kind, 'ERROR');
          result.errorCount += 1;
          if (result.errors.length < MAX_ERRORS_KEPT) result.errors.push({ kind, recordId, message: error instanceof Error ? error.message.slice(0, 300) : String(error) });
        }
        if (result.candidates % PROGRESS_EVERY === 0) print(`  … ${result.candidates} records looked at, ${result.applied} ${options.write ? 'applied' : 'would be applied'}, ${result.errorCount} failed`);
      }
      if (ids.length < left) break;
    }
  }

  print('');
  print(`Open records without a flow: ${result.candidates}${options.limit !== undefined ? ` (limit ${options.limit})` : ''}`);
  for (const kind of options.kinds) {
    const ofKind = result.counts[kind] ?? {};
    const total = Object.values(ofKind).reduce((sum, n) => sum + n, 0);
    print(`  ${kind}: ${total}`);
    for (const key of Object.keys(ofKind).sort()) print(`    ${key.padEnd(24)} ${ofKind[key]}${key === 'APPLIED:UNKNOWN_TYPE' ? '   (the type is not in the catalogue: the default flow is a PROPOSAL a person confirms)' : ''}`);
  }
  if (result.errorCount > 0) {
    print(`Failed: ${result.errorCount} (first ${result.errors.length} below; they stay candidates for the next run)`);
    for (const failure of result.errors) print(`  ${failure.kind} ${failure.recordId}: ${failure.message}`);
  }

  if (!options.write) {
    print(`Records with a PROVISIONAL deadline (the working calendar of a year it reaches is not published): ${result.provisional}`);
    print(`Records whose own deadline column the flow would REWRITE (confirmed flow, legally verified deadline step): ${result.deadlineRewritten}`);
    print('');
    print(`Sample (${result.sample.length} of ${result.candidates}):`);
    for (const line of result.sample) print(line);
    print('');
    print(`DRY RUN: nothing was written. Read the sample, then run again with ${REAL_RUN_FLAG} to apply${switchOn ? '' : ` (the switch is OFF: also ${EVEN_IF_OFF_FLAG}, and the flows stay invisible until it is ON)`}.`);
    return result;
  }

  // The run itself, beside the entry each applied flow wrote: who, when, how many. No record, no deadline.
  await deps.audit.log({
    userId: options.actorId ?? undefined,
    action: 'PROC_FLOW_BULK_APPLY_RUN',
    subject: 'ProcRecordFlow',
    metadata: { kinds: options.kinds, limit: options.limit ?? null, since: options.since?.toISOString() ?? null, switchOn, candidates: result.candidates, applied: result.applied, errors: result.errorCount, counts: result.counts },
  });
  print(`DONE: ${result.applied} flows applied, ${result.errorCount} failed. Running again applies only what is still missing.`);
  return result;
}

export interface ParsedArgs {
  kinds: RecordKind[];
  write: boolean;
  evenIfOff: boolean;
  limit?: number;
  since?: Date;
  actor?: string;
}

/** Reads `--name value` and `--name=value`. Throws on anything it does not know: a typo must not become a default. */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const parsed: ParsedArgs = { kinds: [], write: false, evenIfOff: false };
  for (let index = 0; index < argv.length; index += 1) {
    const [name, inline] = argv[index].split('=', 2);
    const value = () => {
      const given = inline ?? argv[(index += 1)];
      if (given === undefined || given.startsWith('--')) throw new Error(`${name} needs a value`);
      return given;
    };
    if (name === REAL_RUN_FLAG) parsed.write = true;
    else if (name === EVEN_IF_OFF_FLAG) parsed.evenIfOff = true;
    else if (name === '--kind') {
      for (const kind of value().split(',')) {
        const known = RECORD_KINDS.find((candidate) => candidate === kind.trim().toUpperCase());
        if (!known) throw new Error(`--kind must be one of ${RECORD_KINDS.join(', ')}`);
        if (!parsed.kinds.includes(known)) parsed.kinds.push(known);
      }
    } else if (name === '--limit') {
      const text = value();
      if (!/^[1-9]\d*$/.test(text)) throw new Error('--limit must be a positive whole number');
      parsed.limit = Number(text);
    } else if (name === '--since') {
      const text = value();
      // The day as people in Vietnam count it.
      const at = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(`${text}T00:00:00+07:00`) : new Date(NaN);
      if (Number.isNaN(at.getTime())) throw new Error('--since must be a day: YYYY-MM-DD');
      parsed.since = at;
    } else if (name === '--actor') parsed.actor = value();
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (parsed.kinds.length === 0) parsed.kinds = [...RECORD_KINDS];
  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is not set');
  const target = new URL(url);
  console.log(`Database: ${target.hostname}:${target.port || '5432'}${target.pathname}`);

  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    // The services as the application wires them, without the HTTP server, the schedulers and the outbox worker.
    const prisma = db as never;
    const audit = new AuditService(prisma);
    const flags = new FeatureFlagsService(prisma);
    const calendars = new WorkingCalendarService(prisma, audit);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    const gateway = new RecordGateway(new PetitionAdapter(prisma, scopes), new IncidentAdapter(prisma, scopes), new CaseAdapter(prisma, scopes));
    const applier = new FlowApplicationService(prisma, gateway, calendars, audit, new RecordDeadlineWriter(prisma, gateway, flags));

    let actorId: string | null = null;
    if (args.actor) {
      const user = await db.user.findFirst({ where: { username: args.actor }, select: { id: true } });
      if (!user) throw new Error(`--actor: no user named ${args.actor}`);
      actorId = user.id;
    }
    const result = await applyFlowsToOpenRecords(
      { db, applier, gateway, audit, isSwitchOn: () => flags.isEnabled(RECORDS_SWITCH) },
      { kinds: args.kinds, write: args.write, evenIfOff: args.evenIfOff, limit: args.limit, since: args.since, actorId },
    );
    if (result.refused || result.errorCount > 0) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
