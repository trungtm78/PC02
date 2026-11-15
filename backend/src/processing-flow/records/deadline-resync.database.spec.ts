import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { openScratchDatabase, type ScratchDatabase } from '../../common/testing/scratch-database';
import { takeTurnOnSharedRow } from '../../common/testing/shared-row-turn';
import { TeamsService } from '../../teams/teams.service';
import { WorkingCalendarService } from '../calendar/working-calendar.service';
import { ProcessingFlowsService, type FlowDetailDto } from '../config/processing-flows.service';
import { CaseAdapter } from '../gateway/case.adapter';
import { IncidentAdapter } from '../gateway/incident.adapter';
import { PetitionAdapter } from '../gateway/petition.adapter';
import { RecordGateway } from '../gateway/record-gateway';
import { DEADLINE_RESYNC_BATCH, DEADLINE_RESYNC_REASON, LEGAL_VERIFIED_REASON } from './deadline-resync';
import { FlowApplicationService } from './flow-application.service';
import { ProcessingCommandService } from './processing-command.service';
import { ProcessingDeadlineService } from './processing-deadline.service';
import { ProcessingOutboxService } from './processing-outbox.service';
import { ProcessingPauseService } from './processing-pause.service';
import { RecordDeadlineWriter } from './record-deadline-writer.service';

/**
 * The deadline column of the records that ALREADY follow a flow version, when a person verifies the legal figures of
 * the step that sets the record's deadline: on a REAL PostgreSQL. The verification writes one job in its own
 * transaction; the outbox worker then brings each record's column to the step's regulatory deadline, record by record
 * under the record's flow lock, a bounded number per pass, and leaves alone what the writer would not write.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database; works on rows of its own and removes them.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

const PREFIX = 'pfrs-test-';
const OLD_DEADLINE = new Date('2026-02-04T00:00:00.000Z');
/** 10 days from 1 December: the end of 11 December, Vietnam time. */
const FLOW_DEADLINE = '2026-12-11T16:59:59.999Z';
const EXTENDED_DEADLINE = '2026-12-21T16:59:59.999Z';

run('The deadline of records already on a flow version, after its legal figures are verified, on PostgreSQL', () => {
  jest.setTimeout(600_000);
  let scratch: ScratchDatabase;
  let flows: ProcessingFlowsService;
  let commands: ProcessingCommandService;
  let deadlines: ProcessingDeadlineService;
  let applier: FlowApplicationService;
  let writer: RecordDeadlineWriter;
  let outbox: ProcessingOutboxService;
  let pauses: ProcessingPauseService;
  let switchOn = true;
  const tag = `${PREFIX}${randomUUID().slice(0, 8)}`;
  let actor = '';
  let roleId = '';
  let unit = '';
  let counter = 0;
  const recordIds: string[] = [];
  const versionIds: string[] = [];
  const fresh = (what: string) => `${tag} ${what} ${++counter}`;

  const step = (over: Record<string, unknown> = {}) => ({
    name: 'Step',
    durationValue: 10,
    durationUnit: 'DAY',
    rollToWorkingDay: false,
    anchor: 'RECEIVED',
    redDays: 1,
    yellowDays: 2,
    greenDays: 3,
    legalBasis: 'Article 1',
    maxExtensions: 2,
    extensionValue: 10,
    extensionUnit: 'DAY',
    setsRecordDeadline: true,
    parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }],
    ...over,
  });

  const publish = async (steps: unknown[]): Promise<FlowDetailDto> => {
    const created = await flows.create(actor, { name: fresh('flow'), recordKind: 'PETITION' });
    const saved = await flows.replaceSteps(created.id, created.draft!.id, actor, { steps, expectedRevision: created.draft!.revision });
    const published = await flows.publish(created.id, saved.flow.draft!.id, actor, saved.flow.draft!.revision);
    versionIds.push(published.published!.id);
    return published;
  };
  const verify = (flow: FlowDetailDto, index = 0) => flows.verifyLegal(flow.id, flow.published!.id, flow.published!.steps[index].stepKey, actor, flow.published!.revision);

  const petition = async (over: Record<string, unknown> = {}) => {
    const row = await scratch.db.petition.create({
      data: {
        stt: fresh('p'),
        receivedDate: new Date('2026-12-01T00:00:00Z'),
        senderName: `${tag} sender`,
        loaiThongTin: `Không ai biết ${tag}`,
        enteredById: actor,
        assignedTeamId: unit,
        status: 'DANG_XU_LY',
        deadline: OLD_DEADLINE,
        ...over,
      } as never,
    });
    recordIds.push(row.id);
    return row.id;
  };
  const applied = async (flow: FlowDetailDto, over: Record<string, unknown> = {}) => {
    const recordId = await petition(over);
    expect(await applier.apply({ kind: 'PETITION', recordId, reason: 'REAPPLY', actorId: actor, flowId: flow.id })).toMatchObject({ outcome: 'APPLIED' });
    return recordId;
  };
  const columnOf = async (recordId: string) => (await scratch.db.petition.findUniqueOrThrow({ where: { id: recordId }, select: { deadline: true } })).deadline?.toISOString() ?? null;
  const writtenRows = (recordId: string) => scratch.db.procStepChange.findMany({ where: { recordId, action: 'RECORD_DEADLINE_WRITTEN' } });
  const jobsOf = (flow: FlowDetailDto) => scratch.db.procOutbox.findMany({ where: { recordId: flow.published!.id, reason: DEADLINE_RESYNC_REASON }, orderBy: { createdAt: 'asc' } });
  /** Drains until the jobs of this version are done (the scratch database is shared: other rows may come first). */
  const drainJobsOf = async (flow: FlowDetailDto) => {
    for (let pass = 0; pass < 200; pass += 1) {
      if ((await jobsOf(flow)).every((job) => job.status !== 'PENDING')) return;
      await outbox.drain(5);
    }
    throw new Error('The jobs of the version never finished');
  };

  const dropFlows = async () => {
    const { db } = scratch;
    const flow = { name: { startsWith: PREFIX } };
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
    await takeTurnOnSharedRow(scratch.pg, 'processing-flows');
    await dropFlows();

    roleId = (await db.role.create({ data: { name: `${tag}-role` } })).id;
    actor = (await db.user.create({ data: { username: `${tag}-actor`, passwordHash: 'x', roleId, isActive: true } })).id;
    unit = (await db.team.create({ data: { name: `${tag} unit`, code: `${tag}-U` } })).id;

    const prisma = db as never;
    const audit = new AuditService(prisma);
    const calendars = new WorkingCalendarService(prisma, audit);
    flows = new ProcessingFlowsService(prisma, audit, calendars);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    const gateway = new RecordGateway(new PetitionAdapter(prisma, scopes), new IncidentAdapter(prisma, scopes), new CaseAdapter(prisma, scopes));
    writer = new RecordDeadlineWriter(prisma, gateway);
    applier = new FlowApplicationService(prisma, gateway, calendars, audit, writer);
    commands = new ProcessingCommandService(prisma, gateway, calendars, applier, audit, writer);
    commands.now = () => new Date('2026-12-02T03:00:00.000Z');
    deadlines = new ProcessingDeadlineService(prisma, commands);
    outbox = new ProcessingOutboxService(prisma, { isEnabled: () => Promise.resolve(switchOn) } as never, applier);
    outbox.nudgeEnabled = false;
    pauses = new ProcessingPauseService(prisma, gateway, { isEnabled: () => Promise.resolve(true) } as never, writer);
    pauses.now = () => new Date('2026-12-03T03:00:00.000Z');
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    const flowIds = (await db.procRecordFlow.findMany({ where: { recordId: { in: recordIds } }, select: { id: true } })).map((row) => row.id);
    await db.auditLog.deleteMany({ where: { subject: 'ProcRecordFlow', subjectId: { in: flowIds } } });
    await db.procRecordPause.deleteMany({ where: { recordFlowId: { in: flowIds } } });
    await db.procCommandKey.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procStepChange.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procRecordStepParty.deleteMany({ where: { recordStep: { recordId: { in: recordIds } } } });
    await db.procRecordStep.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procRecordFlow.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procOutbox.deleteMany({ where: { recordId: { in: [...recordIds, ...versionIds] } } });
    await db.petition.deleteMany({ where: { id: { in: recordIds } } });
    await dropFlows();
    await db.auditLog.deleteMany({ where: { userId: actor } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.role.deleteMany({ where: { id: roleId } });
    await scratch.close();
  });

  beforeEach(() => {
    switchOn = true;
  });

  it('records that got the flow before the verification get the regulatory deadline of the deadline step after it, with a history row and an alert that agrees', async () => {
    const flow = await publish([step()]);
    const ids = [await applied(flow), await applied(flow), await applied(flow)];
    for (const id of ids) expect(await columnOf(id)).toBe(OLD_DEADLINE.toISOString());
    expect(await jobsOf(flow)).toHaveLength(0);

    await verify(flow);
    // The verification itself wrote the job and touched no record.
    expect(await jobsOf(flow)).toMatchObject([{ status: 'PENDING', recordKind: 'PETITION', attempts: 0 }]);
    for (const id of ids) expect(await columnOf(id)).toBe(OLD_DEADLINE.toISOString());

    await drainJobsOf(flow);
    expect(await jobsOf(flow)).toMatchObject([{ status: 'DONE', outcome: 'RESYNCED', lastError: null }]);
    for (const id of ids) {
      expect(await columnOf(id)).toBe(FLOW_DEADLINE);
      const rows = await writtenRows(id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ fromValue: { deadline: OLD_DEADLINE.toISOString() }, toValue: { deadline: FLOW_DEADLINE }, reason: LEGAL_VERIFIED_REASON, actorId: null });
      const stored = await scratch.db.procRecordFlow.findUniqueOrThrow({ where: { recordKind_recordId: { recordKind: 'PETITION', recordId: id } }, select: { alertDueAt: true } });
      expect(stored.alertDueAt?.toISOString()).toBe(FLOW_DEADLINE);
      expect(await writer.isManaged(scratch.db, 'PETITION', id)).toBe(true);
    }
  });

  it('leaves alone a record that is finished, suspended, deleted, or whose flow nobody confirmed', async () => {
    const flow = await publish([step()]);
    const finished = await applied(flow);
    const suspended = await applied(flow);
    const deleted = await applied(flow);
    const unconfirmed = await applied(flow);
    const working = await applied(flow);
    await scratch.db.petition.update({ where: { id: finished }, data: { status: 'DA_GIAI_QUYET' } });
    await scratch.db.petition.update({ where: { id: suspended }, data: { status: 'TAM_DINH_CHI' } });
    await scratch.db.petition.update({ where: { id: deleted }, data: { deletedAt: new Date() } });
    // The state a flow proposed for an unknown information type is in until a person confirms it.
    await scratch.db.procRecordFlow.update({ where: { recordKind_recordId: { recordKind: 'PETITION', recordId: unconfirmed } }, data: { confirmed: false } });

    await verify(flow);
    await drainJobsOf(flow);

    expect(await columnOf(working)).toBe(FLOW_DEADLINE);
    for (const id of [finished, suspended, deleted, unconfirmed]) {
      expect(await columnOf(id)).toBe(OLD_DEADLINE.toISOString());
      expect(await writtenRows(id)).toHaveLength(0);
    }
  });

  it('a record that was suspended when the job ran is brought in line when its suspension ends, even when no deadline moved', async () => {
    const flow = await publish([step()]);
    const recordId = await applied(flow);
    await scratch.db.petition.update({ where: { id: recordId }, data: { status: 'TAM_DINH_CHI' } });
    await pauses.reconcile();
    await verify(flow);
    await drainJobsOf(flow);
    expect(await columnOf(recordId)).toBe(OLD_DEADLINE.toISOString());

    // Resumed at the very instant it was suspended: the clock stood still for no time, no step moves.
    await scratch.db.petition.update({ where: { id: recordId }, data: { status: 'DANG_XU_LY' } });
    await pauses.reconcile();
    expect(await columnOf(recordId)).toBe(FLOW_DEADLINE);
    expect(await writtenRows(recordId)).toHaveLength(1);
  });

  it('doing the job again changes nothing: no second write, no second history row', async () => {
    const flow = await publish([step()]);
    const recordId = await applied(flow);
    await verify(flow);
    await drainJobsOf(flow);
    const [job] = await jobsOf(flow);

    await outbox.drain();
    // The same job put back by hand, as after a crash between the work and the mark.
    await scratch.db.procOutbox.update({ where: { id: job.id }, data: { status: 'PENDING', outcome: null, processedAt: null, availableAt: new Date(Date.now() - 1000) } });
    await drainJobsOf(flow);

    expect(await columnOf(recordId)).toBe(FLOW_DEADLINE);
    expect(await writtenRows(recordId)).toHaveLength(1);
    expect(await jobsOf(flow)).toMatchObject([{ status: 'DONE', outcome: 'RESYNCED' }]);
  });

  it('waits while the switch of flows on records is off, and runs once it is on again', async () => {
    const flow = await publish([step()]);
    const recordId = await applied(flow);
    switchOn = false;
    await verify(flow);
    expect(await jobsOf(flow)).toMatchObject([{ status: 'PENDING', attempts: 0 }]);

    expect(await outbox.drain()).toEqual({ done: 0, retried: 0, dead: 0 });
    expect(await jobsOf(flow)).toMatchObject([{ status: 'PENDING', attempts: 0 }]);
    expect(await columnOf(recordId)).toBe(OLD_DEADLINE.toISOString());

    switchOn = true;
    await drainJobsOf(flow);
    expect(await columnOf(recordId)).toBe(FLOW_DEADLINE);
  });

  it('a record whose step was extended meanwhile gets the EXTENDED regulatory deadline', async () => {
    const flow = await publish([step()]);
    const recordId = await applied(flow);
    const state = await commands.get('PETITION', recordId);
    await deadlines.extendStep(actor, 'PETITION', recordId, state.steps[0].stepKey, { expectedRevision: state.revision, reason: 'More time' });
    expect(await columnOf(recordId)).toBe(OLD_DEADLINE.toISOString());

    await verify(flow);
    await drainJobsOf(flow);
    expect(await columnOf(recordId)).toBe(EXTENDED_DEADLINE);
    expect((await writtenRows(recordId))[0]).toMatchObject({ toValue: { deadline: EXTENDED_DEADLINE }, reason: LEGAL_VERIFIED_REASON });
  });

  it('writes no job when the verified step is not the one that sets the deadline of the record, nor for a draft', async () => {
    const flow = await publish([step({ name: 'Other', setsRecordDeadline: false }), step({ name: 'The deadline', anchor: 'PREVIOUS_STEP_DONE' })]);
    await applied(flow);
    await verify(flow, 0);
    expect(await jobsOf(flow)).toHaveLength(0);

    const drafted = await flows.createDraft(flow.id, actor);
    versionIds.push(drafted.draft!.id);
    const deadlineStep = drafted.draft!.steps.find((entry) => entry.setsRecordDeadline)!;
    await flows.verifyLegal(flow.id, drafted.draft!.id, deadlineStep.stepKey, actor, drafted.draft!.revision);
    expect(await scratch.db.procOutbox.count({ where: { recordId: drafted.draft!.id } })).toBe(0);
  });

  it('taking a verification back writes no job and takes no deadline back: the column keeps what was written, and people may type it again', async () => {
    const flow = await publish([step()]);
    const recordId = await applied(flow);
    const verified = await verify(flow);
    await drainJobsOf(flow);
    expect(await columnOf(recordId)).toBe(FLOW_DEADLINE);

    await flows.unverifyLegal(flow.id, verified.published!.id, verified.published!.steps[0].stepKey, actor, verified.published!.revision);
    expect(await jobsOf(flow)).toHaveLength(1);
    await outbox.drain();
    expect(await columnOf(recordId)).toBe(FLOW_DEADLINE);
    expect(await writtenRows(recordId)).toHaveLength(1);
    expect(await writer.isManaged(scratch.db, 'PETITION', recordId)).toBe(false);
  });

  it('works through 250 records a bounded batch per pass, each record in a transaction of its own, and picks up where it stopped', async () => {
    expect(DEADLINE_RESYNC_BATCH).toBeLessThanOrEqual(100);
    const flow = await publish([step()]);
    const total = 250;
    const ids: string[] = [];
    for (let n = 0; n < total; n += 1) ids.push(await applied(flow));
    await verify(flow);
    const [job] = await jobsOf(flow);

    const doneCount = () => scratch.db.petition.count({ where: { id: { in: ids }, deadline: new Date(FLOW_DEADLINE) } });
    // One claim of the job at a time: after each, how many records are done. (Other sessions' rows may be claimed in
    // between; a pass that did not reach this job leaves the count where it was.)
    const progress: number[] = [];
    for (let pass = 0; pass < 200; pass += 1) {
      const current = await scratch.db.procOutbox.findUniqueOrThrow({ where: { id: job.id } });
      if (current.status !== 'PENDING') break;
      await outbox.drain(1);
      const count = await doneCount();
      if (progress[progress.length - 1] !== count) progress.push(count);
    }

    const passes = Math.ceil(total / DEADLINE_RESYNC_BATCH);
    expect(progress).toEqual(Array.from({ length: passes }, (_, index) => Math.min((index + 1) * DEADLINE_RESYNC_BATCH, total)));
    expect(await scratch.db.procOutbox.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ status: 'DONE', outcome: 'RESYNCED' });
    expect(await scratch.db.procStepChange.count({ where: { recordId: { in: ids }, action: 'RECORD_DEADLINE_WRITTEN' } })).toBe(total);
  });
});
