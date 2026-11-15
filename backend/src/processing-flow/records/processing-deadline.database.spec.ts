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
import { ProcessingCommandService } from './processing-command.service';
import { ProcessingDeadlineService } from './processing-deadline.service';
import { ProcessingPauseService } from './processing-pause.service';

/**
 * The two deadlines of a step and the clock of a record, on a REAL PostgreSQL: the unit's own deadline (never later than
 * the regulatory one), extensions (as many as the flow allows, with a reason), and the pause of the clock while a
 * record is suspended (the deadlines move by the time spent paused).
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

const PREFIX = 'pfd-test-';
const DAY = 86_400_000;

run('Deadline commands and the pause of the clock on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let flows: ProcessingFlowsService;
  let commands: ProcessingCommandService;
  let deadlines: ProcessingDeadlineService;
  let pauses: ProcessingPauseService;
  let switchOn = true;
  const tag = `${PREFIX}${randomUUID().slice(0, 8)}`;
  let actor = '';
  let roleId = '';
  let unit = '';
  let counter = 0;
  const recordIds: string[] = [];
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
    parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }],
    ...over,
  });

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

  /** A petition with a flow of `steps` applied by hand; 10 days from 1 December: the end of 11 December, Vietnam time. */
  const withFlow = async (steps: unknown[]) => {
    const created = await flows.create(actor, { name: fresh('flow'), recordKind: 'PETITION' });
    const saved = await flows.replaceSteps(created.id, created.draft!.id, actor, { steps, expectedRevision: created.draft!.revision });
    const flow = await flows.publish(created.id, saved.flow.draft!.id, actor, saved.flow.draft!.revision);
    const recordId = await petition();
    await commands.apply(actor, 'PETITION', recordId, { flowId: flow.id });
    return { recordId, get: () => commands.get('PETITION', recordId) };
  };

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

    roleId = (await db.role.create({ data: { name: `${tag}-role` } })).id;
    actor = (await db.user.create({ data: { username: `${tag}-actor`, passwordHash: 'x', roleId, isActive: true } })).id;
    unit = (await db.team.create({ data: { name: `${tag} unit`, code: `${tag}-U` } })).id;

    const prisma = db as never;
    const audit = new AuditService(prisma);
    const calendars = new WorkingCalendarService(prisma, audit);
    flows = new ProcessingFlowsService(prisma, audit, calendars);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    const gateway = new RecordGateway(new PetitionAdapter(prisma, scopes), new IncidentAdapter(prisma, scopes), new CaseAdapter(prisma, scopes));
    const applier = new FlowApplicationService(prisma, gateway, calendars, audit);
    commands = new ProcessingCommandService(prisma, gateway, calendars, applier, audit);
    deadlines = new ProcessingDeadlineService(prisma, commands);
    pauses = new ProcessingPauseService(prisma, gateway, { isEnabled: () => Promise.resolve(switchOn) } as never);
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
    await db.petition.deleteMany({ where: { id: { in: recordIds } } });
    await dropFlows();
    await db.auditLog.deleteMany({ where: { userId: actor } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.role.deleteMany({ where: { id: roleId } });
    await scratch.close();
  });

  beforeEach(() => {
    commands.now = () => new Date('2026-12-02T03:00:00.000Z');
    pauses.now = () => new Date('2026-12-02T03:00:00.000Z');
    switchOn = true;
  });

  describe('the unit\'s own deadline', () => {
    it('is set earlier than the regulatory one: the colour counts down to it, the law\'s deadline stays', async () => {
      const { recordId, get } = await withFlow([step()]);
      const before = await get();
      expect(before.steps[0]).toMatchObject({ regulatoryDueAt: '2026-12-11T16:59:59.999Z', internalDueAt: '2026-12-11T16:59:59.999Z', deadlineRevision: 1 });

      const after = await deadlines.adjustDue(actor, 'PETITION', recordId, before.steps[0].stepKey, { expectedRevision: before.revision, date: '2026-12-08', reason: 'Target of the unit' });
      expect(after.steps[0]).toMatchObject({ regulatoryDueAt: '2026-12-11T16:59:59.999Z', internalDueAt: '2026-12-08T16:59:59.999Z', dueAt: '2026-12-08T16:59:59.999Z', deadlineRevision: 2 });
      const stored = await scratch.db.procRecordStep.findFirstOrThrow({ where: { recordId } });
      // The bands start from the unit's own deadline: red from its last day minus 1 day.
      expect(stored.redFrom?.toISOString()).toBe('2026-12-06T17:00:00.000Z');
      const change = await scratch.db.procStepChange.findFirstOrThrow({ where: { recordId, action: 'INTERNAL_DUE_SET' } });
      expect(change).toMatchObject({ reason: 'Target of the unit', actorId: actor });

      // "Back to the regulatory deadline" is always possible.
      const back = await deadlines.adjustDue(actor, 'PETITION', recordId, after.steps[0].stepKey, { expectedRevision: after.revision, date: null });
      expect(back.steps[0]).toMatchObject({ internalDueAt: '2026-12-11T16:59:59.999Z', deadlineRevision: 3 });
    });

    it('is never later than the regulatory one: that takes an extension', async () => {
      const { recordId, get } = await withFlow([step()]);
      const before = await get();
      expect(await failure(deadlines.adjustDue(actor, 'PETITION', recordId, before.steps[0].stepKey, { expectedRevision: before.revision, date: '2026-12-12' }))).toEqual({ status: 409, code: 'INTERNAL_DUE_AFTER_REGULATORY' });
      expect(await failure(deadlines.adjustDue(actor, 'PETITION', recordId, before.steps[0].stepKey, { expectedRevision: before.revision, date: 'tomorrow' }))).toEqual({ status: 400, code: 'DUE_DATE_INVALID' });
      expect(await get()).toEqual(before);
    });

    it('a step with no deadline (waiting, done) has nothing to adjust; an unchanged target is not a change', async () => {
      const { recordId, get } = await withFlow([step(), step({ anchor: 'PREVIOUS_STEP_DONE' })]);
      let flow = await get();
      expect(await failure(deadlines.adjustDue(actor, 'PETITION', recordId, flow.steps[1].stepKey, { expectedRevision: flow.revision, date: '2026-12-20' }))).toEqual({ status: 409, code: 'STEP_HAS_NO_DEADLINE' });
      flow = await deadlines.adjustDue(actor, 'PETITION', recordId, flow.steps[0].stepKey, { expectedRevision: flow.revision, date: null });
      expect(flow.steps[0].deadlineRevision).toBe(1);
    });
  });

  describe('extending the regulatory deadline', () => {
    it('adds the extension the flow allows, counted from the deadline as it stands; a reason is needed; the allowed number is the limit', async () => {
      const { recordId, get } = await withFlow([step({ maxExtensions: 2, extensionValue: 10, extensionUnit: 'DAY' })]);
      let flow = await get();
      const key = flow.steps[0].stepKey;
      expect(await failure(deadlines.extendStep(actor, 'PETITION', recordId, key, { expectedRevision: flow.revision, reason: '  ' }))).toEqual({ status: 400, code: 'STEP_REASON_REQUIRED' });

      flow = await deadlines.extendStep(actor, 'PETITION', recordId, key, { expectedRevision: flow.revision, reason: 'The file is large' });
      // 11 December + 10 days: the end of 21 December. The unit never set a target of its own, so it moves along.
      expect(flow.steps[0]).toMatchObject({ regulatoryDueAt: '2026-12-21T16:59:59.999Z', internalDueAt: '2026-12-21T16:59:59.999Z', extensionsUsed: 1, deadlineRevision: 2 });
      flow = await deadlines.extendStep(actor, 'PETITION', recordId, key, { expectedRevision: flow.revision, reason: 'Still waiting for a reply' });
      expect(flow.steps[0]).toMatchObject({ regulatoryDueAt: '2026-12-31T16:59:59.999Z', extensionsUsed: 2, deadlineRevision: 3 });
      expect(await failure(deadlines.extendStep(actor, 'PETITION', recordId, key, { expectedRevision: flow.revision, reason: 'A third time' }))).toEqual({ status: 409, code: 'EXTENSION_NOT_ALLOWED' });
      const history = await scratch.db.procStepChange.findMany({ where: { recordId, action: 'STEP_EXTENDED' }, orderBy: { at: 'asc' } });
      expect(history.map((row) => row.reason)).toEqual(['The file is large', 'Still waiting for a reply']);
    });

    it('a target the unit set earlier stays when the law\'s deadline moves', async () => {
      const { recordId, get } = await withFlow([step()]);
      let flow = await get();
      const key = flow.steps[0].stepKey;
      flow = await deadlines.adjustDue(actor, 'PETITION', recordId, key, { expectedRevision: flow.revision, date: '2026-12-08' });
      flow = await deadlines.extendStep(actor, 'PETITION', recordId, key, { expectedRevision: flow.revision, reason: 'More time' });
      expect(flow.steps[0]).toMatchObject({ regulatoryDueAt: '2026-12-21T16:59:59.999Z', internalDueAt: '2026-12-08T16:59:59.999Z', dueAt: '2026-12-08T16:59:59.999Z' });
    });

    it('a step whose flow allows no extension, and a step with no deadline, are refused', async () => {
      const { recordId, get } = await withFlow([step({ maxExtensions: 0, extensionValue: null, extensionUnit: null }), step({ anchor: 'PREVIOUS_STEP_DONE' })]);
      const flow = await get();
      expect(await failure(deadlines.extendStep(actor, 'PETITION', recordId, flow.steps[0].stepKey, { expectedRevision: flow.revision, reason: 'x' }))).toEqual({ status: 409, code: 'EXTENSION_NOT_ALLOWED' });
      expect(await failure(deadlines.extendStep(actor, 'PETITION', recordId, flow.steps[1].stepKey, { expectedRevision: flow.revision, reason: 'x' }))).toEqual({ status: 409, code: 'STEP_HAS_NO_DEADLINE' });
    });
  });

  describe('the clock of a suspended record', () => {
    const setStatus = (recordId: string, status: string) => scratch.db.petition.update({ where: { id: recordId }, data: { status: status as never } });
    const reconcileFor = async (recordId: string, at: string) => {
      pauses.now = () => new Date(at);
      await pauses.reconcile();
      void recordId;
    };

    it('stops while the record is suspended and, when it resumes, moves the deadlines of the steps being worked by the time spent paused', async () => {
      const { recordId, get } = await withFlow([step(), step({ anchor: 'PREVIOUS_STEP_DONE' })]);
      const before = await get();
      await setStatus(recordId, 'TAM_DINH_CHI');
      await reconcileFor(recordId, '2026-12-03T03:00:00.000Z');
      await reconcileFor(recordId, '2026-12-03T04:00:00.000Z'); // twice: still one pause
      expect(await scratch.db.procRecordPause.count({ where: { recordFlow: { recordId } } })).toBe(1);
      commands.now = () => new Date('2026-12-04T03:00:00.000Z');
      const paused = await get();
      expect(paused.pausedSince).toBe('2026-12-03T03:00:00.000Z');
      expect(paused.steps[0]).toMatchObject({ band: 'NONE', remainingDays: null, regulatoryDueAt: before.steps[0].regulatoryDueAt });

      await setStatus(recordId, 'DANG_XU_LY');
      await reconcileFor(recordId, '2026-12-06T03:00:00.000Z'); // three days later
      const resumed = await get();
      expect(resumed.pausedSince).toBeNull();
      // Three days of standing still: 11 December becomes 14 December (the end of the day, as it was), both deadlines.
      expect(resumed.steps[0]).toMatchObject({ regulatoryDueAt: '2026-12-14T16:59:59.999Z', internalDueAt: '2026-12-14T16:59:59.999Z', deadlineRevision: 2 });
      // A step that has no deadline yet is not touched.
      expect(resumed.steps[1]).toMatchObject({ status: 'WAITING_ANCHOR', regulatoryDueAt: null });
      expect(resumed.revision).toBeGreaterThan(before.revision);
      const pause = await scratch.db.procRecordPause.findFirstOrThrow({ where: { recordFlow: { recordId } } });
      expect(pause.to?.toISOString()).toBe('2026-12-06T03:00:00.000Z');
      const history = await scratch.db.procStepChange.findMany({ where: { recordId, action: { in: ['CLOCK_PAUSED', 'CLOCK_RESUMED'] } }, orderBy: { at: 'asc' } });
      expect(history.map((row) => row.action)).toEqual(['CLOCK_PAUSED', 'CLOCK_RESUMED']);
      // The bands come from the moved deadline.
      const stored = await scratch.db.procRecordStep.findFirstOrThrow({ where: { recordId, order: 0 } });
      expect(stored.redFrom?.toISOString()).toBe('2026-12-12T17:00:00.000Z');
    });

    it('a step that started while the clock was stopped lost only the part of the pause after it started', async () => {
      const { recordId, get } = await withFlow([step({ durationValue: 3 }), step({ anchor: 'PREVIOUS_STEP_DONE', durationValue: 10 })]);
      let flow = await get();
      await setStatus(recordId, 'TAM_DINH_CHI');
      await reconcileFor(recordId, '2026-12-02T05:00:00.000Z'); // paused at 12:00 Vietnam time on 2 December
      // The first step is completed during the pause (somebody finished the paperwork): the second starts at 10:00 on 3 December.
      commands.now = () => new Date('2026-12-03T03:00:00.000Z');
      flow = await commands.completeStep(actor, 'PETITION', recordId, flow.steps[0].stepKey, { expectedRevision: flow.revision });
      const secondDue = flow.steps[1].regulatoryDueAt as string;
      await setStatus(recordId, 'DANG_XU_LY');
      await reconcileFor(recordId, '2026-12-05T03:00:00.000Z'); // resumed 5 December, 10:00
      const resumed = await get();
      // It started at 03:00Z on the 3rd and the pause ended at 03:00Z on the 5th: two days, not the pause's three.
      expect(new Date(resumed.steps[1].regulatoryDueAt as string).getTime() - new Date(secondDue).getTime()).toBe(2 * DAY);
    });

    it('a record that was finished while suspended has its pause closed and no deadline moved', async () => {
      const { recordId, get } = await withFlow([step()]);
      const before = await get();
      await setStatus(recordId, 'TAM_DINH_CHI');
      await reconcileFor(recordId, '2026-12-03T03:00:00.000Z');
      await setStatus(recordId, 'DA_GIAI_QUYET');
      await reconcileFor(recordId, '2026-12-08T03:00:00.000Z');
      expect(await scratch.db.procRecordPause.count({ where: { recordFlow: { recordId }, to: null } })).toBe(0);
      expect((await get()).steps[0].regulatoryDueAt).toBe(before.steps[0].regulatoryDueAt);
    });

    it('stops its pause when the last step is completed while the record is still suspended, and starts a new one when a step is reopened (found by Codex)', async () => {
      const { recordId, get } = await withFlow([step()]);
      let flow = await get();
      await setStatus(recordId, 'TAM_DINH_CHI');
      await reconcileFor(recordId, '2026-12-03T03:00:00.000Z');
      expect(await scratch.db.procRecordPause.count({ where: { recordFlow: { recordId }, to: null } })).toBe(1);
      commands.now = () => new Date('2026-12-04T03:00:00.000Z');
      flow = await commands.completeStep(actor, 'PETITION', recordId, flow.steps[0].stepKey, { expectedRevision: flow.revision });
      await reconcileFor(recordId, '2026-12-05T03:00:00.000Z');
      // Nothing was being worked: the pause is closed, and the days that follow are not credited to anything.
      expect(await scratch.db.procRecordPause.count({ where: { recordFlow: { recordId }, to: null } })).toBe(0);
      await commands.reopenStep(actor, 'PETITION', recordId, flow.steps[0].stepKey, { expectedRevision: flow.revision });
      await reconcileFor(recordId, '2026-12-09T03:00:00.000Z');
      const pauses = await scratch.db.procRecordPause.findMany({ where: { recordFlow: { recordId } }, orderBy: { from: 'asc' } });
      expect(pauses.map((p) => [p.from.toISOString(), p.to?.toISOString() ?? null])).toEqual([
        ['2026-12-03T03:00:00.000Z', '2026-12-05T03:00:00.000Z'],
        ['2026-12-09T03:00:00.000Z', null],
      ]);
    });

    it('shows no colour for a suspended record before the worker has noticed (found by Codex)', async () => {
      const { recordId, get } = await withFlow([step()]);
      commands.now = () => new Date('2026-12-10T03:00:00.000Z'); // one day before the deadline: red
      expect((await get()).steps[0].band).toBe('RED');
      await setStatus(recordId, 'TAM_DINH_CHI');
      const flow = await get();
      expect(flow).toMatchObject({ suspended: true, pausedSince: null });
      expect(flow.steps[0]).toMatchObject({ band: 'NONE', remainingDays: null });
    });

    it('a flow whose clock was ever paused is not replaced by a new one: its deadlines moved (found by Codex)', async () => {
      const { recordId, get } = await withFlow([step()]);
      await setStatus(recordId, 'TAM_DINH_CHI');
      await reconcileFor(recordId, '2026-12-03T03:00:00.000Z');
      await setStatus(recordId, 'DANG_XU_LY');
      await reconcileFor(recordId, '2026-12-04T03:00:00.000Z');
      await scratch.db.procRecordFlow.updateMany({ where: { recordId }, data: { confirmed: false } });
      const flow = await get();
      expect(await failure(commands.reapplyFlow(actor, 'PETITION', recordId, { expectedRevision: flow.revision }))).toEqual({ status: 409, code: 'FLOW_HAS_PROGRESS' });
    });

    it('does nothing while the switch is off', async () => {
      const { recordId } = await withFlow([step()]);
      await setStatus(recordId, 'TAM_DINH_CHI');
      switchOn = false;
      await pauses.tick();
      expect(await scratch.db.procRecordPause.count({ where: { recordFlow: { recordId } } })).toBe(0);
    });

    it('a record with no step being worked is not paused', async () => {
      const { recordId, get } = await withFlow([step()]);
      const flow = await get();
      await commands.completeStep(actor, 'PETITION', recordId, flow.steps[0].stepKey, { expectedRevision: flow.revision });
      await setStatus(recordId, 'TAM_DINH_CHI');
      await reconcileFor(recordId, '2026-12-03T03:00:00.000Z');
      expect(await scratch.db.procRecordPause.count({ where: { recordFlow: { recordId } } })).toBe(0);
    });
  });
});
