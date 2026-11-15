import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { openScratchDatabase, type ScratchDatabase } from '../../common/testing/scratch-database';
import { takeTurnOnSharedRow } from '../../common/testing/shared-row-turn';
import { LOAI_DANH_MUC_LOAI_THONG_TIN } from '../../common/utils/khoa-loai-thong-tin.util';
import { TeamsService } from '../../teams/teams.service';
import { WorkingCalendarService } from '../calendar/working-calendar.service';
import { ProcessingFlowsService } from '../config/processing-flows.service';
import { CaseAdapter } from '../gateway/case.adapter';
import { IncidentAdapter } from '../gateway/incident.adapter';
import { PetitionAdapter } from '../gateway/petition.adapter';
import { RecordGateway } from '../gateway/record-gateway';
import type { RecordKind } from '../gateway/record-snapshot';
import { FlowApplicationService } from '../records/flow-application.service';
import { clocklessStatuses } from '../records/record-alert';
import { RecordDeadlineWriter } from '../records/record-deadline-writer.service';
import { applyFlowsToOpenRecords, parseArgs, type ApplyFlowsDeps, type ApplyFlowsOptions } from './apply-flows-to-open-records';

/**
 * The command that applies flows to the records already open, on a REAL PostgreSQL: a dry run stores nothing, a real
 * run applies exactly the candidates, a second one finds nothing left, and one record that fails does not stop the
 * others.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database. The database is shared: every selection here
 * is narrowed to the records of this suite (`onlyIds`), and only its own rows are removed at the end.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

describe('parseArgs', () => {
  it('is a dry run of every kind when nothing is given', () => {
    expect(parseArgs([])).toEqual({ kinds: ['PETITION', 'INCIDENT', 'CASE'], write: false, evenIfOff: false });
  });

  it('reads the kinds, the limit, the day and the flags in both spellings', () => {
    const parsed = parseArgs(['--kind', 'petition,CASE', '--limit=20', '--since', '2026-01-01', '--that', '--even-if-off', '--actor=admin']);
    expect(parsed).toEqual({ kinds: ['PETITION', 'CASE'], write: true, evenIfOff: true, limit: 20, since: new Date('2025-12-31T17:00:00.000Z'), actor: 'admin' });
  });

  it('refuses what it does not know, so that a typo never becomes a default', () => {
    expect(() => parseArgs(['--kind', 'LETTER'])).toThrow('--kind');
    expect(() => parseArgs(['--limit', '0'])).toThrow('--limit');
    expect(() => parseArgs(['--since', '01/01/2026'])).toThrow('--since');
    expect(() => parseArgs(['--kind'])).toThrow('needs a value');
    expect(() => parseArgs(['--thta'])).toThrow('Unknown argument');
  });

  it('a switch with a value is refused: `--that=false` must never be a real run (found by Codex)', () => {
    expect(() => parseArgs(['--that=false'])).toThrow('takes no value');
    expect(() => parseArgs(['--that=true'])).toThrow('takes no value');
    expect(() => parseArgs(['--even-if-off=false'])).toThrow('takes no value');
  });

  it('a day that does not exist is refused, not moved to another day', () => {
    expect(() => parseArgs(['--since', '2026-02-30'])).toThrow('--since');
    expect(() => parseArgs(['--since=2026-13-01'])).toThrow('--since');
    expect(parseArgs(['--since', '2024-02-29']).since).toEqual(new Date('2024-02-28T17:00:00.000Z'));
  });
});

run('applyFlowsToOpenRecords on PostgreSQL', () => {
  jest.setTimeout(300_000);
  let scratch: ScratchDatabase;
  let flows: ProcessingFlowsService;
  let applier: FlowApplicationService;
  let gateway: RecordGateway;
  let audit: AuditService;
  const tag = `pfcli-test-${randomUUID().slice(0, 8)}`;
  let actor = '';
  let roleId = '';
  let unit = '';
  let counter = 0;
  const catalogue: Record<string, string> = {};
  const flowNames: Partial<Record<RecordKind, string>> = {};
  const mine: Record<RecordKind, string[]> = { PETITION: [], INCIDENT: [], CASE: [] };
  /** The open petitions, in the order of their id (the order the command reads them in). */
  let openPetitions: string[] = [];
  let finishedPetition = '';
  let deletedPetition = '';
  let oldPetition = '';
  let openCase = '';
  let openIncident = '';
  /** How many records the dry run said would get a provisional deadline (it depends on the calendars the database holds). */
  let provisionalForeseen = -1;
  const fresh = (what: string) => `${tag} ${what} ${++counter}`;
  const allIds = () => [...mine.PETITION, ...mine.INCIDENT, ...mine.CASE];

  const publishedFlow = async (kind: RecordKind, bindTo: string) => {
    const steps = [{ name: 'Check', durationValue: 10, durationUnit: 'DAY', anchor: 'RECEIVED', redDays: 1, yellowDays: 2, greenDays: 3, legalBasis: 'Article 1', parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }] }];
    const flow = await flows.create(actor, { name: fresh('flow'), recordKind: kind, isDefault: false });
    const saved = await flows.replaceSteps(flow.id, flow.draft!.id, actor, { steps, expectedRevision: flow.draft!.revision } as never);
    const done = await flows.publish(flow.id, saved.flow.draft!.id, actor, saved.flow.draft!.revision);
    await flows.setBindings(done.id, actor, { directoryIds: [catalogue[bindTo]], deadlineGroups: [], expectedRevision: done.revision });
    flowNames[kind] = done.name;
  };

  const petition = async (over: Record<string, unknown> = {}) => {
    const row = await scratch.db.petition.create({
      data: { stt: fresh('p'), receivedDate: new Date('2026-12-01T00:00:00Z'), senderName: `${tag} sender`, loaiThongTin: `Tố cáo ${tag}`, enteredById: actor, assignedTeamId: unit, status: 'DANG_XU_LY', ...over } as never,
    });
    mine.PETITION.push(row.id);
    return row.id;
  };

  /** What the command may write, counted over the rows of this suite only. */
  const footprint = async () => {
    const { db } = scratch;
    const ids = allIds();
    return {
      flows: await db.procRecordFlow.count({ where: { recordId: { in: ids } } }),
      steps: await db.procRecordStep.count({ where: { recordId: { in: ids } } }),
      changes: await db.procStepChange.count({ where: { recordId: { in: ids } } }),
      audit: await db.auditLog.count({ where: { userId: actor } }),
      outbox: await db.procOutbox.count({ where: { recordId: { in: ids } } }),
      petitions: JSON.stringify(await db.petition.findMany({ where: { id: { in: mine.PETITION } }, orderBy: { id: 'asc' } })),
      cases: JSON.stringify(await db.case.findMany({ where: { id: { in: mine.CASE } }, orderBy: { id: 'asc' } })),
    };
  };
  const withFlow = async () => (await scratch.db.procRecordFlow.findMany({ where: { recordId: { in: allIds() } }, select: { recordId: true } })).map((row) => row.recordId).sort();

  const lines: string[] = [];
  const deps = (over: Partial<ApplyFlowsDeps> = {}): ApplyFlowsDeps => ({ db: scratch.db, applier, gateway, audit, isSwitchOn: async () => true, print: (line) => lines.push(line), ...over });
  const options = (over: Partial<ApplyFlowsOptions> = {}): ApplyFlowsOptions => ({ kinds: ['PETITION', 'INCIDENT', 'CASE'], write: false, evenIfOff: false, actorId: actor, onlyIds: allIds(), pageSize: 2, ...over });

  const dropFlows = async () => {
    const { db } = scratch;
    const flow = { name: { startsWith: tag } };
    await db.procFlowStepVariant.deleteMany({ where: { step: { version: { flow } } } });
    await db.procFlowStepParty.deleteMany({ where: { step: { version: { flow } } } });
    await db.procFlowStep.deleteMany({ where: { version: { flow } } });
    await db.procFlowVersion.deleteMany({ where: { flow } });
    await db.procFlowBinding.deleteMany({ where: { flow } });
    await db.procFlow.deleteMany({ where: flow });
  };

  beforeAll(async () => {
    scratch = await openScratchDatabase(url as string);
    const { db } = scratch;
    // A default flow of another suite would turn "no flow for an incident" into a proposal: take the turn they take.
    await takeTurnOnSharedRow(scratch.pg, 'processing-flows');
    const foreign = await db.procFlow.findMany({ where: { isDefault: true, status: 'ACTIVE' }, select: { name: true } });
    if (foreign.length > 0) throw new Error(`The scratch database already holds default flows: ${JSON.stringify(foreign)}`);

    roleId = (await db.role.create({ data: { name: `${tag}-role` } })).id;
    actor = (await db.user.create({ data: { username: `${tag}-actor`, passwordHash: 'x', roleId, isActive: true } })).id;
    unit = (await db.team.create({ data: { name: `${tag} unit`, code: `${tag}-U` } })).id;
    for (const [key, name] of [['denunciation', `Tố cáo ${tag}`], ['complaint', `Khiếu nại ${tag}`]] as const) {
      catalogue[key] = (await db.directory.create({ data: { type: LOAI_DANH_MUC_LOAI_THONG_TIN, code: `${tag}-${key}`, name } })).id;
    }

    const prisma = db as never;
    audit = new AuditService(prisma);
    const calendars = new WorkingCalendarService(prisma, audit);
    flows = new ProcessingFlowsService(prisma, audit, calendars);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    gateway = new RecordGateway(new PetitionAdapter(prisma, scopes), new IncidentAdapter(prisma, scopes), new CaseAdapter(prisma, scopes));
    applier = new FlowApplicationService(prisma, gateway, calendars, audit, new RecordDeadlineWriter(prisma, gateway));

    await publishedFlow('PETITION', 'denunciation');
    await publishedFlow('CASE', 'complaint');

    oldPetition = await petition({ createdAt: new Date('2020-01-01T00:00:00Z') });
    await petition();
    await petition();
    openPetitions = [...mine.PETITION].sort();
    finishedPetition = await petition({ status: clocklessStatuses('PETITION')[0] });
    deletedPetition = await petition({ deletedAt: new Date() });
    openCase = (
      await db.case.create({
        data: { name: fresh('case'), caseCode: fresh('c'), caseProvenance: 'DIRECT_DISCOVERY', investigatorId: actor, assignedTeamId: unit, status: 'DANG_DIEU_TRA', receiveDate: new Date('2026-12-01T00:00:00Z'), loaiThongTin: `Khiếu nại ${tag}` } as never,
      })
    ).id;
    mine.CASE.push(openCase);
    // No flow is bound for incidents, and no default flow exists: this one has nothing to follow.
    openIncident = (
      await db.incident.create({ data: { code: `${tag}-i1`, name: `${tag} incident`, loaiThongTin: `Tố cáo ${tag}`, investigatorId: actor, assignedTeamId: unit, status: 'DANG_XAC_MINH' } as never })
    ).id;
    mine.INCIDENT.push(openIncident);
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    const ids = allIds();
    await db.auditLog.deleteMany({ where: { userId: actor } });
    await db.procStepChange.deleteMany({ where: { recordId: { in: ids } } });
    await db.procRecordStepParty.deleteMany({ where: { recordStep: { recordId: { in: ids } } } });
    await db.procRecordStep.deleteMany({ where: { recordId: { in: ids } } });
    await db.procRecordFlow.deleteMany({ where: { recordId: { in: ids } } });
    await db.petition.deleteMany({ where: { id: { in: mine.PETITION } } });
    await db.case.deleteMany({ where: { id: { in: mine.CASE } } });
    await db.incident.deleteMany({ where: { id: { in: mine.INCIDENT } } });
    await dropFlows();
    await db.directory.deleteMany({ where: { code: { startsWith: tag } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.role.deleteMany({ where: { id: roleId } });
    await scratch.close();
  });

  beforeEach(() => {
    lines.length = 0;
  });

  it('a dry run says what would happen to each open record and stores nothing', async () => {
    const before = await footprint();

    const result = await applyFlowsToOpenRecords(deps(), options());

    expect(await footprint()).toEqual(before);
    expect(before.flows).toBe(0);
    expect(result).toMatchObject({ dryRun: true, refused: null, candidates: 5, applied: 4, errorCount: 0, deadlineRewritten: 0 });
    provisionalForeseen = result.provisional;
    // The finished and the deleted petition are not candidates at all.
    expect(result.counts).toEqual({ PETITION: { 'APPLIED:TYPE': 3 }, INCIDENT: { NO_FLOW: 1 }, CASE: { 'APPLIED:TYPE': 1 } });
    expect(result.sample).toHaveLength(5);
    const petitionLine = result.sample.find((line) => line.includes(flowNames.PETITION as string));
    expect(petitionLine).toContain(`type: Tố cáo ${tag}`);
    expect(petitionLine).toContain('match: TYPE | steps: 1 | first deadline: 2026-12-11 23:59');
    expect(result.sample.find((line) => line.includes('INCIDENT'))).toContain('NO_FLOW');
    expect(lines.join('\n')).toContain('DRY RUN: nothing was written');
    expect(lines.join('\n')).toContain('--that');
  });

  it('a dry run reads only the records created since the day asked for', async () => {
    const result = await applyFlowsToOpenRecords(deps(), options({ kinds: ['PETITION'], since: new Date('2021-01-01T00:00:00+07:00') }));

    expect(result.candidates).toBe(2);
    expect(result.sample.join('\n')).not.toContain(oldPetition);
    expect(await withFlow()).toEqual([]);
  });

  it('a real run is refused while the switch is off, and says what --even-if-off would mean', async () => {
    const before = await footprint();

    const result = await applyFlowsToOpenRecords(deps({ isSwitchOn: async () => false }), options({ write: true }));

    expect(result).toMatchObject({ refused: 'SWITCH_OFF', candidates: 0, applied: 0 });
    expect(await footprint()).toEqual(before);
    expect(lines.join('\n')).toContain('REFUSED');
    expect(lines.join('\n')).toContain('INVISIBLE');
  });

  it('a real run of one kind with a limit applies that many records of that kind, lowest id first', async () => {
    const result = await applyFlowsToOpenRecords(deps(), options({ write: true, kinds: ['PETITION'], limit: 1 }));

    expect(result).toMatchObject({ dryRun: false, candidates: 1, applied: 1, counts: { PETITION: { 'APPLIED:TYPE': 1 } } });
    expect(await withFlow()).toEqual([openPetitions[0]]);
    const stored = await scratch.db.procRecordFlow.findUniqueOrThrow({ where: { recordKind_recordId: { recordKind: 'PETITION', recordId: openPetitions[0] } }, include: { steps: true } });
    expect(stored).toMatchObject({ match: 'TYPE', confirmed: true, appliedById: actor });
    expect(stored.steps).toHaveLength(1);
    const change = await scratch.db.procStepChange.findFirstOrThrow({ where: { recordId: openPetitions[0], action: 'FLOW_APPLIED' } });
    expect(change.toValue).toMatchObject({ reason: 'CLI' });
  });

  it('a record that fails is reported and the records after it still get their flow, also while the switch is off with --even-if-off', async () => {
    const failing = openPetitions[1];
    const flaky: ApplyFlowsDeps['applier'] = {
      applyIn: async (tx, input) => {
        if (input.recordId === failing) throw new Error('this one cannot be applied');
        return applier.applyIn(tx, input);
      },
      apply: (input) => applier.apply(input),
    };

    const result = await applyFlowsToOpenRecords(deps({ applier: flaky, isSwitchOn: async () => false }), options({ write: true, evenIfOff: true }));

    expect(result).toMatchObject({ refused: null, candidates: 4, applied: 2, errorCount: 1 });
    expect(result.errors).toEqual([{ kind: 'PETITION', recordId: failing, message: 'this one cannot be applied' }]);
    expect(result.counts).toEqual({ PETITION: { ERROR: 1, 'APPLIED:TYPE': 1 }, INCIDENT: { NO_FLOW: 1 }, CASE: { 'APPLIED:TYPE': 1 } });
    expect(await withFlow()).toEqual([openPetitions[0], openPetitions[2], openCase].sort());
    expect(lines.join('\n')).toContain('INVISIBLE');
  });

  it('a record suspended after its page was read, and before its turn, gets no flow (found by Codex)', async () => {
    const late = openPetitions[1];
    // The page was read while the record was open; by its turn the record says it is suspended.
    const seesSuspension = { load: async (...args: Parameters<typeof gateway.load>) => {
      const snapshot = await gateway.load(...args);
      return snapshot && args[1] === late ? { ...snapshot, isSuspended: true } : snapshot;
    } } as unknown as ApplyFlowsDeps['gateway'];

    const result = await applyFlowsToOpenRecords(deps({ gateway: seesSuspension }), options({ write: true }));

    expect(result).toMatchObject({ applied: 0, errorCount: 0 });
    expect(result.counts.PETITION).toEqual({ NO_LONGER_OPEN: 1 });
    expect(await withFlow()).not.toContain(late);
  });

  it('running again applies only what is still missing, and a run after that applies nothing', async () => {
    const second = await applyFlowsToOpenRecords(deps(), options({ write: true }));
    expect(second).toMatchObject({ candidates: 2, applied: 1, errorCount: 0 });
    expect(second.counts).toEqual({ PETITION: { 'APPLIED:TYPE': 1 }, INCIDENT: { NO_FLOW: 1 } });

    const before = await footprint();
    const third = await applyFlowsToOpenRecords(deps(), options({ write: true }));
    expect(third).toMatchObject({ candidates: 1, applied: 0, errorCount: 0, counts: { INCIDENT: { NO_FLOW: 1 } } });
    // Nothing but the audit entry of the run itself.
    expect(await footprint()).toEqual({ ...before, audit: before.audit + 1 });

    // Every open record that has a flow to follow has exactly one; the finished, the deleted and the incident have none.
    expect(await withFlow()).toEqual([...openPetitions, openCase].sort());
    expect(await scratch.db.procRecordFlow.count({ where: { recordId: { in: [finishedPetition, deletedPetition, openIncident] } } })).toBe(0);

    // What the dry run foresaw about provisional deadlines is what was stored.
    const provisional = await scratch.db.procRecordStep.findMany({ where: { recordId: { in: allIds() }, provisional: true }, select: { recordId: true }, distinct: ['recordId'] });
    expect(provisional).toHaveLength(provisionalForeseen);
  });

  it('each real run leaves one audit entry with counts only', async () => {
    const runs = await scratch.db.auditLog.findMany({ where: { userId: actor, action: 'PROC_FLOW_BULK_APPLY_RUN' }, orderBy: { createdAt: 'asc' } });
    // Five real runs above: one record, the failing one, the suspended one, the second pass, the pass with nothing left.
    expect(runs).toHaveLength(5);
    expect(runs[0].metadata).toMatchObject({ kinds: ['PETITION'], limit: 1, candidates: 1, applied: 1, errors: 0 });
    const text = JSON.stringify(runs.map((row) => row.metadata));
    for (const id of allIds()) expect(text).not.toContain(id);
    expect(text).not.toContain(tag);
  });
});
