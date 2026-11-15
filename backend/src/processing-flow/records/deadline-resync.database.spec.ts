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
import { DEADLINE_RESYNC_BATCH, DEADLINE_RESYNC_CHECKPOINT, DEADLINE_RESYNC_DONE, DEADLINE_RESYNC_REASON, DEADLINE_RESYNC_RECORD_REASON, LEGAL_VERIFIED_REASON } from './deadline-resync';
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

  describe('records the job cannot do at once (found by Codex)', () => {
    /** An outbox whose per-record work runs `before` first: a fault, or another worker, placed exactly where wanted. */
    const outboxWith = (before: (recordId: string) => Promise<void>) => {
      const wrapped = {
        apply: (input: Parameters<FlowApplicationService['apply']>[0]) => applier.apply(input),
        resyncDeadline: async (kind: 'PETITION', recordId: string, reason: string) => {
          await before(recordId);
          return applier.resyncDeadline(kind, recordId, reason);
        },
      };
      const service = new ProcessingOutboxService(scratch.db as never, { isEnabled: () => Promise.resolve(switchOn) } as never, wrapped as never);
      service.nudgeEnabled = false;
      return service;
    };
    const recordJobs = (recordId: string) => scratch.db.procOutbox.findMany({ where: { recordId, reason: DEADLINE_RESYNC_RECORD_REASON }, orderBy: { createdAt: 'asc' } });
    const makeDue = (recordId: string) => scratch.db.procOutbox.updateMany({ where: { recordId, status: 'PENDING' }, data: { availableAt: new Date(Date.now() - 1000) } });
    /** Drains until every job of the version, and (when asked) every waiting job of these records, has been looked at once more. */
    const drainUntil = async (service: ProcessingOutboxService, done: () => Promise<boolean>) => {
      for (let pass = 0; pass < 200; pass += 1) {
        if (await done()) return;
        await service.drain(5);
      }
      throw new Error('The drain never got there');
    };
    const versionDone = (flow: FlowDetailDto) => async () => (await jobsOf(flow)).every((job) => job.status !== 'PENDING');

    it('a record that keeps failing does not block the version: the others are done, the job ends, and the record is retried apart until it works', async () => {
      const flow = await publish([step()]);
      const ids: string[] = [];
      for (let n = 0; n < 5; n += 1) ids.push(await applied(flow));
      // The job goes through the records in the order of their flows.
      const ordered = (await scratch.db.procRecordFlow.findMany({ where: { recordId: { in: ids } }, orderBy: { id: 'asc' }, select: { recordId: true } })).map((row) => row.recordId);
      const broken = ordered[2];
      let fault = true;
      const faulty = outboxWith((recordId) => (fault && recordId === broken ? Promise.reject(new Error('this record cannot be written')) : Promise.resolve()));

      await verify(flow);
      await drainUntil(faulty, versionDone(flow));

      expect(await jobsOf(flow)).toMatchObject([{ status: 'DONE', outcome: `${DEADLINE_RESYNC_DONE} deferred=1` }]);
      for (const id of ordered) expect(await columnOf(id)).toBe(id === broken ? OLD_DEADLINE.toISOString() : FLOW_DEADLINE);
      const [waiting] = await recordJobs(broken);
      expect(await recordJobs(broken)).toHaveLength(1);
      expect(waiting).toMatchObject({ status: 'PENDING', recordKind: 'PETITION', lastError: 'this record cannot be written' });
      expect(waiting.availableAt.getTime()).toBeGreaterThan(Date.now());

      // Retried on its own, and counted: it would be given up on (DEAD) by itself, never taking the version with it.
      await makeDue(broken);
      await drainUntil(faulty, async () => (await recordJobs(broken))[0].attempts >= 1);
      expect((await recordJobs(broken))[0]).toMatchObject({ status: 'PENDING', attempts: 1, lastError: 'this record cannot be written' });
      expect(await columnOf(broken)).toBe(OLD_DEADLINE.toISOString());

      fault = false;
      await makeDue(broken);
      await drainUntil(faulty, async () => (await recordJobs(broken))[0].status !== 'PENDING');
      expect(await recordJobs(broken)).toMatchObject([{ status: 'DONE', outcome: 'WRITTEN', lastError: null }]);
      expect(await columnOf(broken)).toBe(FLOW_DEADLINE);
      expect(await writtenRows(broken)).toHaveLength(1);
    });

    it('a worker that lost its claim in the middle of a batch stops without touching the job, and no record is written twice', async () => {
      expect(DEADLINE_RESYNC_CHECKPOINT).toBeLessThan(DEADLINE_RESYNC_BATCH);
      const flow = await publish([step()]);
      const total = DEADLINE_RESYNC_CHECKPOINT * 2 + 5;
      const ids: string[] = [];
      for (let n = 0; n < total; n += 1) ids.push(await applied(flow));
      await verify(flow);
      const [job] = await jobsOf(flow);

      // During the third record another worker takes the job (its lease ran out for them): its claim, its cursor.
      const stolenLease = new Date(Date.now() + 240_000);
      let calls = 0;
      const first = outboxWith(async (recordId) => {
        if (!ids.includes(recordId)) return;
        calls += 1;
        if (calls === 3) await scratch.db.procOutbox.update({ where: { id: job.id }, data: { availableAt: stolenLease, outcome: 'AFTER:the-other-worker' } });
      });
      for (let pass = 0; pass < 100 && calls < 3; pass += 1) await first.drain(1);

      // It noticed at its next checkpoint: nothing of the job was overwritten, and it did not go on to the end.
      const after = await scratch.db.procOutbox.findUniqueOrThrow({ where: { id: job.id } });
      expect(after).toMatchObject({ status: 'PENDING', outcome: 'AFTER:the-other-worker' });
      expect(after.availableAt.getTime()).toBe(stolenLease.getTime());
      expect(calls).toBe(DEADLINE_RESYNC_CHECKPOINT);

      // The other worker does the whole version (from the start): every record once, one history row each.
      await scratch.db.procOutbox.update({ where: { id: job.id }, data: { outcome: null, availableAt: new Date(Date.now() - 1000) } });
      await drainJobsOf(flow);
      expect(await scratch.db.petition.count({ where: { id: { in: ids }, deadline: new Date(FLOW_DEADLINE) } })).toBe(total);
      const rows = await scratch.db.procStepChange.groupBy({ by: ['recordId'], where: { recordId: { in: ids }, action: 'RECORD_DEADLINE_WRITTEN' }, _count: true });
      expect(rows).toHaveLength(total);
      expect(rows.every((row) => row._count === 1)).toBe(true);
    });

    it('a record suspended when the job met it waits in a row of its own, uncounted, and is written after it resumes although no pause was ever recorded', async () => {
      const flow = await publish([step()]);
      const suspended = await applied(flow);
      const finished = await applied(flow);
      const deleted = await applied(flow);
      await scratch.db.petition.update({ where: { id: suspended }, data: { status: 'TAM_DINH_CHI' } });
      await scratch.db.petition.update({ where: { id: finished }, data: { status: 'DA_GIAI_QUYET' } });
      await scratch.db.petition.update({ where: { id: deleted }, data: { deletedAt: new Date() } });

      await verify(flow);
      await drainJobsOf(flow);
      expect(await jobsOf(flow)).toMatchObject([{ status: 'DONE', outcome: `${DEADLINE_RESYNC_DONE} deferred=1` }]);
      // Nothing is kept for a record that is history or gone.
      expect(await recordJobs(finished)).toHaveLength(0);
      expect(await recordJobs(deleted)).toHaveLength(0);
      const [waiting] = await recordJobs(suspended);
      expect(waiting).toMatchObject({ status: 'PENDING', attempts: 0, outcome: 'SUSPENDED', lastError: null });
      expect(waiting.availableAt.getTime()).toBeGreaterThan(Date.now());

      // Looked at again while still suspended: it waits on, and that is not a failed attempt.
      await makeDue(suspended);
      await drainUntil(outbox, async () => (await recordJobs(suspended))[0].availableAt.getTime() > Date.now());
      expect((await recordJobs(suspended))[0]).toMatchObject({ status: 'PENDING', attempts: 0, outcome: 'SUSPENDED' });
      expect(await columnOf(suspended)).toBe(OLD_DEADLINE.toISOString());

      // Resumed between two looks of the worker of the clock: no pause row exists, nothing else would ever write it.
      await scratch.db.petition.update({ where: { id: suspended }, data: { status: 'DANG_XU_LY' } });
      expect(await scratch.db.procRecordPause.count({ where: { recordFlow: { recordId: suspended } } })).toBe(0);
      await makeDue(suspended);
      await drainUntil(outbox, async () => (await recordJobs(suspended))[0].status !== 'PENDING');
      expect(await recordJobs(suspended)).toMatchObject([{ status: 'DONE', outcome: 'WRITTEN' }]);
      expect(await columnOf(suspended)).toBe(FLOW_DEADLINE);
      expect(await writtenRows(suspended)).toHaveLength(1);
    });

    it('a pause that closes because no step is worked any more, on a record STILL suspended, writes no deadline; the resumption does, once', async () => {
      const flow = await publish([step()]);
      const recordId = await applied(flow);
      await scratch.db.petition.update({ where: { id: recordId }, data: { status: 'TAM_DINH_CHI' } });
      await pauses.reconcile();
      expect(await scratch.db.procRecordPause.count({ where: { recordFlow: { recordId }, to: null } })).toBe(1);
      // The last step ends while the record is suspended and its figures are not verified yet.
      await scratch.db.procRecordStep.updateMany({ where: { recordId }, data: { status: 'DONE', doneAt: new Date('2026-12-03T03:00:00.000Z') } });
      await verify(flow);
      await drainJobsOf(flow);

      await pauses.reconcile();
      expect(await scratch.db.procRecordPause.count({ where: { recordFlow: { recordId }, to: null } })).toBe(0);
      expect(await columnOf(recordId)).toBe(OLD_DEADLINE.toISOString());
      expect(await writtenRows(recordId)).toHaveLength(0);

      await scratch.db.petition.update({ where: { id: recordId }, data: { status: 'DANG_XU_LY' } });
      await pauses.reconcile();
      await makeDue(recordId);
      await drainUntil(outbox, async () => (await recordJobs(recordId)).every((job) => job.status !== 'PENDING'));
      expect(await columnOf(recordId)).toBe(FLOW_DEADLINE);
      expect(await writtenRows(recordId)).toHaveLength(1);
    });

    it('a waiting row of this kind is not mistaken for "a flow is about to be applied": the request of a saved record is still written, and nothing runs while the switch is off', async () => {
      const flow = await publish([step()]);
      const recordId = await applied(flow);
      await scratch.db.petition.update({ where: { id: recordId }, data: { status: 'TAM_DINH_CHI' } });
      await verify(flow);
      await drainJobsOf(flow);
      expect(await recordJobs(recordId)).toMatchObject([{ status: 'PENDING' }]);

      await outbox.refreshSwitch();
      await scratch.db.$transaction((tx) => outbox.enqueue(tx, 'PETITION', recordId, 'CONVERTED'));
      const applyRows = await scratch.db.procOutbox.findMany({ where: { recordId, reason: 'CONVERTED' } });
      expect(applyRows).toMatchObject([{ status: 'PENDING' }]);

      // Switched off: neither row is claimed, although both are due and the record has resumed.
      await scratch.db.petition.update({ where: { id: recordId }, data: { status: 'DANG_XU_LY' } });
      await makeDue(recordId);
      switchOn = false;
      expect(await outbox.drain()).toEqual({ done: 0, retried: 0, dead: 0 });
      expect((await scratch.db.procOutbox.findMany({ where: { recordId } })).map((row) => [row.status, row.attempts])).toEqual([['PENDING', 0], ['PENDING', 0]]);
      expect(await columnOf(recordId)).toBe(OLD_DEADLINE.toISOString());

      switchOn = true;
      await drainUntil(outbox, async () => (await scratch.db.procOutbox.count({ where: { recordId, status: 'PENDING' } })) === 0);
      expect(await scratch.db.procOutbox.findMany({ where: { recordId }, orderBy: { createdAt: 'asc' }, select: { reason: true, outcome: true } })).toEqual([
        { reason: DEADLINE_RESYNC_RECORD_REASON, outcome: 'WRITTEN' },
        { reason: 'CONVERTED', outcome: 'ALREADY_APPLIED' },
      ]);
    });
  });
});
