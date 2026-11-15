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
import { ProcessingTrackingService } from '../tracking/processing-tracking.service';
import { FlowApplicationService } from './flow-application.service';
import { ProcessingCommandService } from './processing-command.service';
import { actingForIds } from './processing-delegation';
import { ProcessingDelegationService } from './processing-delegation.service';
import { ProcessingResultsService } from './processing-results.service';
import { RecordDeadlineWriter } from './record-deadline-writer.service';
import { RecordStepAccessService } from './record-step-access.service';

/**
 * Delegation of processing work by date range (R8), on a REAL PostgreSQL: who may create and revoke one, when it is in
 * force, and what it gives the delegate: the steps that name the from-user (or a unit of theirs), and nothing else.
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
/** Noon in Vietnam on 9 December 2026: the day every case stands on unless it moves the clock. */
const NOON = new Date('2026-12-09T05:00:00Z');

run('Delegation of processing work, on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let flows: ProcessingFlowsService;
  let commands: ProcessingCommandService;
  let results: ProcessingResultsService;
  let delegations: ProcessingDelegationService;
  let tracking: ProcessingTrackingService;
  let gateway: RecordGateway;
  let permissions: EnsuredPermissions;
  let clock = NOON;
  const tag = `${PREFIX}${randomUUID().slice(0, 8)}`;
  const user: Record<string, string> = {};
  const team: Record<string, string> = {};
  const roleIds: string[] = [];
  const recordIds: string[] = [];
  let counter = 0;
  const fresh = (what: string) => `${tag} ${what} ${++counter}`;
  const as = (name: string) => ({ id: user[name], role: 'OFFICER', canDispatch: false });

  /** A petition held by unit A; with `flow`, one step worked by A (MAIN) due on 11 December. */
  const record = async (flow = true, extraParties: Array<{ partyKind: string; teamId: string; role: string }> = []) => {
    const row = await scratch.db.petition.create({
      data: { stt: fresh('p'), receivedDate: new Date('2026-12-01T00:00:00Z'), senderName: `${tag} sender`, loaiThongTin: `Không ai biết ${tag}`, enteredById: user.admin, assignedTeamId: team.A, status: 'DANG_XU_LY' } as never,
    });
    recordIds.push(row.id);
    if (flow) {
      const created = await flows.create(user.admin, { name: fresh('flow'), recordKind: 'PETITION' });
      const step = { name: 'Step', durationValue: 10, durationUnit: 'DAY', rollToWorkingDay: false, anchor: 'RECEIVED', redDays: 1, yellowDays: 2, greenDays: 3, legalBasis: 'Article 1', requiresApproval: true, parties: [{ partyKind: 'TEAM', teamId: team.A, role: 'MAIN' }, ...extraParties] };
      const saved = await flows.replaceSteps(created.id, created.draft!.id, user.admin, { steps: [step], expectedRevision: created.draft!.revision });
      const published = await flows.publish(created.id, saved.flow.draft!.id, user.admin, saved.flow.draft!.revision);
      await commands.apply(user.admin, 'PETITION', row.id, { flowId: published.id });
    }
    const get = () => commands.get('PETITION', row.id);
    return { recordId: row.id, get, key: async () => (await get()).steps[0].stepKey };
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

  /** worker (unit A and S) lets standin (unit S only) act for them, 8 to 10 December. */
  const delegate = (from = 'worker', to = 'standin', validFrom = '2026-12-08', validTo = '2026-12-10') =>
    delegations.create(user[from], { toUserId: user[to], validFrom, validTo, note: 'On leave' });

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

  const dropDelegations = () => scratch.db.procDelegation.deleteMany({ where: { OR: [{ fromUserId: { in: Object.values(user) } }, { toUserId: { in: Object.values(user) } }] } });

  beforeAll(async () => {
    scratch = await openScratchDatabase(url as string);
    const { db } = scratch;
    await takeTurnOnSharedRow(scratch.pg, 'processing-flows');
    await dropFlows();

    permissions = await ensurePermissions(scratch, ['read:Petition', 'assign:ProcessingStep']);
    const reader = (await db.role.create({ data: { name: `${tag}-role`, permissions: { create: [{ permissionId: permissions.ids['read:Petition'] }] } } })).id;
    const assigning = (await db.role.create({ data: { name: `${tag}-assigning`, permissions: { create: [{ permissionId: permissions.ids['read:Petition'] }, { permissionId: permissions.ids['assign:ProcessingStep'] }] } } })).id;
    roleIds.push(reader, assigning);
    for (const name of ['A', 'S', 'D', 'C']) team[name] = (await db.team.create({ data: { name: `${tag} unit ${name}`, code: `${tag}-${name}` } })).id;
    const person = async (name: string, teams: Array<[string, boolean?]>, over: { isActive?: boolean; roleId?: string } = {}) => {
      user[name] = (await db.user.create({ data: { username: `${tag}-${name}`, firstName: name, lastName: 'Tester', passwordHash: 'x', roleId: over.roleId ?? reader, isActive: over.isActive ?? true } })).id;
      for (const [teamName, isLeader] of teams) await db.userTeam.create({ data: { userId: user[name], teamId: team[teamName], isLeader: isLeader ?? false } });
    };
    await person('admin', []);
    await person('dispatcher', [], { roleId: assigning }); // holds assign:ProcessingStep, belongs to no unit
    await person('head', [['A', true]]); // heads the unit that works the step
    await person('worker', [['A'], ['S']]); // a member of it, and of S
    await person('standin', [['S']]); // a teammate of the worker through S only: unit A's records are not theirs
    await person('retired', [['S']], { isActive: false });
    await person('outsider', [['D']]);
    await person('both', [['S'], ['C']]); // a teammate of the worker through S, and a member of unit C in their own right

    const prisma = db as never;
    const audit = new AuditService(prisma);
    const calendars = new WorkingCalendarService(prisma, audit);
    flows = new ProcessingFlowsService(prisma, audit, calendars);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    const stepAccess = new RecordStepAccessService(prisma, { isEnabled: () => Promise.resolve(true) } as never);
    await stepAccess.refreshSwitch();
    stepAccess.now = () => clock;
    gateway = new RecordGateway(new PetitionAdapter(prisma, scopes, stepAccess), new IncidentAdapter(prisma, scopes, stepAccess), new CaseAdapter(prisma, scopes, stepAccess));
    const writer = new RecordDeadlineWriter(prisma, gateway);
    const applier = new FlowApplicationService(prisma, gateway, calendars, audit, writer);
    commands = new ProcessingCommandService(prisma, gateway, calendars, applier, audit, writer);
    commands.now = () => clock;
    results = new ProcessingResultsService(prisma, commands);
    delegations = new ProcessingDelegationService(prisma, audit);
    delegations.now = () => clock;
    tracking = new ProcessingTrackingService(prisma, scopes);
    tracking.now = () => clock;
  });

  beforeEach(() => {
    clock = NOON;
  });

  afterEach(async () => {
    await dropDelegations();
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    await dropDelegations();
    const flowIds = (await db.procRecordFlow.findMany({ where: { recordId: { in: recordIds } }, select: { id: true } })).map((row) => row.id);
    await db.auditLog.deleteMany({ where: { subject: 'ProcRecordFlow', subjectId: { in: flowIds } } });
    await db.procStepOpinion.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procStepReport.deleteMany({ where: { recordId: { in: recordIds } } });
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

  describe('creating and revoking', () => {
    it('a person delegates for themself: whole days in Vietnam are stored, the lists of both people show it in force, the audit keeps metadata only', async () => {
      const created = await delegate();
      expect(created).toMatchObject({ fromUserId: user.worker, fromName: 'worker Tester', toUserId: user.standin, toName: 'standin Tester', note: 'On leave', state: 'IN_FORCE', canRevoke: true });
      // 8 December 00:00 and 10 December 23:59:59.999 in Vietnam (UTC+7).
      expect([created.validFrom, created.validTo]).toEqual(['2026-12-07T17:00:00.000Z', '2026-12-10T16:59:59.999Z']);
      expect((await delegations.mine(user.worker)).given.map((row) => row.id)).toEqual([created.id]);
      const received = await delegations.mine(user.standin);
      expect(received.given).toEqual([]);
      expect(received.received).toMatchObject([{ id: created.id, state: 'IN_FORCE', canRevoke: false }]);
      const audit = await scratch.db.auditLog.findMany({ where: { subject: 'ProcDelegation', subjectId: created.id } });
      expect(audit.map((row) => [row.action, row.metadata])).toEqual([['PROC_DELEGATION_CREATED', { fromUserId: user.worker, toUserId: user.standin, validFrom: '2026-12-08', validTo: '2026-12-10' }]]);
    });

    it('the state follows the application clock: upcoming before the first day, in force to the last millisecond, ended after it', async () => {
      const created = await delegate();
      const stateAt = async (at: string) => {
        clock = new Date(at);
        return (await delegations.mine(user.worker)).given.find((row) => row.id === created.id)?.state;
      };
      expect(await stateAt('2026-12-07T16:59:59.999Z')).toBe('UPCOMING');
      expect(await stateAt('2026-12-07T17:00:00.000Z')).toBe('IN_FORCE');
      expect(await stateAt('2026-12-10T16:59:59.999Z')).toBe('IN_FORCE');
      expect(await stateAt('2026-12-10T17:00:00.000Z')).toBe('ENDED');
    });

    it('refuses dates that are no dates, a range that ends before it starts, and a range wholly in the past', async () => {
      expect(await failure(delegate('worker', 'standin', '2026-02-30', '2026-12-10'))).toEqual({ status: 400, code: 'DELEGATION_DATES_INVALID' });
      expect(await failure(delegate('worker', 'standin', '2026-12-10', '2026-12-09'))).toEqual({ status: 400, code: 'DELEGATION_DATES_INVALID' });
      expect(await failure(delegate('worker', 'standin', '2026-12-01', '2026-12-08'))).toEqual({ status: 400, code: 'DELEGATION_IN_PAST' });
      // Today is not the past: a delegation for today alone is taken.
      expect(await delegate('worker', 'standin', '2026-12-09', '2026-12-09')).toMatchObject({ state: 'IN_FORCE' });
    });

    it('refuses a delegate who is the person themself, whose account is closed, or who shares no active unit with them', async () => {
      expect(await failure(delegate('worker', 'worker'))).toEqual({ status: 400, code: 'DELEGATE_NOT_ELIGIBLE' });
      expect(await failure(delegate('worker', 'retired'))).toEqual({ status: 400, code: 'DELEGATE_NOT_ELIGIBLE' });
      expect(await failure(delegate('worker', 'outsider'))).toEqual({ status: 400, code: 'DELEGATE_NOT_ELIGIBLE' });
      // A unit that is no longer active makes nobody a teammate.
      await scratch.db.team.update({ where: { id: team.S }, data: { status: 'INACTIVE' as never } });
      try {
        expect(await failure(delegate('worker', 'standin'))).toEqual({ status: 400, code: 'DELEGATE_NOT_ELIGIBLE' });
      } finally {
        await scratch.db.team.update({ where: { id: team.S }, data: { status: 'ACTIVE' } });
      }
    });

    it('refuses a second delegation of the same person that overlaps one still standing; a revoked one no longer blocks', async () => {
      const first = await delegate();
      expect(await failure(delegate('worker', 'head', '2026-12-10', '2026-12-12'))).toEqual({ status: 409, code: 'DELEGATION_OVERLAP' });
      expect(await delegate('worker', 'head', '2026-12-11', '2026-12-12')).toMatchObject({ state: 'UPCOMING' });
      await delegations.revoke(user.worker, first.id);
      expect(await delegate('worker', 'head', '2026-12-09', '2026-12-10')).toMatchObject({ state: 'IN_FORCE' });
    });

    it('for somebody else: a head of a unit of that person and a holder of the permission may, a colleague and a stranger may not', async () => {
      const forWorker = (who: string) => delegations.create(user[who], { fromUserId: user.worker, toUserId: user.standin, validFrom: '2026-12-08', validTo: '2026-12-10' });
      expect(await failure(forWorker('standin'))).toEqual({ status: 403, code: 'DELEGATION_NOT_ALLOWED' });
      expect(await failure(forWorker('outsider'))).toEqual({ status: 403, code: 'DELEGATION_NOT_ALLOWED' });
      const byHead = await forWorker('head');
      expect(byHead).toMatchObject({ fromUserId: user.worker, createdById: user.head, canRevoke: true });
      await delegations.revoke(user.head, byHead.id);
      expect(await forWorker('dispatcher')).toMatchObject({ fromUserId: user.worker, createdById: user.dispatcher });
    });

    it('only the creator or the from-user revokes; a revoked delegation says so and cannot be revoked twice; an ended one is left alone', async () => {
      const created = await delegate();
      expect(await failure(delegations.revoke(user.standin, created.id))).toEqual({ status: 403, code: 'DELEGATION_NOT_ALLOWED' });
      expect(await failure(delegations.revoke(user.outsider, created.id))).toEqual({ status: 404, code: 'DELEGATION_NOT_FOUND' });
      expect(await failure(delegations.revoke(user.worker, 'no-such-id'))).toEqual({ status: 404, code: 'DELEGATION_NOT_FOUND' });
      expect(await delegations.revoke(user.worker, created.id)).toMatchObject({ state: 'REVOKED', canRevoke: false, revokedAt: NOON.toISOString() });
      expect(await scratch.db.procDelegation.findUnique({ where: { id: created.id } })).toMatchObject({ revokedAt: NOON, revokedById: user.worker });
      expect(await failure(delegations.revoke(user.worker, created.id))).toEqual({ status: 409, code: 'DELEGATION_ALREADY_REVOKED' });

      const second = await delegate();
      clock = new Date('2026-12-11T05:00:00Z');
      expect(await failure(delegations.revoke(user.worker, second.id))).toEqual({ status: 409, code: 'DELEGATION_ENDED' });
    });

    it('the candidates are the active members of the active units of the caller, without the caller', async () => {
      expect((await delegations.candidates(user.standin)).map((row) => row.name)).toEqual(['both Tester', 'worker Tester']);
      expect((await delegations.candidates(user.worker)).map((row) => row.name).sort()).toEqual(['both Tester', 'head Tester', 'standin Tester']);
      expect(await delegations.candidates(user.admin)).toEqual([]);
    });
  });

  describe('who a person acts for', () => {
    it('only while the delegation is in force: not before, not after, not once revoked, not for a from-user whose account is closed', async () => {
      const created = await delegate();
      const at = (instant: string) => actingForIds(scratch.db as never, user.standin, new Date(instant));
      expect(await at('2026-12-07T16:59:59.999Z')).toEqual([]);
      expect(await at('2026-12-09T05:00:00Z')).toEqual([user.worker]);
      expect(await at('2026-12-10T17:00:00.000Z')).toEqual([]);
      // The delegation runs one way.
      expect(await actingForIds(scratch.db as never, user.worker, NOON)).toEqual([]);

      await scratch.db.user.update({ where: { id: user.worker }, data: { isActive: false } });
      try {
        expect(await at('2026-12-09T05:00:00Z')).toEqual([]);
      } finally {
        await scratch.db.user.update({ where: { id: user.worker }, data: { isActive: true } });
      }
      await delegations.revoke(user.worker, created.id);
      expect(await at('2026-12-09T05:00:00Z')).toEqual([]);
    });
  });

  describe('what the delegate may do', () => {
    it('opens the record THROUGH the step, read-only, while the delegation is in force; never by the scope of the from-user, never a record no step gives them', async () => {
      const worked = await record();
      const other = await record(false); // held by the from-user's unit, with no step at all
      const canRead = (recordId: string, viaStep: boolean) => gateway.canRead('PETITION', recordId, as('standin'), { viaStep });
      // The from-user reads both by their own scope; the stand-in reads neither.
      expect([await gateway.canRead('PETITION', worked.recordId, as('worker')), await gateway.canRead('PETITION', other.recordId, as('worker'))]).toEqual([true, true]);
      expect([await canRead(worked.recordId, true), await canRead(other.recordId, true)]).toEqual([false, false]);

      await delegate();
      expect(await canRead(worked.recordId, true)).toBe(true);
      // What the write routes of the record rest on (the record's own scope) stays closed: the delegate cannot edit it.
      expect(await canRead(worked.recordId, false)).toBe(false);
      // The from-user's OTHER record: no step names them there, so nothing opens it.
      expect([await canRead(other.recordId, true), await canRead(other.recordId, false)]).toEqual([false, false]);

      clock = new Date('2026-12-10T17:00:00.000Z');
      expect(await canRead(worked.recordId, true)).toBe(false);
    });

    it('reports on the step in the place of the from-user, and the history says for whom; without a delegation the same person is refused', async () => {
      const { recordId, get, key } = await record();
      const report = async (who: string) => results.submitReport(user[who], 'PETITION', recordId, await key(), { expectedRevision: (await get()).revision, kind: 'PROGRESS', doneWork: `Work of ${who}` });
      expect(await failure(report('standin'))).toEqual({ status: 403, code: 'NOT_A_PARTY_OF_STEP' });

      await delegate();
      await report('standin');
      await report('worker');
      const history = await scratch.db.procStepChange.findMany({ where: { recordId, action: 'PROGRESS_REPORTED' }, orderBy: { at: 'asc' } });
      expect(history.map((row) => [row.actorId, (row.toValue as { onBehalfOfUserId?: string }).onBehalfOfUserId])).toEqual([
        [user.standin, user.worker],
        [user.worker, undefined],
      ]);
      const book = await results.results('PETITION', recordId, await key());
      expect(book.reports.map((row) => [row.authorId, row.authorTeamId])).toEqual([
        [user.standin, team.A],
        [user.worker, team.A],
      ]);

      // A result moves the step: every history row of that command carries the on-behalf person.
      await results.submitReport(user.standin, 'PETITION', recordId, await key(), { expectedRevision: (await get()).revision, kind: 'RESULT', doneWork: 'Finished' });
      expect((await get()).steps[0].status).toBe('REPORTED');
      const after = await scratch.db.procStepChange.findMany({ where: { recordId, actorId: user.standin }, orderBy: { at: 'asc' } });
      expect(after.length).toBeGreaterThanOrEqual(3);
      expect(after.every((row) => (row.toValue as { onBehalfOfUserId?: string }).onBehalfOfUserId === user.worker)).toBe(true);

      clock = new Date('2026-12-10T17:00:00.000Z');
      expect(await failure(results.withdrawReport(user.standin, 'PETITION', recordId, await key(), book.reports[0].id, { expectedRevision: (await get()).revision }))).toEqual({ status: 403, code: 'NOT_A_PARTY_OF_STEP' });
    });

    it('speaks as the head of the unit only when the person they act for heads it: the delegate of a member does not, the delegate of the head does', async () => {
      const { recordId, get, key } = await record();
      const opine = async (who: string) => results.addOpinion(user[who], 'PETITION', recordId, await key(), { expectedRevision: (await get()).revision, kind: 'SUPERVISOR', content: 'Keep going' });
      await delegate(); // worker -> standin: the worker is a member, not the head
      expect(await failure(opine('standin'))).toEqual({ status: 403, code: 'OPINION_NOT_ALLOWED' });
      expect(await failure(opine('worker'))).toEqual({ status: 403, code: 'OPINION_NOT_ALLOWED' });

      await delegations.create(user.head, { toUserId: user.worker, validFrom: '2026-12-09', validTo: '2026-12-09' });
      await opine('worker');
      const history = await scratch.db.procStepChange.findMany({ where: { recordId, action: 'OPINION_GIVEN' } });
      expect(history.map((row) => [row.actorId, row.toValue])).toEqual([[user.worker, { kind: 'SUPERVISOR', verdict: 'NOTE', onBehalfOfUserId: user.head }]]);
    });

    it('the party shows who acts for the responsible person and until when', async () => {
      const { get } = await record();
      await delegations.create(user.head, { toUserId: user.worker, validFrom: '2026-12-09', validTo: '2026-12-10' });
      expect((await get()).steps[0].parties[0].responsible).toEqual([{ userId: user.head, name: 'head Tester', delegateUserId: user.worker, delegateName: 'worker Tester', delegatedUntil: '2026-12-10T16:59:59.999Z' }]);
      clock = new Date('2026-12-10T17:00:00.000Z');
      expect((await get()).steps[0].parties[0].responsible).toEqual([{ userId: user.head, name: 'head Tester' }]);
    });

    it('"my work" on the tracking screen includes the work of the person they act for, and only while the delegation is in force', async () => {
      const { recordId } = await record();
      await scratch.db.procRecordStepParty.updateMany({ where: { recordStep: { recordId } }, data: { assigneeUserId: user.worker } });
      const mine = async (who: string) => (await tracking.items(as(who), { mine: true, kind: 'PETITION' })).items.filter((item) => item.recordId === recordId).length;
      expect([await mine('worker'), await mine('standin')]).toEqual([1, 0]);
      await delegate();
      expect([await mine('worker'), await mine('standin')]).toEqual([1, 1]);
      // Without the filter the stand-in reaches the work by the steps that name a unit of the from-user, and nothing once it ends.
      const reached = async () => (await tracking.items(as('standin'), { kind: 'PETITION', pageSize: 100 })).items.filter((item) => recordIds.includes(item.recordId)).length;
      expect(await reached()).toBeGreaterThanOrEqual(1);
      clock = new Date('2026-12-10T17:00:00.000Z');
      expect([await mine('standin'), await reached()]).toEqual([0, 0]);
    });
  });

  describe('a delegation that lost what made it valid (found by Codex)', () => {
    const acting = () => actingForIds(scratch.db as never, user.standin, NOON);

    it('gives nothing once the delegate left the unit they shared, and counts again when they are back', async () => {
      const worked = await record();
      await delegate();
      const opens = () => gateway.canRead('PETITION', worked.recordId, as('standin'), { viaStep: true });
      expect([await acting(), await opens()]).toEqual([[user.worker], true]);
      await scratch.db.userTeam.deleteMany({ where: { userId: user.standin, teamId: team.S } });
      try {
        expect([await acting(), await opens()]).toEqual([[], false]);
        expect(await failure(results.submitReport(user.standin, 'PETITION', worked.recordId, await worked.key(), { expectedRevision: (await worked.get()).revision, kind: 'PROGRESS', doneWork: 'x' }))).toEqual({ status: 403, code: 'NOT_A_PARTY_OF_STEP' });
        expect((await tracking.items(as('standin'), { kind: 'PETITION', pageSize: 100 })).items.filter((item) => item.recordId === worked.recordId)).toEqual([]);
      } finally {
        await scratch.db.userTeam.create({ data: { userId: user.standin, teamId: team.S } });
      }
      expect([await acting(), await opens()]).toEqual([[user.worker], true]);
    });

    it('gives nothing while the unit they shared is not active', async () => {
      await delegate();
      await scratch.db.team.update({ where: { id: team.S }, data: { status: 'INACTIVE' as never } });
      try {
        expect(await acting()).toEqual([]);
      } finally {
        await scratch.db.team.update({ where: { id: team.S }, data: { status: 'ACTIVE' } });
      }
      expect(await acting()).toEqual([user.worker]);
    });

    it('gives nothing while the account of the delegate is closed, and the party no longer shows them as the substitute', async () => {
      const { get } = await record();
      await delegations.create(user.head, { toUserId: user.worker, validFrom: '2026-12-09', validTo: '2026-12-10' });
      expect((await get()).steps[0].parties[0].responsible).toMatchObject([{ userId: user.head, delegateUserId: user.worker }]);
      await scratch.db.user.update({ where: { id: user.worker }, data: { isActive: false } });
      try {
        expect(await actingForIds(scratch.db as never, user.worker, NOON)).toEqual([]);
        expect((await get()).steps[0].parties[0].responsible).toEqual([{ userId: user.head, name: 'head Tester' }]);
      } finally {
        await scratch.db.user.update({ where: { id: user.worker }, data: { isActive: true } });
      }
    });
  });

  describe('for whom a write is recorded (found by Codex)', () => {
    const behalf = async (recordId: string, action: string) =>
      (await scratch.db.procStepChange.findMany({ where: { recordId, action }, orderBy: { at: 'asc' } })).map((row) => [row.actorId, (row.toValue as { onBehalfOfUserId?: string } | null)?.onBehalfOfUserId]);

    it('a person who holds a role of their own that allows the write acts for nobody, although a delegation gives them another role: report, edit, withdraw, opinion', async () => {
      const { recordId, get, key } = await record(true, [{ partyKind: 'TEAM', teamId: team.C, role: 'COORDINATE' }]);
      await delegate('worker', 'both'); // `both` coordinates in their own right, and is MAIN only through the worker
      const base = async () => ({ expectedRevision: (await get()).revision });
      await results.submitReport(user.both, 'PETITION', recordId, await key(), { ...(await base()), kind: 'PROGRESS', doneWork: 'Own work' });
      const book = await results.results('PETITION', recordId, await key());
      // The report is the unit's own: written through unit C, not through the unit of the person they act for.
      expect(book.reports.map((row) => [row.authorId, row.authorTeamId])).toEqual([[user.both, team.C]]);
      await results.editReport(user.both, 'PETITION', recordId, await key(), book.reports[0].id, { ...(await base()), doneWork: 'Own work, corrected' });
      await results.withdrawReport(user.both, 'PETITION', recordId, await key(), book.reports[0].id, await base());
      await results.addOpinion(user.both, 'PETITION', recordId, await key(), { ...(await base()), kind: 'COORDINATE', content: 'Agreed' });
      expect([await behalf(recordId, 'PROGRESS_REPORTED'), await behalf(recordId, 'REPORT_EDITED'), await behalf(recordId, 'REPORT_WITHDRAWN'), await behalf(recordId, 'OPINION_GIVEN')]).toEqual([
        [[user.both, undefined]],
        [[user.both, undefined]],
        [[user.both, undefined]],
        [[user.both, undefined]],
      ]);
    });

    it('a person with no role of their own that allows the write acts for the person who delegated: report, edit, withdraw, opinion', async () => {
      // Unit C checks here: `both` may give a CHECK opinion themself, but reports only through the worker.
      const { recordId, get, key } = await record(true, [{ partyKind: 'TEAM', teamId: team.C, role: 'CHECK' }]);
      await delegate('worker', 'both');
      const base = async () => ({ expectedRevision: (await get()).revision });
      await results.submitReport(user.both, 'PETITION', recordId, await key(), { ...(await base()), kind: 'PROGRESS', doneWork: 'For the worker' });
      const book = await results.results('PETITION', recordId, await key());
      expect(book.reports.map((row) => [row.authorId, row.authorTeamId])).toEqual([[user.both, team.A]]);
      await results.editReport(user.both, 'PETITION', recordId, await key(), book.reports[0].id, { ...(await base()), doneWork: 'For the worker, corrected' });
      await results.withdrawReport(user.both, 'PETITION', recordId, await key(), book.reports[0].id, await base());
      await results.addOpinion(user.both, 'PETITION', recordId, await key(), { ...(await base()), kind: 'CHECK', verdict: 'NOTE', content: 'Looked at it' });
      // The head lets `worker` act for them: the SUPERVISOR opinion of the worker is the head's.
      await delegations.create(user.head, { toUserId: user.worker, validFrom: '2026-12-09', validTo: '2026-12-09' });
      await results.addOpinion(user.worker, 'PETITION', recordId, await key(), { ...(await base()), kind: 'SUPERVISOR', content: 'Keep going' });
      expect([await behalf(recordId, 'PROGRESS_REPORTED'), await behalf(recordId, 'REPORT_EDITED'), await behalf(recordId, 'REPORT_WITHDRAWN'), await behalf(recordId, 'OPINION_GIVEN')]).toEqual([
        [[user.both, user.worker]],
        [[user.both, user.worker]],
        [[user.both, user.worker]],
        [
          [user.both, undefined],
          [user.worker, user.head],
        ],
      ]);
    });
  });

  describe('what the screen is told the delegate may do (viewer)', () => {
    it('offers the report form through the delegation, the head’s opinion only to the delegate of the head, and never taking or naming: those stay the person’s own', async () => {
      const { recordId, get } = await record();
      const viewerOf = async (who: string) => (await commands.get('PETITION', recordId, user[who])).steps[0].viewer;
      const main = (await get()).steps[0].parties[0].id;
      expect(await viewerOf('standin')).toEqual({ canReport: false, opinionKinds: [], canApprove: true, memberOfPartyIds: [], leaderOfPartyIds: [] });
      expect(await viewerOf('worker')).toEqual({ canReport: true, opinionKinds: [], canApprove: true, memberOfPartyIds: [main], leaderOfPartyIds: [] });

      await delegate(); // worker -> standin
      await delegations.create(user.head, { toUserId: user.worker, validFrom: '2026-12-09', validTo: '2026-12-09' });
      // The stand-in is offered the worker's report form; the party is still not theirs to take.
      expect(await viewerOf('standin')).toEqual({ canReport: true, opinionKinds: [], canApprove: true, memberOfPartyIds: [], leaderOfPartyIds: [] });
      // The worker speaks as the head they act for, and still does not name people of the unit.
      expect(await viewerOf('worker')).toEqual({ canReport: true, opinionKinds: ['SUPERVISOR'], canApprove: true, memberOfPartyIds: [main], leaderOfPartyIds: [] });
      // The answer of a write is the actor's: the delegate keeps the form after reporting.
      const after = await results.submitReport(user.standin, 'PETITION', recordId, (await get()).steps[0].stepKey, { expectedRevision: (await get()).revision, kind: 'PROGRESS', doneWork: 'For the worker' });
      expect(after.steps[0].viewer).toMatchObject({ canReport: true, memberOfPartyIds: [] });

      clock = new Date('2026-12-10T17:00:00.000Z');
      expect(await viewerOf('standin')).toEqual({ canReport: false, opinionKinds: [], canApprove: true, memberOfPartyIds: [], leaderOfPartyIds: [] });
    });
  });

  describe('the tracking list', () => {
    it('names the person who acts for the responsible one, and nobody once the delegation gives nothing', async () => {
      const { recordId } = await record();
      await scratch.db.procRecordStepParty.updateMany({ where: { recordStep: { recordId } }, data: { assigneeUserId: user.worker } });
      const row = async () => (await tracking.items(as('worker'), { mine: true, kind: 'PETITION', pageSize: 100 })).items.find((item) => item.recordId === recordId);
      expect(await row()).toMatchObject({ responsibleName: 'Tester worker', delegateName: null });
      await delegate();
      expect(await row()).toMatchObject({ responsibleName: 'Tester worker', delegateName: 'Tester standin' });
      await scratch.db.user.update({ where: { id: user.standin }, data: { isActive: false } });
      try {
        expect(await row()).toMatchObject({ delegateName: null });
      } finally {
        await scratch.db.user.update({ where: { id: user.standin }, data: { isActive: true } });
      }
    });
  });
});
