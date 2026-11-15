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
import { FlowApplicationService } from './flow-application.service';
import { ProcessingCommandService } from './processing-command.service';
import { ProcessingDeadlineService } from './processing-deadline.service';
import { ProcessingPauseService } from './processing-pause.service';
import { RecordDeadlineWriter } from './record-deadline-writer.service';

/**
 * The deadline column of a record that has a flow, on a REAL PostgreSQL: it is the regulatory deadline of the step the
 * flow marks as the deadline of the record, written only when the flow is confirmed AND a person has compared that
 * step's legal figures with the source text; and it follows every change of that deadline (the application of the flow,
 * an extension, the end of a pause).
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

const PREFIX = 'pfw-test-';
const OLD_DEADLINE = new Date('2026-02-04T00:00:00.000Z');

run('RecordDeadlineWriter on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let flows: ProcessingFlowsService;
  let commands: ProcessingCommandService;
  let deadlines: ProcessingDeadlineService;
  let pauses: ProcessingPauseService;
  let writer: RecordDeadlineWriter;
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
    setsRecordDeadline: true,
    parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }],
    ...over,
  });

  const publish = async (steps: unknown[], isDefault = false): Promise<FlowDetailDto> => {
    const created = await flows.create(actor, { name: fresh('flow'), recordKind: 'PETITION', isDefault });
    const saved = await flows.replaceSteps(created.id, created.draft!.id, actor, { steps, expectedRevision: created.draft!.revision });
    return flows.publish(created.id, saved.flow.draft!.id, actor, saved.flow.draft!.revision);
  };
  const verify = async (flow: FlowDetailDto, index = 0) => {
    const published = flow.published!;
    return flows.verifyLegal(flow.id, published.id, published.steps[index].stepKey, actor, published.revision);
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
        deadline: OLD_DEADLINE,
        ...over,
      } as never,
    });
    recordIds.push(row.id);
    return row.id;
  };
  const columnOf = async (recordId: string) => (await scratch.db.petition.findUniqueOrThrow({ where: { id: recordId }, select: { deadline: true } })).deadline?.toISOString() ?? null;

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
    writer = new RecordDeadlineWriter(prisma, gateway);
    const applier = new FlowApplicationService(prisma, gateway, calendars, audit, writer);
    commands = new ProcessingCommandService(prisma, gateway, calendars, applier, audit, writer);
    deadlines = new ProcessingDeadlineService(prisma, commands);
    pauses = new ProcessingPauseService(prisma, gateway, { isEnabled: () => Promise.resolve(true) } as never, writer);
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
  });

  it('a step whose legal figures nobody has verified does not write: the record keeps its own deadline and stays editable', async () => {
    const flow = await publish([step()]);
    const recordId = await petition();
    await commands.apply(actor, 'PETITION', recordId, { flowId: flow.id });
    expect(await columnOf(recordId)).toBe(OLD_DEADLINE.toISOString());
    expect(await writer.isManaged(scratch.db, 'PETITION', recordId)).toBe(false);
  });

  it('a verified step of a confirmed flow writes the regulatory deadline when the flow is applied, once, with a history row', async () => {
    const flow = await publish([step()]);
    await verify(flow);
    const recordId = await petition();
    await commands.apply(actor, 'PETITION', recordId, { flowId: flow.id });
    // 10 days from 1 December: the end of 11 December, Vietnam time.
    expect(await columnOf(recordId)).toBe('2026-12-11T16:59:59.999Z');
    expect(await writer.isManaged(scratch.db, 'PETITION', recordId)).toBe(true);
    const written = await scratch.db.procStepChange.findMany({ where: { recordId, action: 'RECORD_DEADLINE_WRITTEN' } });
    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ fromValue: { deadline: OLD_DEADLINE.toISOString() }, toValue: { deadline: '2026-12-11T16:59:59.999Z' }, actorId: null });
    // Nothing more to write the second time.
    expect(await scratch.db.$transaction((tx) => writer.sync(tx, 'PETITION', recordId))).toBe('UNCHANGED');
  });

  it('follows an extension of the regulatory deadline and a target the unit sets earlier does not move it', async () => {
    const flow = await publish([step()]);
    await verify(flow);
    const recordId = await petition();
    let state = (await commands.apply(actor, 'PETITION', recordId, { flowId: flow.id })).flow!;
    state = await deadlines.adjustDue(actor, 'PETITION', recordId, state.steps[0].stepKey, { expectedRevision: state.revision, date: '2026-12-08' });
    expect(await columnOf(recordId)).toBe('2026-12-11T16:59:59.999Z'); // the unit's own target is not the record's deadline
    await deadlines.extendStep(actor, 'PETITION', recordId, state.steps[0].stepKey, { expectedRevision: state.revision, reason: 'More time' });
    expect(await columnOf(recordId)).toBe('2026-12-21T16:59:59.999Z');
  });

  it('follows the end of a pause of the clock', async () => {
    const flow = await publish([step()]);
    await verify(flow);
    const recordId = await petition();
    await commands.apply(actor, 'PETITION', recordId, { flowId: flow.id });
    await scratch.db.petition.update({ where: { id: recordId }, data: { status: 'TAM_DINH_CHI' } });
    pauses.now = () => new Date('2026-12-03T03:00:00.000Z');
    await pauses.reconcile();
    await scratch.db.petition.update({ where: { id: recordId }, data: { status: 'DANG_XU_LY' } });
    pauses.now = () => new Date('2026-12-06T03:00:00.000Z');
    await pauses.reconcile();
    expect(await columnOf(recordId)).toBe('2026-12-14T16:59:59.999Z');
  });

  it('a flow that was only proposed writes nothing, even when the step is verified; once a person confirms it, it does', async () => {
    const fallback = await publish([step()], true);
    await verify(fallback);
    const recordId = await petition({ loaiThongTin: 'Một văn bản lạ không có trong danh mục' });
    let state = (await commands.apply(actor, 'PETITION', recordId, {})).flow!;
    expect(state.confirmed).toBe(false);
    expect(await columnOf(recordId)).toBe(OLD_DEADLINE.toISOString());

    state = await commands.confirmFlow(actor, 'PETITION', recordId, { expectedRevision: state.revision });
    expect(state.confirmed).toBe(true);
    expect(await columnOf(recordId)).toBe('2026-12-11T16:59:59.999Z');
  });

  it('only the step marked as the deadline of the record counts', async () => {
    const flow = await publish([step({ name: 'Other', setsRecordDeadline: false }), step({ name: 'The deadline', anchor: 'PREVIOUS_STEP_DONE', setsRecordDeadline: true })]);
    await verify(flow, 0);
    const recordId = await petition();
    await commands.apply(actor, 'PETITION', recordId, { flowId: flow.id });
    // The step that sets the deadline is not verified, and it is still waiting for the step before it: no deadline.
    expect(await columnOf(recordId)).toBe(OLD_DEADLINE.toISOString());
    expect(await writer.isManaged(scratch.db, 'PETITION', recordId)).toBe(false);
  });
});
