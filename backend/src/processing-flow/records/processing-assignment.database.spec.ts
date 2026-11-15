import { HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { ensurePermissions, openScratchDatabase, type EnsuredPermissions, type ScratchDatabase } from '../../common/testing/scratch-database';
import { takeTurnOnSharedRow } from '../../common/testing/shared-row-turn';
import { TeamsService } from '../../teams/teams.service';
import { WorkingCalendarService } from '../calendar/working-calendar.service';
import { ProcessingFlowsService } from '../config/processing-flows.service';
import { CaseAdapter } from '../gateway/case.adapter';
import { IncidentAdapter } from '../gateway/incident.adapter';
import { PetitionAdapter } from '../gateway/petition.adapter';
import { RecordGateway } from '../gateway/record-gateway';
import { FlowApplicationService } from './flow-application.service';
import { ProcessingAssignmentService } from './processing-assignment.service';
import { ProcessingCommandService } from './processing-command.service';
import { RecordDeadlineWriter } from './record-deadline-writer.service';

/**
 * Naming the person who answers for a party of a step, on a REAL PostgreSQL: who may name whom (the permission with the
 * record in scope, a head of the unit, a member taking the work themself), who may be named (an active member of the
 * party's unit), on which steps, and the guarantees of every write (revision, idempotency key, history).
 *
 * Whether the record is in the person's own scope is the record gateway's answer (its own suite proves it); here it is
 * a switch of the suite, so that the rule of THIS service is what the cases exercise.
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

run('The person who answers for a party of a step, on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let flows: ProcessingFlowsService;
  let commands: ProcessingCommandService;
  let assignments: ProcessingAssignmentService;
  let permissions: EnsuredPermissions;
  let recordInScope = true;
  const tag = `${PREFIX}${randomUUID().slice(0, 8)}`;
  const user: Record<string, string> = {};
  const team: Record<string, string> = {};
  const roleIds: string[] = [];
  let counter = 0;
  const recordIds: string[] = [];
  const fresh = (what: string) => `${tag} ${what} ${++counter}`;
  const as = (name: string) => ({ id: user[name], role: 'OFFICER', canDispatch: false });

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
    requiresApproval: false,
    parties: [
      { partyKind: 'TEAM', teamId: team.A, role: 'MAIN' },
      { partyKind: 'TEAM', teamId: team.B, role: 'COORDINATE' },
    ],
    ...over,
  });

  /** A petition whose flow is `steps`, applied by hand. */
  const withFlow = async (steps: unknown[] = [step()]) => {
    const created = await flows.create(user.admin, { name: fresh('flow'), recordKind: 'PETITION' });
    const saved = await flows.replaceSteps(created.id, created.draft!.id, user.admin, { steps, expectedRevision: created.draft!.revision });
    const flow = await flows.publish(created.id, saved.flow.draft!.id, user.admin, saved.flow.draft!.revision);
    const row = await scratch.db.petition.create({
      data: { stt: fresh('p'), receivedDate: new Date('2026-12-01T00:00:00Z'), senderName: `${tag} sender`, loaiThongTin: `Không ai biết ${tag}`, enteredById: user.admin, assignedTeamId: team.A, status: 'DANG_XU_LY' } as never,
    });
    recordIds.push(row.id);
    await commands.apply(user.admin, 'PETITION', row.id, { flowId: flow.id });
    const get = () => commands.get('PETITION', row.id);
    const first = (await get()).steps[0];
    const party = (role: string) => first.parties.find((candidate) => candidate.role === role)!.id;
    const assign = async (who: string, role: string, userId: string | null, extra: Record<string, unknown> = {}) =>
      assignments.assign(as(who), 'PETITION', row.id, first.stepKey, party(role), { expectedRevision: (await get()).revision, userId, ...extra });
    return { recordId: row.id, get, stepKey: first.stepKey, party, assign };
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

    permissions = await ensurePermissions(scratch, ['assign:ProcessingStep']);
    const plain = (await db.role.create({ data: { name: `${tag}-role` } })).id;
    const assigning = (await db.role.create({ data: { name: `${tag}-assigning`, permissions: { create: [{ permissionId: permissions.ids['assign:ProcessingStep'] }] } } })).id;
    roleIds.push(plain, assigning);
    for (const name of ['A', 'B', 'D']) team[name] = (await db.team.create({ data: { name: `${tag} unit ${name}`, code: `${tag}-${name}` } })).id;
    const person = async (name: string, teamName: string | null, over: { isLeader?: boolean; isActive?: boolean; roleId?: string } = {}) => {
      user[name] = (await db.user.create({ data: { username: `${tag}-${name}`, firstName: name, lastName: 'Tester', passwordHash: 'x', roleId: over.roleId ?? plain, isActive: over.isActive ?? true } })).id;
      if (teamName) await db.userTeam.create({ data: { userId: user[name], teamId: team[teamName], isLeader: over.isLeader ?? false } });
    };
    await person('admin', null);
    await person('dispatcher', null, { roleId: assigning }); // holds assign:ProcessingStep, belongs to no unit
    await person('head', 'A', { isLeader: true });
    await person('worker', 'A');
    await person('colleague', 'A');
    await person('retired', 'A', { isActive: false });
    await person('coordinator', 'B');
    await person('outsider', 'D');

    const prisma = db as never;
    const audit = new AuditService(prisma);
    const calendars = new WorkingCalendarService(prisma, audit);
    flows = new ProcessingFlowsService(prisma, audit, calendars);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    const gateway = new RecordGateway(new PetitionAdapter(prisma, scopes), new IncidentAdapter(prisma, scopes), new CaseAdapter(prisma, scopes));
    const writer = new RecordDeadlineWriter(prisma, gateway);
    const applier = new FlowApplicationService(prisma, gateway, calendars, audit, writer);
    commands = new ProcessingCommandService(prisma, gateway, calendars, applier, audit, writer);
    assignments = new ProcessingAssignmentService(prisma, commands, { canRead: () => Promise.resolve(recordInScope) } as never);
  });

  beforeEach(() => {
    recordInScope = true;
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
    await db.auditLog.deleteMany({ where: { userId: { in: Object.values(user) } } });
    await db.userTeam.deleteMany({ where: { userId: { in: Object.values(user) } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { id: { in: Object.values(user) } } });
    await db.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
    await db.role.deleteMany({ where: { id: { in: roleIds } } });
    await permissions.dropCreated();
    await scratch.close();
  });

  it('with nobody named, the heads of the unit answer for the party; the flow lists the row of each party', async () => {
    const { get } = await withFlow();
    const main = (await get()).steps[0].parties.find((party) => party.role === 'MAIN')!;
    expect(main.id).toEqual(expect.any(String));
    expect(main).toMatchObject({ assigneeUserId: null, assigneeName: null, responsible: [{ userId: user.head, name: 'head Tester' }] });
  });

  it('a holder of the permission with the record in scope names a member: the party answers through that person, the revision moves, the history keeps the old and the new person', async () => {
    const { recordId, get, party, assign } = await withFlow();
    const before = await get();
    const after = await assign('dispatcher', 'MAIN', user.worker);
    expect(after.revision).toBe(before.revision + 1);
    expect(after.steps[0].parties.find((row) => row.role === 'MAIN')).toMatchObject({ assigneeUserId: user.worker, assigneeName: 'worker Tester', responsible: [{ userId: user.worker, name: 'worker Tester' }] });
    await assign('dispatcher', 'MAIN', user.colleague);
    const history = await scratch.db.procStepChange.findMany({ where: { recordId, action: 'PARTY_ASSIGNED' }, orderBy: { at: 'asc' } });
    expect(history.map((row) => [row.fromValue, row.toValue, row.actorId])).toEqual([
      [{ partyId: party('MAIN'), assigneeUserId: null }, { partyId: party('MAIN'), assigneeUserId: user.worker }, user.dispatcher],
      [{ partyId: party('MAIN'), assigneeUserId: user.worker }, { partyId: party('MAIN'), assigneeUserId: user.colleague }, user.dispatcher],
    ]);
  });

  it('naming nobody gives the party back to the heads of the unit', async () => {
    const { assign } = await withFlow();
    await assign('head', 'MAIN', user.worker);
    const after = await assign('head', 'MAIN', null);
    expect(after.steps[0].parties.find((row) => row.role === 'MAIN')).toMatchObject({ assigneeUserId: null, responsible: [{ userId: user.head }] });
  });

  it('only an ACTIVE member of the party unit can be named: not a person of another unit, not a member who is no longer active, not an unknown id', async () => {
    const { assign, get } = await withFlow();
    for (const who of [user.coordinator, user.outsider, user.retired, 'no-such-user']) {
      expect(await failure(assign('dispatcher', 'MAIN', who))).toEqual({ status: 400, code: 'ASSIGNEE_NOT_ELIGIBLE' });
    }
    expect((await get()).steps[0].parties.find((row) => row.role === 'MAIN')?.assigneeUserId).toBeNull();
    // The coordinating party has its own unit: its member can be named there.
    await expect(assign('dispatcher', 'COORDINATE', user.coordinator)).resolves.toBeDefined();
  });

  it('a step that is done or set aside takes no new person; a step that waits does', async () => {
    const { recordId, stepKey, assign, get } = await withFlow([step(), step({ name: 'Second', anchor: 'PREVIOUS_STEP_DONE' })]);
    const second = (await get()).steps[1];
    expect(second.status).toBe('WAITING_ANCHOR');
    await expect(assignments.assign(as('head'), 'PETITION', recordId, second.stepKey, second.parties[0].id, { expectedRevision: (await get()).revision, userId: user.worker })).resolves.toBeDefined();
    await commands.completeStep(user.admin, 'PETITION', recordId, stepKey, { expectedRevision: (await get()).revision });
    expect(await failure(assign('head', 'MAIN', user.worker))).toEqual({ status: 409, code: 'STEP_CLOSED' });
    expect(await failure(assign('dispatcher', 'MAIN', null))).toEqual({ status: 409, code: 'STEP_CLOSED' });
  });

  it('a request decided on an older revision is refused and changes nothing', async () => {
    const { recordId, stepKey, party, get } = await withFlow();
    const stale = (await get()).revision;
    await assignments.assign(as('head'), 'PETITION', recordId, stepKey, party('MAIN'), { expectedRevision: stale, userId: user.worker });
    expect(await failure(assignments.assign(as('head'), 'PETITION', recordId, stepKey, party('MAIN'), { expectedRevision: stale, userId: user.colleague }))).toEqual({ status: 409, code: 'REVISION_CONFLICT' });
    expect((await get()).steps[0].parties.find((row) => row.role === 'MAIN')?.assigneeUserId).toBe(user.worker);
  });

  it('the same key a second time answers the same and writes nothing more', async () => {
    const { recordId, stepKey, party, get } = await withFlow();
    const input = { expectedRevision: (await get()).revision, userId: user.worker, idempotencyKey: `${tag}-assign-1` };
    const first = await assignments.assign(as('head'), 'PETITION', recordId, stepKey, party('MAIN'), input);
    const again = await assignments.assign(as('head'), 'PETITION', recordId, stepKey, party('MAIN'), input);
    expect(again).toEqual(JSON.parse(JSON.stringify(first)));
    expect((await get()).revision).toBe(first.revision);
    expect(await scratch.db.procStepChange.count({ where: { recordId, action: 'PARTY_ASSIGNED' } })).toBe(1);
  });

  describe('who may name a person', () => {
    it('a person with neither the permission, nor the unit, is refused; so is a member of ANOTHER party unit', async () => {
      const { assign } = await withFlow();
      for (const who of ['outsider', 'admin', 'coordinator']) {
        expect(await failure(assign(who, 'MAIN', user.worker))).toEqual({ status: 403, code: 'ASSIGN_NOT_ALLOWED' });
        expect(await failure(assign(who, 'MAIN', null))).toEqual({ status: 403, code: 'ASSIGN_NOT_ALLOWED' });
      }
    });

    it('the permission alone is not enough: the record must be in the person own scope', async () => {
      const { assign } = await withFlow();
      recordInScope = false;
      expect(await failure(assign('dispatcher', 'MAIN', user.worker))).toEqual({ status: 403, code: 'ASSIGN_NOT_ALLOWED' });
    });

    it('a head of the unit names a member of the unit without the permission, and only for the party of that unit', async () => {
      const { assign } = await withFlow();
      await expect(assign('head', 'MAIN', user.colleague)).resolves.toBeDefined();
      expect(await failure(assign('head', 'COORDINATE', user.coordinator))).toEqual({ status: 403, code: 'ASSIGN_NOT_ALLOWED' });
    });

    it('a member takes the work themself while nobody is named, and gives it back; never names a colleague, never takes it from the person named', async () => {
      const { assign } = await withFlow();
      expect(await failure(assign('worker', 'MAIN', user.colleague))).toEqual({ status: 403, code: 'ASSIGN_NOT_ALLOWED' });
      const taken = await assign('worker', 'MAIN', user.worker);
      expect(taken.steps[0].parties.find((row) => row.role === 'MAIN')?.assigneeUserId).toBe(user.worker);
      expect(await failure(assign('colleague', 'MAIN', user.colleague))).toEqual({ status: 403, code: 'ASSIGN_NOT_ALLOWED' });
      expect(await failure(assign('colleague', 'MAIN', null))).toEqual({ status: 403, code: 'ASSIGN_NOT_ALLOWED' });
      const given = await assign('worker', 'MAIN', null);
      expect(given.steps[0].parties.find((row) => row.role === 'MAIN')?.assigneeUserId).toBeNull();
    });

    it('a member of a unit that is no longer active has no say', async () => {
      const { assign } = await withFlow();
      await scratch.db.team.update({ where: { id: team.A }, data: { status: 'INACTIVE' } });
      try {
        expect(await failure(assign('head', 'MAIN', user.worker))).toEqual({ status: 403, code: 'ASSIGN_NOT_ALLOWED' });
        expect(await failure(assign('dispatcher', 'MAIN', user.worker))).toEqual({ status: 400, code: 'ASSIGNEE_NOT_ELIGIBLE' });
      } finally {
        await scratch.db.team.update({ where: { id: team.A }, data: { status: 'ACTIVE' } });
      }
    });
  });

  describe('the people who may be named', () => {
    it('are the active members of the party unit, shown to a member of it or to a holder of the permission, and to nobody else', async () => {
      const { recordId, stepKey, party } = await withFlow();
      const list = await assignments.candidates(as('worker'), 'PETITION', recordId, stepKey, party('MAIN'));
      expect(list.map((row) => row.userId).sort()).toEqual([user.head, user.worker, user.colleague].sort());
      expect(list.find((row) => row.userId === user.head)).toMatchObject({ name: 'head Tester', isLeader: true });
      await expect(assignments.candidates(as('dispatcher'), 'PETITION', recordId, stepKey, party('MAIN'))).resolves.toHaveLength(3);
      expect(await failure(assignments.candidates(as('outsider'), 'PETITION', recordId, stepKey, party('MAIN')))).toEqual({ status: 403, code: 'ASSIGN_NOT_ALLOWED' });
      expect(await failure(assignments.candidates(as('worker'), 'PETITION', recordId, stepKey, 'no-such-party'))).toEqual({ status: 404, code: 'PARTY_NOT_FOUND' });
    });
  });
});
