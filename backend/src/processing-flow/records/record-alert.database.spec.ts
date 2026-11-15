import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { openScratchDatabase, type ScratchDatabase } from '../../common/testing/scratch-database';
import { takeTurnOnSharedRow } from '../../common/testing/shared-row-turn';
import { TeamsService } from '../../teams/teams.service';
import { WorkingCalendarService } from '../calendar/working-calendar.service';
import { ProcessingFlowsService } from '../config/processing-flows.service';
import { bandAt, worseBand } from '../engine/bands';
import type { Band } from '../engine/types';
import { CaseAdapter } from '../gateway/case.adapter';
import { IncidentAdapter } from '../gateway/incident.adapter';
import { PetitionAdapter } from '../gateway/petition.adapter';
import { RecordGateway } from '../gateway/record-gateway';
import { FlowApplicationService } from './flow-application.service';
import { ProcessingCommandService } from './processing-command.service';
import { ProcessingDeadlineService } from './processing-deadline.service';
import { ProcessingPauseService } from './processing-pause.service';
import { ProcessingResultsService } from './processing-results.service';
import { RecordDeadlineWriter } from './record-deadline-writer.service';

/**
 * The stored alert of a record (`alertDueAt`, `alertRedFrom`, `alertYellowFrom`, `alertGreenFrom` on its flow), on a REAL
 * PostgreSQL: after EVERY kind of write that can change a step's status or deadline, or the clock of the record, the
 * stored instants give the same worst colour as the steps the tab shows, at every instant probed. A write path that
 * forgets to refresh them fails here.
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

const PREFIX = 'pfa-test-';

run('The stored alert of a record on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let flows: ProcessingFlowsService;
  let commands: ProcessingCommandService;
  let deadlines: ProcessingDeadlineService;
  let results: ProcessingResultsService;
  let pauses: ProcessingPauseService;
  const tag = `${PREFIX}${randomUUID().slice(0, 8)}`;
  let actor = '';
  let roleId = '';
  let unit = '';
  let counter = 0;
  const recordIds: string[] = [];
  const fresh = (what: string) => `${tag} ${what} ${++counter}`;
  const START = new Date('2026-12-02T03:00:00.000Z');

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
      data: { stt: fresh('p'), receivedDate: new Date('2026-12-01T00:00:00Z'), senderName: `${tag} sender`, loaiThongTin: `Không ai biết ${tag}`, enteredById: actor, assignedTeamId: unit, status: 'DANG_XU_LY', ...over } as never,
    });
    recordIds.push(row.id);
    return row.id;
  };

  const publishedFlow = async (steps: unknown[]) => {
    const created = await flows.create(actor, { name: fresh('flow'), recordKind: 'PETITION' });
    const saved = await flows.replaceSteps(created.id, created.draft!.id, actor, { steps, expectedRevision: created.draft!.revision });
    return flows.publish(created.id, saved.flow.draft!.id, actor, saved.flow.draft!.revision);
  };

  const withFlow = async (steps: unknown[]) => {
    const flow = await publishedFlow(steps);
    const recordId = await petition();
    await commands.apply(actor, 'PETITION', recordId, { flowId: flow.id });
    return { recordId, get: () => commands.get('PETITION', recordId) };
  };

  const stored = (recordId: string) => scratch.db.procRecordFlow.findFirstOrThrow({ where: { recordId } });

  /**
   * The stored alert against the steps the tab shows. The clock is moved to instants on both sides of every boundary of
   * every step; at each, the band read off the four stored instants must be the worst band among the steps of the DTO.
   * Answers the bands seen, so that a test can also say the alert was not trivially empty.
   */
  const expectAlertAgrees = async (recordId: string): Promise<Band[]> => {
    const flow = await stored(recordId);
    expect(flow.petitionId).toBe(recordId);
    const steps = await scratch.db.procRecordStep.findMany({ where: { recordId } });
    const probes = [START, new Date('2030-01-01T00:00:00.000Z')];
    for (const row of steps) {
      for (const at of [row.greenFrom, row.yellowFrom, row.redFrom, row.internalDueAt, row.regulatoryDueAt]) {
        if (at) probes.push(new Date(at.getTime() - 1), at, new Date(at.getTime() + 1));
      }
    }
    const clock = commands.now;
    const seen = new Set<Band>();
    try {
      for (const at of probes) {
        commands.now = () => at;
        const dto = await commands.get('PETITION', recordId);
        const shown = dto.steps.map((s) => s.band).reduce(worseBand, 'NONE');
        const fromStored = flow.alertDueAt && flow.alertRedFrom && flow.alertYellowFrom && flow.alertGreenFrom
          ? bandAt(at, { dueAt: flow.alertDueAt, redFrom: flow.alertRedFrom, yellowFrom: flow.alertYellowFrom, greenFrom: flow.alertGreenFrom })
          : 'NONE';
        expect({ at: at.toISOString(), band: fromStored }).toEqual({ at: at.toISOString(), band: shown });
        seen.add(shown);
      }
    } finally {
      commands.now = clock;
    }
    return [...seen];
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
    // The actor works in the unit and heads it: it may report, and its opinion is the head's.
    await db.userTeam.create({ data: { userId: actor, teamId: unit, isLeader: true } });

    const prisma = db as never;
    const audit = new AuditService(prisma);
    const calendars = new WorkingCalendarService(prisma, audit);
    flows = new ProcessingFlowsService(prisma, audit, calendars);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    const gateway = new RecordGateway(new PetitionAdapter(prisma, scopes), new IncidentAdapter(prisma, scopes), new CaseAdapter(prisma, scopes));
    const applier = new FlowApplicationService(prisma, gateway, calendars, audit, new RecordDeadlineWriter(prisma, gateway));
    commands = new ProcessingCommandService(prisma, gateway, calendars, applier, audit, new RecordDeadlineWriter(prisma, gateway));
    deadlines = new ProcessingDeadlineService(prisma, commands);
    results = new ProcessingResultsService(prisma, commands);
    pauses = new ProcessingPauseService(prisma, gateway, { isEnabled: () => Promise.resolve(true) } as never, new RecordDeadlineWriter(prisma, gateway));
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    const flowIds = (await db.procRecordFlow.findMany({ where: { recordId: { in: recordIds } }, select: { id: true } })).map((row) => row.id);
    await db.auditLog.deleteMany({ where: { subject: 'ProcRecordFlow', subjectId: { in: flowIds } } });
    await db.procRecordPause.deleteMany({ where: { recordFlowId: { in: flowIds } } });
    await db.procCommandKey.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procStepChange.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procStepOpinion.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procStepReport.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procRecordStepParty.deleteMany({ where: { recordStep: { recordId: { in: recordIds } } } });
    await db.procRecordStep.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procRecordFlow.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.petition.deleteMany({ where: { id: { in: recordIds } } });
    await dropFlows();
    await db.auditLog.deleteMany({ where: { userId: actor } });
    await db.userTeam.deleteMany({ where: { userId: actor } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.role.deleteMany({ where: { id: roleId } });
    await scratch.close();
  });

  beforeEach(() => {
    commands.now = () => START;
    pauses.now = () => START;
  });

  it('applying a flow stores the earliest instants of the steps being worked, and the way back to the record', async () => {
    // Two steps open at once: the second is due later but turns red earlier (its thresholds are wider).
    const { recordId } = await withFlow([step({ name: 'Short', durationValue: 5 }), step({ name: 'Long', durationValue: 8, redDays: 6, yellowDays: 7, greenDays: 8 })]);
    const flow = await stored(recordId);
    // 1 December + 5 days: the end of 6 December (Vietnam). + 8 days: the end of 9 December, red from 3 December.
    expect(flow.alertDueAt?.toISOString()).toBe('2026-12-06T16:59:59.999Z');
    expect(flow.alertRedFrom?.toISOString()).toBe('2026-12-02T17:00:00.000Z');
    expect(flow.alertYellowFrom?.toISOString()).toBe('2026-12-01T17:00:00.000Z');
    expect(flow.alertGreenFrom?.toISOString()).toBe('2026-11-30T17:00:00.000Z');
    expect(new Set(await expectAlertAgrees(recordId))).toEqual(new Set(['NONE', 'GREEN', 'YELLOW', 'RED', 'OVERDUE']));
  });

  it('every command on a step keeps the stored alert equal to what the steps show', async () => {
    const { recordId, get } = await withFlow([
      step({ name: 'Verify', requiresApproval: true }),
      step({ name: 'Answer', anchor: 'PREVIOUS_STEP_DONE', durationValue: 4 }),
      step({ name: 'Accept', anchor: 'ACCEPTED', durationValue: 30 }),
    ]);
    const check = () => expectAlertAgrees(recordId);
    let flow = await get();
    const [verify, answer] = flow.steps.map((s) => s.stepKey);
    expect(await check()).toContain('RED');

    // The unit's own deadline, earlier: the alert follows it.
    flow = await deadlines.adjustDue(actor, 'PETITION', recordId, verify, { expectedRevision: flow.revision, date: '2026-12-08' });
    expect((await stored(recordId)).alertDueAt?.toISOString()).toBe('2026-12-08T16:59:59.999Z');
    await check();

    // An extension moves the regulatory deadline; the unit's own target stays, and so does the alert.
    flow = await deadlines.extendStep(actor, 'PETITION', recordId, verify, { expectedRevision: flow.revision, reason: 'More time' });
    await check();
    flow = await deadlines.adjustDue(actor, 'PETITION', recordId, verify, { expectedRevision: flow.revision, date: null });
    expect((await stored(recordId)).alertDueAt?.toISOString()).toBe('2026-12-21T16:59:59.999Z');
    await check();

    // The day of acceptance opens the step that waited for it.
    flow = await commands.recordAccepted(actor, 'PETITION', recordId, { expectedRevision: flow.revision, date: '2026-12-02' });
    await check();

    // A result is reported (the step waits for approval, its deadline still runs), sent back, reported again, approved.
    flow = await results.submitReport(actor, 'PETITION', recordId, verify, { expectedRevision: flow.revision, kind: 'RESULT', doneWork: 'Verified' });
    expect(flow.steps[0].status).toBe('REPORTED');
    await check();
    flow = await results.decide(actor, 'PETITION', recordId, verify, { expectedRevision: flow.revision, verdict: 'DISAGREE', content: 'Look again' });
    expect(flow.steps[0].status).toBe('OPEN');
    await check();
    flow = await results.submitReport(actor, 'PETITION', recordId, verify, { expectedRevision: flow.revision, kind: 'RESULT', doneWork: 'Verified again' });
    flow = await results.decide(actor, 'PETITION', recordId, verify, { expectedRevision: flow.revision, verdict: 'AGREE' });
    expect(flow.steps.map((s) => s.status)).toEqual(['DONE', 'OPEN', 'OPEN']);
    // The step that followed started now: 2 December + 4 days.
    expect((await stored(recordId)).alertDueAt?.toISOString()).toBe('2026-12-06T16:59:59.999Z');
    await check();

    // Reopened, completed is not possible (it asks for approval); the follower is skipped and brought back.
    flow = await commands.reopenStep(actor, 'PETITION', recordId, verify, { expectedRevision: flow.revision, reason: 'Missed something' });
    await check();
    flow = await commands.skipStep(actor, 'PETITION', recordId, answer, { expectedRevision: flow.revision, reason: 'Not needed' });
    expect((await stored(recordId)).alertDueAt?.toISOString()).toBe('2026-12-21T16:59:59.999Z');
    await check();
    flow = await commands.unskipStep(actor, 'PETITION', recordId, answer, { expectedRevision: flow.revision });
    expect((await stored(recordId)).alertDueAt?.toISOString()).toBe('2026-12-06T16:59:59.999Z');
    await check();
  });

  it('a record with no step being worked has no alert', async () => {
    const { recordId, get } = await withFlow([step()]);
    const flow = await get();
    await commands.completeStep(actor, 'PETITION', recordId, flow.steps[0].stepKey, { expectedRevision: flow.revision });
    expect(await stored(recordId)).toMatchObject({ alertDueAt: null, alertRedFrom: null, alertYellowFrom: null, alertGreenFrom: null });
    expect(await expectAlertAgrees(recordId)).toEqual(['NONE']);
  });

  it('a proposed flow that is confirmed, and one that is replaced, keep their alert', async () => {
    const flow = await publishedFlow([step({ durationValue: 5 })]);
    const other = await publishedFlow([step({ durationValue: 7 })]);
    const recordId = await petition();
    await commands.apply(actor, 'PETITION', recordId, { flowId: flow.id });
    await scratch.db.procRecordFlow.updateMany({ where: { recordId }, data: { confirmed: false } });
    let dto = await commands.get('PETITION', recordId);
    const replaced = await commands.reapplyFlow(actor, 'PETITION', recordId, { expectedRevision: dto.revision, flowId: other.id });
    expect(replaced.outcome.outcome).toBe('APPLIED');
    expect((await stored(recordId)).alertDueAt?.toISOString()).toBe('2026-12-08T16:59:59.999Z');
    await expectAlertAgrees(recordId);

    await scratch.db.procRecordFlow.updateMany({ where: { recordId }, data: { confirmed: false } });
    dto = await commands.get('PETITION', recordId);
    await commands.confirmFlow(actor, 'PETITION', recordId, { expectedRevision: dto.revision });
    await expectAlertAgrees(recordId);
  });

  describe('the clock of the record', () => {
    const setStatus = (recordId: string, status: string) => scratch.db.petition.update({ where: { id: recordId }, data: { status: status as never } });
    const reconcileAt = async (at: string) => {
      pauses.now = () => new Date(at);
      await pauses.reconcile();
      await pauses.reconcileAlerts();
    };

    it('a suspended record has no alert while its clock stands still; resumed, the alert is that of the moved deadlines', async () => {
      const { recordId } = await withFlow([step()]);
      await setStatus(recordId, 'TAM_DINH_CHI');
      await reconcileAt('2026-12-03T03:00:00.000Z');
      expect(await stored(recordId)).toMatchObject({ alertDueAt: null, alertRedFrom: null, alertYellowFrom: null, alertGreenFrom: null });
      expect(await expectAlertAgrees(recordId)).toEqual(['NONE']);

      await setStatus(recordId, 'DANG_XU_LY');
      await reconcileAt('2026-12-05T03:00:00.000Z');
      // Two days paused: 11 December 23:59:59.999 (Vietnam) + 2 days.
      expect((await stored(recordId)).alertDueAt?.toISOString()).toBe('2026-12-13T16:59:59.999Z');
      expect(await expectAlertAgrees(recordId)).toContain('OVERDUE');
    });

    it('a step completed while the record is suspended closes the pause without bringing an alert back', async () => {
      const { recordId, get } = await withFlow([step(), step({ name: 'Other', durationValue: 20 })]);
      let flow = await get();
      await setStatus(recordId, 'TAM_DINH_CHI');
      await reconcileAt('2026-12-03T03:00:00.000Z');
      flow = await commands.completeStep(actor, 'PETITION', recordId, flow.steps[0].stepKey, { expectedRevision: flow.revision });
      expect((await stored(recordId)).alertDueAt).toBeNull();
      await commands.completeStep(actor, 'PETITION', recordId, flow.steps[1].stepKey, { expectedRevision: flow.revision });
      await reconcileAt('2026-12-04T03:00:00.000Z');
      expect((await stored(recordId)).alertDueAt).toBeNull();
      expect(await expectAlertAgrees(recordId)).toEqual(['NONE']);
    });

    it('a record that is finished loses its alert, and gets it back when it is worked again; a deleted record has none', async () => {
      const { recordId } = await withFlow([step()]);
      expect((await stored(recordId)).alertDueAt).not.toBeNull();

      // Nothing tells the flow that the record was finished: the worker notices.
      await setStatus(recordId, 'DA_GIAI_QUYET');
      await reconcileAt('2026-12-03T03:00:00.000Z');
      expect(await stored(recordId)).toMatchObject({ alertDueAt: null, alertRedFrom: null, alertYellowFrom: null, alertGreenFrom: null });
      expect(await expectAlertAgrees(recordId)).toEqual(['NONE']);

      await setStatus(recordId, 'DANG_XU_LY');
      await reconcileAt('2026-12-04T03:00:00.000Z');
      expect((await stored(recordId)).alertDueAt?.toISOString()).toBe('2026-12-11T16:59:59.999Z');
      await expectAlertAgrees(recordId);

      await scratch.db.petition.update({ where: { id: recordId }, data: { deletedAt: new Date() } });
      await reconcileAt('2026-12-05T03:00:00.000Z');
      expect((await stored(recordId)).alertDueAt).toBeNull();
    });

    it('one look puts right a bounded number of records, the next look the rest; two looks at once do not both work (found by Codex)', async () => {
      await pauses.reconcileAlerts();
      const ids: string[] = [];
      for (let n = 0; n < 3; n += 1) ids.push((await withFlow([step()])).recordId);
      for (const recordId of ids) await setStatus(recordId, 'DA_GIAI_QUYET');
      expect(await pauses.reconcileAlerts(2)).toBe(2);
      expect(await pauses.reconcileAlerts(2)).toBe(1);
      expect(await pauses.reconcileAlerts(2)).toBe(0);

      for (const recordId of ids) await setStatus(recordId, 'DANG_XU_LY');
      const [first, second] = await Promise.all([pauses.reconcileAlerts(), pauses.reconcileAlerts()]);
      expect([first, second].sort()).toEqual([0, 3]);
    });

    it('reconciling changes nothing for a record whose alert is already right', async () => {
      const { recordId } = await withFlow([step()]);
      // Whatever another suite left behind in the shared scratch database is settled first.
      await pauses.reconcileAlerts();
      const before = await stored(recordId);
      expect(await pauses.reconcileAlerts()).toBe(0);
      expect(await stored(recordId)).toEqual(before);
    });
  });
});
