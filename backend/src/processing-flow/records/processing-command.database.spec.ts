import { HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { openScratchDatabase, type ScratchDatabase } from '../../common/testing/scratch-database';
import { takeTurnOnSharedRow } from '../../common/testing/shared-row-turn';
import { TeamsService } from '../../teams/teams.service';
import { WorkingCalendarService } from '../calendar/working-calendar.service';
import { ProcessingFlowsService } from '../config/processing-flows.service';
import { CaseAdapter } from '../gateway/case.adapter';
import { IncidentAdapter } from '../gateway/incident.adapter';
import { PetitionAdapter } from '../gateway/petition.adapter';
import { RecordGateway } from '../gateway/record-gateway';
import { FlowApplicationService } from './flow-application.service';
import { RecordDeadlineWriter } from './record-deadline-writer.service';
import { ProcessingCommandService } from './processing-command.service';
import type { RecordFlowDto } from './record-flow.dto';

/**
 * The commands on the steps of a record, on a REAL PostgreSQL: complete, reopen, skip and un-skip a step, record the
 * date of acceptance, confirm a proposed flow. What each writes (the step, the step that follows it, the history, the
 * audit), what it refuses, and the guarantees of the command layer: a stale revision is refused, a retried key does
 * nothing the second time, two writes at once leave exactly one.
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

const PREFIX = 'pfm-test-';

run('ProcessingCommandService on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let flows: ProcessingFlowsService;
  let commands: ProcessingCommandService;
  const tag = `${PREFIX}${randomUUID().slice(0, 8)}`;
  let actor = '';
  let roleId = '';
  let unit = '';
  let counter = 0;
  const recordIds: string[] = [];
  const fresh = (what: string) => `${tag} ${what} ${++counter}`;

  const step = (over: Record<string, unknown> = {}) => ({
    name: 'Step',
    durationValue: 5,
    durationUnit: 'DAY',
    rollToWorkingDay: false,
    anchor: 'RECEIVED',
    redDays: 1,
    yellowDays: 2,
    greenDays: 3,
    legalBasis: 'Article 1',
    parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }],
    ...over,
  });

  /** A published PETITION flow with the steps given. */
  const publishedFlow = async (steps: unknown[], isDefault = false) => {
    const flow = await flows.create(actor, { name: fresh('flow'), recordKind: 'PETITION', isDefault });
    const saved = await flows.replaceSteps(flow.id, flow.draft!.id, actor, { steps, expectedRevision: flow.draft!.revision });
    return flows.publish(flow.id, saved.flow.draft!.id, actor, saved.flow.draft!.revision);
  };

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
        ...over,
      } as never,
    });
    recordIds.push(row.id);
    return row.id;
  };

  /** A petition with the flow of `steps` applied (chosen by hand, so nothing needs binding). */
  const withFlow = async (steps: unknown[]) => {
    const flow = await publishedFlow(steps);
    const recordId = await petition();
    await commands.apply(actor, 'PETITION', recordId, { flowId: flow.id });
    return { recordId, flow, get: () => commands.get('PETITION', recordId) };
  };
  const stepOf = (dto: RecordFlowDto, index: number) => dto.steps[index];

  const failure = async (attempt: Promise<unknown>) => {
    try {
      await attempt;
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      return { status: error.getStatus(), code: (error.getResponse() as { code?: unknown }).code };
    }
    return 'RESOLVED' as const;
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
    const foreign = await db.procFlow.findMany({ where: { isDefault: true, status: 'ACTIVE' }, select: { name: true } });
    if (foreign.length > 0) throw new Error(`The scratch database already holds default flows: ${JSON.stringify(foreign)}`);

    roleId = (await db.role.create({ data: { name: `${tag}-role` } })).id;
    actor = (await db.user.create({ data: { username: `${tag}-actor`, passwordHash: 'x', roleId, isActive: true } })).id;
    unit = (await db.team.create({ data: { name: `${tag} unit`, code: `${tag}-U` } })).id;

    const prisma = db as never;
    const audit = new AuditService(prisma);
    const calendars = new WorkingCalendarService(prisma, audit);
    flows = new ProcessingFlowsService(prisma, audit, calendars);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    const gateway = new RecordGateway(new PetitionAdapter(prisma, scopes), new IncidentAdapter(prisma, scopes), new CaseAdapter(prisma, scopes));
    const applier = new FlowApplicationService(prisma, gateway, calendars, audit, new RecordDeadlineWriter(prisma, gateway));
    commands = new ProcessingCommandService(prisma, gateway, calendars, applier, audit, new RecordDeadlineWriter(prisma, gateway));
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    const flowIds = (await db.procRecordFlow.findMany({ where: { recordId: { in: recordIds } }, select: { id: true } })).map((row) => row.id);
    await db.auditLog.deleteMany({ where: { subject: 'ProcRecordFlow', subjectId: { in: flowIds } } });
    await db.procCommandKey.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procStepChange.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procRecordStepParty.deleteMany({ where: { recordStep: { recordId: { in: recordIds } } } });
    await db.procRecordStep.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procRecordFlow.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.petition.deleteMany({ where: { id: { in: recordIds } } });
    await dropFlows();
    await db.auditLog.deleteMany({ where: { userId: actor } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.role.deleteMany({ where: { id: roleId } });
    await scratch.close();
  });

  beforeEach(() => {
    commands.now = () => new Date('2026-12-02T03:00:00.000Z'); // 10:00 Vietnam time
  });

  describe('completing a step', () => {
    it('finishes it, starts the step counted from it at that moment, and writes the history and the audit', async () => {
      const { recordId, get } = await withFlow([step({ name: 'First' }), step({ name: 'Second', anchor: 'PREVIOUS_STEP_DONE', durationValue: 10 })]);
      const before = await get();
      expect(stepOf(before, 1)).toMatchObject({ status: 'WAITING_ANCHOR', dueAt: null, band: 'NONE' });

      const after = await commands.completeStep(actor, 'PETITION', recordId, stepOf(before, 0).stepKey, { expectedRevision: before.revision });
      expect(after.revision).toBe(before.revision + 1);
      expect(stepOf(after, 0)).toMatchObject({ status: 'DONE', doneAt: '2026-12-02T03:00:00.000Z', completion: 'DONE_ON_TIME', band: 'NONE' });
      // 2 December + 10 days: the end of 12 December, Vietnam time.
      expect(stepOf(after, 1)).toMatchObject({ status: 'OPEN', startAt: '2026-12-02T03:00:00.000Z', regulatoryDueAt: '2026-12-12T16:59:59.999Z', internalDueAt: '2026-12-12T16:59:59.999Z', deadlineRevision: 1 });

      const history = await scratch.db.procStepChange.findMany({ where: { recordId }, orderBy: { at: 'asc' } });
      expect(history.map((row) => row.action)).toEqual(['FLOW_APPLIED', 'STEP_COMPLETED', 'STEP_STARTED']);
      expect(history[1]).toMatchObject({ stepKey: stepOf(before, 0).stepKey, actorId: actor });
      const audit = await scratch.db.auditLog.findMany({ where: { subject: 'ProcRecordFlow', subjectId: before.id, action: 'PROC_STEP_COMPLETE' } });
      expect(audit).toHaveLength(1);
      expect(JSON.stringify(audit[0].metadata)).not.toContain('2026-12');
    });

    it('colours a step being worked by the clock: red on the last day, overdue after it', async () => {
      const { get } = await withFlow([step({ durationValue: 5 })]);
      // The deadline is the end of 6 December (Vietnam). The thresholds are 1 / 2 / 3 days.
      commands.now = () => new Date('2026-12-03T03:00:00.000Z'); // three days before: green
      expect(stepOf(await get(), 0)).toMatchObject({ band: 'GREEN', remainingDays: 3, completion: 'OPEN_IN_TIME' });
      commands.now = () => new Date('2026-12-06T03:00:00.000Z'); // the due day: red
      expect(stepOf(await get(), 0)).toMatchObject({ band: 'RED', remainingDays: 0 });
      commands.now = () => new Date('2026-12-07T03:00:00.000Z'); // after: overdue
      expect(stepOf(await get(), 0)).toMatchObject({ band: 'OVERDUE', completion: 'OPEN_OVERDUE' });
    });

    it('a step that asks for approval is not completed by hand: it is reported first', async () => {
      const { recordId, get } = await withFlow([step({ requiresApproval: true })]);
      const before = await get();
      expect(await failure(commands.completeStep(actor, 'PETITION', recordId, stepOf(before, 0).stepKey, { expectedRevision: before.revision }))).toEqual({ status: 409, code: 'STEP_NEEDS_APPROVAL' });
      expect(stepOf(await get(), 0).status).toBe('OPEN');
    });

    it('a step that is not open, and a step that is not there, are refused with their codes', async () => {
      const { recordId, get } = await withFlow([step(), step({ anchor: 'PREVIOUS_STEP_DONE' })]);
      const before = await get();
      expect(await failure(commands.completeStep(actor, 'PETITION', recordId, stepOf(before, 1).stepKey, { expectedRevision: before.revision }))).toEqual({ status: 409, code: 'STEP_TRANSITION_INVALID' });
      expect(await failure(commands.completeStep(actor, 'PETITION', recordId, 'nope', { expectedRevision: before.revision }))).toEqual({ status: 404, code: 'RECORD_STEP_NOT_FOUND' });
      expect(await failure(commands.completeStep(actor, 'PETITION', `${tag}-no-record`, 'x', { expectedRevision: 1 }))).toEqual({ status: 404, code: 'RECORD_FLOW_NOT_FOUND' });
    });
  });

  describe('the guarantees of every write', () => {
    it('a revision that is not the current one is refused and nothing changes', async () => {
      const { recordId, get } = await withFlow([step()]);
      const before = await get();
      expect(await failure(commands.completeStep(actor, 'PETITION', recordId, stepOf(before, 0).stepKey, { expectedRevision: before.revision + 4 }))).toEqual({ status: 409, code: 'REVISION_CONFLICT' });
      expect(await failure(commands.completeStep(actor, 'PETITION', recordId, stepOf(before, 0).stepKey, { expectedRevision: 0 }))).toEqual({ status: 400, code: 'EXPECTED_REVISION_INVALID' });
      expect(await get()).toEqual(before);
    });

    it('two writes at once on the same revision leave exactly one: the other is told the flow moved', async () => {
      const { recordId, get } = await withFlow([step(), step({ anchor: 'PREVIOUS_STEP_DONE' })]);
      const before = await get();
      const key = stepOf(before, 0).stepKey;
      const [a, b] = await Promise.all([
        failure(commands.completeStep(actor, 'PETITION', recordId, key, { expectedRevision: before.revision })),
        failure(commands.completeStep(actor, 'PETITION', recordId, key, { expectedRevision: before.revision })),
      ]);
      expect([a, b].filter((result) => result === 'RESOLVED')).toHaveLength(1);
      expect([a, b].filter((result) => result !== 'RESOLVED')).toEqual([{ status: 409, code: 'REVISION_CONFLICT' }]);
      expect(await scratch.db.procStepChange.count({ where: { recordId, action: 'STEP_COMPLETED' } })).toBe(1);
    });

    it('a retried write with the same key does nothing the second time and gives the same answer', async () => {
      const { recordId, get } = await withFlow([step(), step({ anchor: 'PREVIOUS_STEP_DONE' })]);
      const before = await get();
      const input = { expectedRevision: before.revision, idempotencyKey: `${tag}-key-complete-1` };
      const first = await commands.completeStep(actor, 'PETITION', recordId, stepOf(before, 0).stepKey, input);
      // The answer was lost: the app sends the very same request again, even though the revision has moved on since.
      const again = await commands.completeStep(actor, 'PETITION', recordId, stepOf(before, 0).stepKey, input);
      expect(again).toEqual(first);
      expect(await scratch.db.procStepChange.count({ where: { recordId, action: 'STEP_COMPLETED' } })).toBe(1);
      expect((await get()).revision).toBe(first.revision);
    });

    it('a key used for another command or another person is refused, and a malformed key is refused', async () => {
      const { recordId, get } = await withFlow([step(), step({ anchor: 'PREVIOUS_STEP_DONE' })]);
      const before = await get();
      const key = `${tag}-key-shared-2`;
      await commands.skipStep(actor, 'PETITION', recordId, stepOf(before, 0).stepKey, { expectedRevision: before.revision, reason: 'Not needed', idempotencyKey: key });
      const now = await get();
      expect(await failure(commands.reopenStep(actor, 'PETITION', recordId, stepOf(before, 0).stepKey, { expectedRevision: now.revision, idempotencyKey: key }))).toEqual({ status: 409, code: 'IDEMPOTENCY_KEY_REUSED' });
      expect(await failure(commands.unskipStep('someone-else', 'PETITION', recordId, stepOf(before, 0).stepKey, { expectedRevision: now.revision, idempotencyKey: key }))).toEqual({ status: 409, code: 'IDEMPOTENCY_KEY_REUSED' });
      expect(await failure(commands.unskipStep(actor, 'PETITION', recordId, stepOf(before, 0).stepKey, { expectedRevision: now.revision, idempotencyKey: 'x' }))).toEqual({ status: 400, code: 'IDEMPOTENCY_KEY_INVALID' });
    });
  });

  describe('reopening a step', () => {
    it('keeps the deadline of the step that already follows it, flags it, and clears the flag when the first is finished again', async () => {
      const { recordId, get } = await withFlow([step(), step({ anchor: 'PREVIOUS_STEP_DONE', durationValue: 10 })]);
      let flow = await get();
      const [first, second] = [stepOf(flow, 0).stepKey, stepOf(flow, 1).stepKey];
      flow = await commands.completeStep(actor, 'PETITION', recordId, first, { expectedRevision: flow.revision });
      const deadline = stepOf(flow, 1).regulatoryDueAt;
      expect(deadline).not.toBeNull();

      commands.now = () => new Date('2026-12-04T03:00:00.000Z');
      flow = await commands.reopenStep(actor, 'PETITION', recordId, first, { expectedRevision: flow.revision, reason: 'A document was missing' });
      expect(stepOf(flow, 0)).toMatchObject({ status: 'OPEN', doneAt: null });
      expect(stepOf(flow, 1)).toMatchObject({ status: 'OPEN', upstreamReopened: true, regulatoryDueAt: deadline });
      const reopened = await scratch.db.procStepChange.findFirstOrThrow({ where: { recordId, action: 'STEP_REOPENED' } });
      expect(reopened.reason).toBe('A document was missing');

      flow = await commands.completeStep(actor, 'PETITION', recordId, first, { expectedRevision: flow.revision });
      expect(stepOf(flow, 1)).toMatchObject({ upstreamReopened: false, regulatoryDueAt: deadline });
      expect(second).toBe(stepOf(flow, 1).stepKey);
    });

    it('is refused once the following step is done: that has to be taken back first', async () => {
      const { recordId, get } = await withFlow([step(), step({ anchor: 'PREVIOUS_STEP_DONE' })]);
      let flow = await get();
      flow = await commands.completeStep(actor, 'PETITION', recordId, stepOf(flow, 0).stepKey, { expectedRevision: flow.revision });
      flow = await commands.completeStep(actor, 'PETITION', recordId, stepOf(flow, 1).stepKey, { expectedRevision: flow.revision });
      expect(await failure(commands.reopenStep(actor, 'PETITION', recordId, stepOf(flow, 0).stepKey, { expectedRevision: flow.revision }))).toEqual({ status: 409, code: 'STEP_DEPENDENT_STARTED' });
      expect(stepOf(await get(), 0).status).toBe('DONE');
    });

    it('a step that is not done cannot be reopened', async () => {
      const { recordId, get } = await withFlow([step()]);
      const flow = await get();
      expect(await failure(commands.reopenStep(actor, 'PETITION', recordId, stepOf(flow, 0).stepKey, { expectedRevision: flow.revision }))).toEqual({ status: 409, code: 'STEP_TRANSITION_INVALID' });
    });
  });

  describe('skipping a step', () => {
    it('needs a reason; the step after it starts counting from that moment; un-skipping puts it back and flags the follower', async () => {
      const { recordId, get } = await withFlow([step(), step({ anchor: 'PREVIOUS_STEP_DONE', durationValue: 10 })]);
      let flow = await get();
      const first = stepOf(flow, 0).stepKey;
      expect(await failure(commands.skipStep(actor, 'PETITION', recordId, first, { expectedRevision: flow.revision, reason: '   ' }))).toEqual({ status: 400, code: 'STEP_REASON_REQUIRED' });

      flow = await commands.skipStep(actor, 'PETITION', recordId, first, { expectedRevision: flow.revision, reason: 'Does not apply to this record' });
      expect(stepOf(flow, 0)).toMatchObject({ status: 'SKIPPED', skippedFrom: 'OPEN', skippedAt: '2026-12-02T03:00:00.000Z', band: 'NONE', completion: null });
      expect(stepOf(flow, 1)).toMatchObject({ status: 'OPEN', startAt: '2026-12-02T03:00:00.000Z' });

      flow = await commands.unskipStep(actor, 'PETITION', recordId, first, { expectedRevision: flow.revision });
      expect(stepOf(flow, 0)).toMatchObject({ status: 'OPEN', skippedFrom: null, skippedAt: null });
      expect(stepOf(flow, 1).upstreamReopened).toBe(true);
    });

    it('a step that is done or reported cannot be skipped; one that is skipped cannot be skipped again', async () => {
      const { recordId, get } = await withFlow([step(), step({ requiresApproval: true, anchor: 'PREVIOUS_STEP_DONE' })]);
      let flow = await get();
      flow = await commands.completeStep(actor, 'PETITION', recordId, stepOf(flow, 0).stepKey, { expectedRevision: flow.revision });
      expect(await failure(commands.skipStep(actor, 'PETITION', recordId, stepOf(flow, 0).stepKey, { expectedRevision: flow.revision, reason: 'x' }))).toEqual({ status: 409, code: 'STEP_TRANSITION_INVALID' });
      flow = await commands.skipStep(actor, 'PETITION', recordId, stepOf(flow, 1).stepKey, { expectedRevision: flow.revision, reason: 'x' });
      expect(await failure(commands.skipStep(actor, 'PETITION', recordId, stepOf(flow, 1).stepKey, { expectedRevision: flow.revision, reason: 'again' }))).toEqual({ status: 409, code: 'STEP_TRANSITION_INVALID' });
    });

    it('a step set aside while waiting stays waiting when it is brought back and cannot be scheduled (found by Codex)', async () => {
      // An hour-long duration counted from a day that carries no time of day cannot be scheduled.
      const { recordId, get } = await withFlow([step({ name: 'Hours', durationUnit: 'HOUR', durationValue: 48 })]);
      let flow = await get();
      expect(stepOf(flow, 0)).toMatchObject({ status: 'WAITING_ANCHOR', problem: 'HOUR_ANCHOR_HAS_NO_TIME' });
      const key = stepOf(flow, 0).stepKey;
      flow = await commands.skipStep(actor, 'PETITION', recordId, key, { expectedRevision: flow.revision, reason: 'Not now' });
      flow = await commands.unskipStep(actor, 'PETITION', recordId, key, { expectedRevision: flow.revision });
      expect(stepOf(flow, 0)).toMatchObject({ status: 'WAITING_ANCHOR', startAt: null, dueAt: null });
      // And it cannot be completed: it never opened.
      expect(await failure(commands.completeStep(actor, 'PETITION', recordId, key, { expectedRevision: flow.revision }))).toEqual({ status: 409, code: 'STEP_TRANSITION_INVALID' });
    });

    it('a step set aside while it was still waiting for its date opens, when un-skipped, if the date exists by then', async () => {
      const { recordId, get } = await withFlow([step({ anchor: 'ACCEPTED' })]);
      let flow = await get();
      const key = stepOf(flow, 0).stepKey;
      flow = await commands.skipStep(actor, 'PETITION', recordId, key, { expectedRevision: flow.revision, reason: 'Waiting for nothing' });
      expect(stepOf(flow, 0)).toMatchObject({ status: 'SKIPPED', skippedFrom: 'WAITING_ANCHOR' });
      // The date of acceptance is recorded while the step is set aside: nothing opens.
      flow = await commands.recordAccepted(actor, 'PETITION', recordId, { expectedRevision: flow.revision, date: '2026-12-10' });
      expect(stepOf(flow, 0).status).toBe('SKIPPED');
      flow = await commands.unskipStep(actor, 'PETITION', recordId, key, { expectedRevision: flow.revision });
      // 10 December + 5 days: the end of 15 December, Vietnam time.
      expect(stepOf(flow, 0)).toMatchObject({ status: 'OPEN', startAt: '2026-12-10T00:00:00.000Z', regulatoryDueAt: '2026-12-15T16:59:59.999Z' });
    });
  });

  describe('the date of acceptance', () => {
    it('opens the steps counted from it, with their deadlines; said once', async () => {
      const { recordId, get } = await withFlow([step({ name: 'Accept', anchor: 'ACCEPTED', durationValue: 30 })]);
      let flow = await get();
      expect(stepOf(flow, 0)).toMatchObject({ status: 'WAITING_ANCHOR', dueAt: null });

      flow = await commands.recordAccepted(actor, 'PETITION', recordId, { expectedRevision: flow.revision, date: '2026-12-05' });
      expect(flow.acceptedAt).toBe('2026-12-05T00:00:00.000Z');
      // 5 December + 30 days: the end of 4 January 2027, Vietnam time.
      expect(stepOf(flow, 0)).toMatchObject({ status: 'OPEN', startAt: '2026-12-05T00:00:00.000Z', regulatoryDueAt: '2027-01-04T16:59:59.999Z', provisional: false });

      expect(await failure(commands.recordAccepted(actor, 'PETITION', recordId, { expectedRevision: flow.revision, date: '2026-12-06' }))).toEqual({ status: 409, code: 'ACCEPTED_ALREADY_RECORDED' });
    });

    it('refuses what is not a date', async () => {
      const { recordId, get } = await withFlow([step({ anchor: 'ACCEPTED' })]);
      const flow = await get();
      for (const date of ['', '2026-13-40', 'yesterday', '05/12/2026', '2026-02-30']) {
        expect(await failure(commands.recordAccepted(actor, 'PETITION', recordId, { expectedRevision: flow.revision, date }))).toEqual({ status: 400, code: 'ACCEPTED_DATE_INVALID' });
      }
      expect((await get()).acceptedAt).toBeNull();
    });
  });

  describe('a flow that was only proposed', () => {
    it('is confirmed by a person, once', async () => {
      const fallback = await publishedFlow([step({ name: 'Default step' })], true);
      const recordId = await petition({ loaiThongTin: 'Một loại thông tin không có trong danh mục' });
      const applied = await commands.apply(actor, 'PETITION', recordId, {});
      expect(applied.outcome).toMatchObject({ outcome: 'APPLIED', flowId: fallback.id, match: 'UNKNOWN_TYPE', confirmed: false });
      let flow = applied.flow!;
      expect(flow).toMatchObject({ confirmed: false, match: 'UNKNOWN_TYPE' });

      flow = await commands.confirmFlow(actor, 'PETITION', recordId, { expectedRevision: flow.revision });
      expect(flow.confirmed).toBe(true);
      expect(await failure(commands.confirmFlow(actor, 'PETITION', recordId, { expectedRevision: flow.revision }))).toEqual({ status: 409, code: 'FLOW_ALREADY_CONFIRMED' });
      const row = await scratch.db.procRecordFlow.findUniqueOrThrow({ where: { id: flow.id } });
      expect(row).toMatchObject({ confirmed: true, confirmedById: actor });
      expect(row.confirmedAt).not.toBeNull();
    });
  });

  describe('looking for the flow again', () => {
    it('replaces a proposal by the flow the configuration has now, once the information type was fixed', async () => {
      const entry = await scratch.db.directory.create({ data: { type: 'LOAI_THONG_TIN', code: `${tag}-fix`, name: `Tố giác ${tag}` } });
      const bound = await publishedFlow([step({ name: 'Bound step' })]);
      await flows.setBindings(bound.id, actor, { directoryIds: [entry.id], deadlineGroups: [], expectedRevision: bound.revision });
      // One default flow per kind: the one an earlier test made is used when it is still there.
      if ((await scratch.db.procFlow.count({ where: { recordKind: 'PETITION', isDefault: true, status: 'ACTIVE' } })) === 0) await publishedFlow([step({ name: 'Default step' })], true);
      const recordId = await petition({ loaiThongTin: 'Một văn bản lạ' });
      let flow = (await commands.apply(actor, 'PETITION', recordId, {})).flow!;
      expect(flow).toMatchObject({ match: 'UNKNOWN_TYPE', confirmed: false });
      const proposalRevision = flow.revision;

      await scratch.db.petition.update({ where: { id: recordId }, data: { loaiThongTin: entry.name } });
      const result = await commands.reapplyFlow(actor, 'PETITION', recordId, { expectedRevision: flow.revision });
      expect(result.outcome).toMatchObject({ outcome: 'APPLIED', flowId: bound.id, match: 'TYPE', confirmed: true });
      flow = result.flow!;
      expect(flow.steps.map((s) => s.name)).toEqual(['Bound step']);
      expect(await scratch.db.procRecordFlow.count({ where: { recordId } })).toBe(1);
      expect(await scratch.db.procRecordStep.count({ where: { recordId } })).toBe(1);
      const history = await scratch.db.procStepChange.findMany({ where: { recordId }, orderBy: { at: 'asc' } });
      expect(history.map((row) => row.action)).toEqual(['FLOW_APPLIED', 'FLOW_APPLIED', 'FLOW_REPLACED']);
      // The replacement carries on counting revisions (found by Codex): a request that looked at the proposal is stale.
      expect(flow.revision).toBeGreaterThan(proposalRevision);
      expect(await failure(commands.reapplyFlow(actor, 'PETITION', recordId, { expectedRevision: proposalRevision }))).toMatchObject({ status: 409 });
      expect(await failure(commands.recordAccepted(actor, 'PETITION', recordId, { expectedRevision: proposalRevision, date: '2026-12-09' }))).toEqual({ status: 409, code: 'REVISION_CONFLICT' });
    });

    it('is refused when the flow was confirmed, when a step has moved, or when the revision is not the current one', async () => {
      const { recordId, get } = await withFlow([step(), step({ anchor: 'PREVIOUS_STEP_DONE' })]);
      let flow = await get();
      // A flow chosen by hand is confirmed from the start.
      expect(await failure(commands.reapplyFlow(actor, 'PETITION', recordId, { expectedRevision: flow.revision }))).toEqual({ status: 409, code: 'FLOW_ALREADY_CONFIRMED' });

      // A proposal whose step has moved keeps its flow.
      const proposed = await petition({ loaiThongTin: 'Lại một văn bản lạ' });
      flow = (await commands.apply(actor, 'PETITION', proposed, {})).flow!;
      flow = await commands.completeStep(actor, 'PETITION', proposed, flow.steps[0].stepKey, { expectedRevision: flow.revision });
      expect(await failure(commands.reapplyFlow(actor, 'PETITION', proposed, { expectedRevision: flow.revision }))).toEqual({ status: 409, code: 'FLOW_HAS_PROGRESS' });
      expect(await failure(commands.reapplyFlow(actor, 'PETITION', proposed, { expectedRevision: flow.revision + 9 }))).toEqual({ status: 409, code: 'REVISION_CONFLICT' });
    });

    it('a flow with a report or an opinion written under it keeps itself: there is history a new flow would orphan (found by Codex)', async () => {
      const recordId = await petition({ loaiThongTin: 'Văn bản lạ có báo cáo' });
      const proposed = (await commands.apply(actor, 'PETITION', recordId, {})).flow!;
      const stored = await scratch.db.procRecordStep.findFirstOrThrow({ where: { recordId } });
      await scratch.db.procStepReport.create({ data: { recordStepId: stored.id, recordKind: 'PETITION', recordId, kind: 'PROGRESS', doneWork: 'Started', authorId: actor } });
      try {
        expect(await failure(commands.reapplyFlow(actor, 'PETITION', recordId, { expectedRevision: proposed.revision }))).toEqual({ status: 409, code: 'FLOW_HAS_PROGRESS' });
      } finally {
        await scratch.db.procStepReport.deleteMany({ where: { recordId } });
      }
    });

    it('when nothing fits any more the proposal stays as it was', async () => {
      const recordId = await petition({ loaiThongTin: 'Văn bản lạ thứ ba' });
      const proposed = (await commands.apply(actor, 'PETITION', recordId, {})).flow!;
      // The default flow stops being the default: no flow fits the record now.
      await scratch.db.procFlow.update({ where: { id: proposed.flowId }, data: { isDefault: false } });
      try {
        expect(await failure(commands.reapplyFlow(actor, 'PETITION', recordId, { expectedRevision: proposed.revision }))).toEqual({ status: 409, code: 'NO_FLOW_FOR_RECORD' });
        // Read for the same person: the answer of a write says what its actor may do on each step.
        expect(await commands.get('PETITION', recordId, actor)).toEqual(proposed);
      } finally {
        await scratch.db.procFlow.update({ where: { id: proposed.flowId }, data: { isDefault: true } });
      }
    });
  });

  describe('applying by hand', () => {
    it('answers what came of it with the flow, and a second apply says it is already there', async () => {
      const flow = await publishedFlow([step()]);
      const recordId = await petition();
      const first = await commands.apply(actor, 'PETITION', recordId, { flowId: flow.id });
      expect(first.outcome).toMatchObject({ outcome: 'APPLIED', match: 'MANUAL' });
      expect(first.flow).toMatchObject({ confirmed: true, steps: [{ status: 'OPEN' }] });
      const second = await commands.apply(actor, 'PETITION', recordId, { flowId: flow.id });
      expect(second.outcome).toMatchObject({ outcome: 'ALREADY_APPLIED' });
    });
  });
});
