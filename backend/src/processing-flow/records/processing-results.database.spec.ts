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
import { ProcessingResultsService } from './processing-results.service';
import { RecordDeadlineWriter } from './record-deadline-writer.service';

/**
 * The results of a step, on a REAL PostgreSQL: the reports of the unit that works it, the opinions of the head of the
 * unit and of the units that coordinate or check, and the leader's decision. WHO may write what is judged from the
 * step itself (a unit that is a party of it, the role it speaks as), what each writes to the step (a result waits for
 * the leader or finishes the step; a disagreement or a request for rework sends it back), and the guarantees of every
 * write (revision, idempotency key, history).
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

const PREFIX = 'pfr-test-';

run('Results of a step on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let flows: ProcessingFlowsService;
  let commands: ProcessingCommandService;
  let results: ProcessingResultsService;
  const tag = `${PREFIX}${randomUUID().slice(0, 8)}`;
  const user: Record<string, string> = {};
  const team: Record<string, string> = {};
  let roleId = '';
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
    requiresApproval: true,
    parties: [
      { partyKind: 'TEAM', teamId: team.A, role: 'MAIN' },
      { partyKind: 'TEAM', teamId: team.B, role: 'CHECK' },
      { partyKind: 'TEAM', teamId: team.C, role: 'COORDINATE' },
    ],
    ...over,
  });

  /** A petition whose flow is `steps`, applied by hand. */
  const withFlow = async (steps: unknown[]) => {
    const created = await flows.create(user.admin, { name: fresh('flow'), recordKind: 'PETITION' });
    const saved = await flows.replaceSteps(created.id, created.draft!.id, user.admin, { steps, expectedRevision: created.draft!.revision });
    const flow = await flows.publish(created.id, saved.flow.draft!.id, user.admin, saved.flow.draft!.revision);
    const row = await scratch.db.petition.create({
      data: { stt: fresh('p'), receivedDate: new Date('2026-12-01T00:00:00Z'), senderName: `${tag} sender`, loaiThongTin: `Không ai biết ${tag}`, enteredById: user.admin, assignedTeamId: team.A, status: 'DANG_XU_LY' } as never,
    });
    recordIds.push(row.id);
    await commands.apply(user.admin, 'PETITION', row.id, { flowId: flow.id });
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
    for (const name of ['A', 'B', 'C', 'D']) team[name] = (await db.team.create({ data: { name: `${tag} unit ${name}`, code: `${tag}-${name}` } })).id;
    const person = async (name: string, teamName: string | null, isLeader = false) => {
      user[name] = (await db.user.create({ data: { username: `${tag}-${name}`, firstName: name, lastName: 'Tester', passwordHash: 'x', roleId, isActive: true } })).id;
      if (teamName) await db.userTeam.create({ data: { userId: user[name], teamId: team[teamName], isLeader } });
    };
    await person('admin', null);
    await person('head', 'A', true); // head of the unit that works the step
    await person('worker', 'A'); // a member of it
    await person('checker', 'B');
    await person('coordinator', 'C');
    await person('outsider', 'D');
    await person('approver', null); // the leader who approves: no unit needed

    const prisma = db as never;
    const audit = new AuditService(prisma);
    const calendars = new WorkingCalendarService(prisma, audit);
    flows = new ProcessingFlowsService(prisma, audit, calendars);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    const gateway = new RecordGateway(new PetitionAdapter(prisma, scopes), new IncidentAdapter(prisma, scopes), new CaseAdapter(prisma, scopes));
    const writer = new RecordDeadlineWriter(prisma, gateway);
    const applier = new FlowApplicationService(prisma, gateway, calendars, audit, writer);
    commands = new ProcessingCommandService(prisma, gateway, calendars, applier, audit, writer);
    results = new ProcessingResultsService(prisma, commands);
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
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
    await db.role.deleteMany({ where: { id: roleId } });
    await scratch.close();
  });

  const report = (over: Record<string, unknown> = {}) => ({ kind: 'PROGRESS' as const, doneWork: 'Visited the site', ...over });

  describe('reports', () => {
    it('a unit that is a party writes a progress report, with its proposal and documents; the step stays open and its summary line shows it', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      const before = await get();
      const after = await results.submitReport(user.worker, 'PETITION', recordId, await key(), {
        expectedRevision: before.revision,
        ...report({ findings: 'The facts hold', difficulties: 'A witness is away', proposalKind: 'REPLY', proposalContent: 'Answer the sender', proposalBasis: 'Article 5', documents: [{ type: 'Minutes', number: '12', date: '2026-12-03' }] }),
      });
      expect(after.steps[0]).toMatchObject({ status: 'OPEN', latestReport: { kind: 'PROGRESS', summary: 'Visited the site' } });
      const book = await results.results('PETITION', recordId, await key());
      expect(book.reports).toMatchObject([{ kind: 'PROGRESS', doneWork: 'Visited the site', proposalKind: 'REPLY', documents: [{ type: 'Minutes', number: '12', date: '2026-12-03' }], authorName: 'worker Tester', authorTeamId: team.A, answered: false, revision: 1 }]);
    });

    it('only a unit that is a party of THIS step writes: a unit that only checks, a stranger and an administrator with no unit do not', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      const { revision } = await get();
      for (const who of ['checker', 'outsider', 'admin', 'approver']) {
        expect(await failure(results.submitReport(user[who], 'PETITION', recordId, await key(), { expectedRevision: revision, ...report() }))).toEqual({ status: 403, code: 'NOT_A_PARTY_OF_STEP' });
      }
      // The unit that coordinates may report its part.
      await expect(results.submitReport(user.coordinator, 'PETITION', recordId, await key(), { expectedRevision: revision, ...report() })).resolves.toBeDefined();
    });

    it('a stopped unit does not count, and a person NAMED on the step counts whatever their unit', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      await scratch.db.procRecordStepParty.updateMany({ where: { recordStep: { recordId }, role: 'COORDINATE' }, data: { teamId: null, partyKind: 'RECORD_TEAM', assigneeUserId: user.outsider } });
      const { revision } = await get();
      await expect(results.submitReport(user.outsider, 'PETITION', recordId, await key(), { expectedRevision: revision, ...report() })).resolves.toBeDefined();
      await scratch.db.team.update({ where: { id: team.A }, data: { status: 'INACTIVE' } });
      try {
        const now = await get();
        expect(await failure(results.submitReport(user.worker, 'PETITION', recordId, await key(), { expectedRevision: now.revision, ...report() }))).toEqual({ status: 403, code: 'NOT_A_PARTY_OF_STEP' });
      } finally {
        await scratch.db.team.update({ where: { id: team.A }, data: { status: 'ACTIVE' } });
      }
    });

    it('what is written is checked: the work done is required, the proposal is one of the record\'s kind, the documents are bounded', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      const { revision } = await get();
      const send = (over: Record<string, unknown>) => failure(results.submitReport(user.worker, 'PETITION', recordId, key_, { expectedRevision: revision, ...report(), ...over } as never));
      const key_ = await key();
      expect(await send({ doneWork: '   ' })).toEqual({ status: 400, code: 'REPORT_TEXT_REQUIRED' });
      expect(await send({ proposalKind: 'PROSECUTE' })).toEqual({ status: 400, code: 'PROPOSAL_KIND_UNKNOWN' }); // a proposal of incidents, not of petitions
      expect(await send({ documents: 'a list' })).toEqual({ status: 400, code: 'DOCUMENTS_INVALID' });
      expect(await send({ documents: Array.from({ length: 51 }, () => ({})) })).toEqual({ status: 400, code: 'DOCUMENTS_INVALID' });
      expect((await results.results('PETITION', recordId, key_)).reports).toHaveLength(0);
    });

    it('the result of a step that asks for approval waits for the leader; the result of one that does not finishes it and starts the next', async () => {
      const approval = await withFlow([step()]);
      let flow = await approval.get();
      flow = await results.submitReport(user.head, 'PETITION', approval.recordId, flow.steps[0].stepKey, { expectedRevision: flow.revision, ...report({ kind: 'RESULT', doneWork: 'Verified' }) });
      expect(flow.steps[0].status).toBe('REPORTED');

      const direct = await withFlow([step({ requiresApproval: false }), step({ requiresApproval: false, anchor: 'PREVIOUS_STEP_DONE' })]);
      flow = await direct.get();
      flow = await results.submitReport(user.head, 'PETITION', direct.recordId, flow.steps[0].stepKey, { expectedRevision: flow.revision, ...report({ kind: 'RESULT', doneWork: 'Verified' }) });
      expect(flow.steps[0].status).toBe('DONE');
      expect(flow.steps[1].status).toBe('OPEN'); // counted from the completion of the first
    });

    it('a retried write with the same key writes one report', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      const input = { expectedRevision: (await get()).revision, idempotencyKey: `${tag}-key-report-0001`, ...report() };
      const first = await results.submitReport(user.worker, 'PETITION', recordId, await key(), input);
      expect(await results.submitReport(user.worker, 'PETITION', recordId, await key(), input)).toEqual(first);
      expect((await results.results('PETITION', recordId, await key())).reports).toHaveLength(1);
    });

    it('is refused on a step that is not being worked, and a stale revision is refused', async () => {
      const { recordId, get, key } = await withFlow([step(), step({ anchor: 'PREVIOUS_STEP_DONE' })]);
      const flow = await get();
      expect(await failure(results.submitReport(user.worker, 'PETITION', recordId, flow.steps[1].stepKey, { expectedRevision: flow.revision, ...report() }))).toEqual({ status: 409, code: 'STEP_NOT_OPEN' });
      expect(await failure(results.submitReport(user.worker, 'PETITION', recordId, await key(), { expectedRevision: flow.revision + 5, ...report() }))).toEqual({ status: 409, code: 'REVISION_CONFLICT' });
    });
  });

  describe('what the code found when it was reviewed', () => {
    it('a person NAMED on the step takes part but does not head the unit: no opinion as its head (found by Codex)', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      await scratch.db.procRecordStepParty.updateMany({ where: { recordStep: { recordId }, role: 'MAIN' }, data: { teamId: null, partyKind: 'RECORD_TEAM', assigneeUserId: user.outsider } });
      const { revision } = await get();
      expect(await failure(results.addOpinion(user.outsider, 'PETITION', recordId, await key(), { expectedRevision: revision, kind: 'SUPERVISOR', verdict: 'NOTE', content: 'As the head' }))).toEqual({ status: 403, code: 'OPINION_NOT_ALLOWED' });
      // ...but may report, as a participant.
      await expect(results.submitReport(user.outsider, 'PETITION', recordId, await key(), { expectedRevision: revision, ...report() })).resolves.toBeDefined();
    });

    it('leaving the unit ends the right to edit or withdraw what it wrote, a report and an opinion alike (found by Codex)', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      let flow = await get();
      const key_ = await key();
      flow = await results.submitReport(user.worker, 'PETITION', recordId, key_, { expectedRevision: flow.revision, ...report({ kind: 'RESULT', doneWork: 'Verified' }) });
      const [result] = (await results.results('PETITION', recordId, key_)).reports;
      await scratch.db.userTeam.deleteMany({ where: { userId: user.worker } });
      try {
        expect(await failure(results.withdrawReport(user.worker, 'PETITION', recordId, key_, result.id, { expectedRevision: flow.revision }))).toEqual({ status: 403, code: 'NOT_A_PARTY_OF_STEP' });
        expect(await failure(results.editReport(user.worker, 'PETITION', recordId, key_, result.id, { expectedRevision: flow.revision, doneWork: 'Changed from outside' }))).toEqual({ status: 403, code: 'NOT_A_PARTY_OF_STEP' });
      } finally {
        await scratch.db.userTeam.create({ data: { userId: user.worker, teamId: team.A } });
      }
      // An opinion the person can no longer speak as cannot be withdrawn either.
      flow = await results.addOpinion(user.coordinator, 'PETITION', recordId, key_, { expectedRevision: flow.revision, kind: 'COORDINATE', verdict: 'NOTE', content: 'Our part' });
      const opinion = (await results.results('PETITION', recordId, key_)).opinions.at(-1)!;
      await scratch.db.userTeam.deleteMany({ where: { userId: user.coordinator } });
      try {
        expect(await failure(results.withdrawOpinion(user.coordinator, 'PETITION', recordId, key_, opinion.id, { expectedRevision: flow.revision }))).toEqual({ status: 403, code: 'OPINION_NOT_ALLOWED' });
      } finally {
        await scratch.db.userTeam.create({ data: { userId: user.coordinator, teamId: team.C } });
      }
    });

    it('only ONE result stands: a new one replaces the earlier, which stays in the book and can no longer move the step (found by Codex)', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      let flow = await get();
      const key_ = await key();
      flow = await results.submitReport(user.worker, 'PETITION', recordId, key_, { expectedRevision: flow.revision, ...report({ kind: 'RESULT', doneWork: 'First version' }) });
      flow = await results.decide(user.approver, 'PETITION', recordId, key_, { expectedRevision: flow.revision, verdict: 'DISAGREE', content: 'Not enough' });
      flow = await results.submitReport(user.worker, 'PETITION', recordId, key_, { expectedRevision: flow.revision, ...report({ kind: 'RESULT', doneWork: 'Second version' }) });
      const [first, second] = (await results.results('PETITION', recordId, key_)).reports;
      expect(first.supersededAt).not.toBeNull();
      expect(second.supersededAt).toBeNull();
      // The first can be neither withdrawn nor edited: it is not the standing result.
      expect(await failure(results.withdrawReport(user.worker, 'PETITION', recordId, key_, first.id, { expectedRevision: flow.revision }))).toEqual({ status: 404, code: 'REPORT_NOT_FOUND' });
      expect((await get()).steps[0].status).toBe('REPORTED');
      // The decision goes to the standing one.
      flow = await results.decide(user.approver, 'PETITION', recordId, key_, { expectedRevision: flow.revision, verdict: 'AGREE' });
      expect((await results.results('PETITION', recordId, key_)).opinions.at(-1)).toMatchObject({ verdict: 'AGREE', reportId: second.id });
    });

    it('a remark made while the result waits answers that result and protects it from being taken back (found by Codex)', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      let flow = await get();
      const key_ = await key();
      flow = await results.addOpinion(user.head, 'PETITION', recordId, key_, { expectedRevision: flow.revision, kind: 'SUPERVISOR', verdict: 'NOTE', content: 'Still working' });
      flow = await results.submitReport(user.worker, 'PETITION', recordId, key_, { expectedRevision: flow.revision, ...report({ kind: 'RESULT', doneWork: 'Verified' }) });
      flow = await results.addOpinion(user.head, 'PETITION', recordId, key_, { expectedRevision: flow.revision, kind: 'SUPERVISOR', verdict: 'NOTE', content: 'The unit endorses it' });
      const book = await results.results('PETITION', recordId, key_);
      expect(book.opinions[0].reportId).toBeNull(); // before the result: stands alone
      expect(book.opinions[1]).toMatchObject({ reportId: book.reports[0].id, reportRevision: 1 });
      expect(await failure(results.withdrawReport(user.worker, 'PETITION', recordId, key_, book.reports[0].id, { expectedRevision: flow.revision }))).toEqual({ status: 409, code: 'REPORT_ANSWERED' });
    });
  });

  describe('editing and withdrawing a report', () => {
    it('the author corrects it while nobody has answered; another person of the unit may not', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      let flow = await get();
      flow = await results.submitReport(user.worker, 'PETITION', recordId, await key(), { expectedRevision: flow.revision, ...report() });
      const [first] = (await results.results('PETITION', recordId, await key())).reports;
      expect(await failure(results.editReport(user.head, 'PETITION', recordId, await key(), first.id, { expectedRevision: flow.revision, doneWork: 'Hijacked' }))).toEqual({ status: 403, code: 'REPORT_NOT_YOURS' });
      flow = await results.editReport(user.worker, 'PETITION', recordId, await key(), first.id, { expectedRevision: flow.revision, doneWork: 'Visited the site twice', proposalKind: 'SAVE_FILE' });
      const [edited] = (await results.results('PETITION', recordId, await key())).reports;
      expect(edited).toMatchObject({ doneWork: 'Visited the site twice', proposalKind: 'SAVE_FILE', revision: 2 });
      expect(flow.steps[0].latestReport).toMatchObject({ summary: 'Visited the site twice', revision: 2 });
    });

    it('once somebody has answered it, it can be neither edited nor withdrawn', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      let flow = await get();
      flow = await results.submitReport(user.worker, 'PETITION', recordId, await key(), { expectedRevision: flow.revision, ...report({ kind: 'RESULT', doneWork: 'Verified' }) });
      const [result] = (await results.results('PETITION', recordId, await key())).reports;
      flow = await results.addOpinion(user.checker, 'PETITION', recordId, await key(), { expectedRevision: flow.revision, kind: 'CHECK', verdict: 'PASS' });
      expect(await failure(results.withdrawReport(user.worker, 'PETITION', recordId, await key(), result.id, { expectedRevision: flow.revision }))).toEqual({ status: 409, code: 'REPORT_ANSWERED' });
      expect(await failure(results.editReport(user.worker, 'PETITION', recordId, await key(), result.id, { expectedRevision: flow.revision, doneWork: 'Changed after the check' }))).toEqual({ status: 409, code: 'REPORT_ANSWERED' });
    });

    it('withdrawing a result nobody answered takes the step back to being worked, and the report stays in the book, marked', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      let flow = await get();
      flow = await results.submitReport(user.worker, 'PETITION', recordId, await key(), { expectedRevision: flow.revision, ...report({ kind: 'RESULT', doneWork: 'Verified' }) });
      expect(flow.steps[0].status).toBe('REPORTED');
      const [result] = (await results.results('PETITION', recordId, await key())).reports;
      flow = await results.withdrawReport(user.worker, 'PETITION', recordId, await key(), result.id, { expectedRevision: flow.revision });
      expect(flow.steps[0]).toMatchObject({ status: 'OPEN', latestReport: null });
      const [kept] = (await results.results('PETITION', recordId, await key())).reports;
      expect(kept.withdrawnAt).not.toBeNull();
      // A withdrawn report cannot be withdrawn again.
      expect(await failure(results.withdrawReport(user.worker, 'PETITION', recordId, await key(), result.id, { expectedRevision: flow.revision }))).toEqual({ status: 404, code: 'REPORT_NOT_FOUND' });
    });
  });

  describe('opinions', () => {
    it('each speaks as the role it holds: the head of the unit, the unit that coordinates, the unit that checks', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      let flow = await get();
      const speak = (who: string, kind: 'SUPERVISOR' | 'COORDINATE' | 'CHECK', verdict: string, content?: string) =>
        results.addOpinion(user[who], 'PETITION', recordId, key_, { expectedRevision: flow.revision, kind, verdict, content });
      const key_ = await key();
      // A member of the unit who does not head it cannot speak as the head; the head can.
      expect(await failure(speak('worker', 'SUPERVISOR', 'NOTE', 'I agree'))).toEqual({ status: 403, code: 'OPINION_NOT_ALLOWED' });
      flow = await speak('head', 'SUPERVISOR', 'NOTE', 'The unit stands behind the report');
      flow = await speak('coordinator', 'COORDINATE', 'NOTE', 'Our part is done');
      // A stranger speaks as nobody; a checker cannot speak as the coordinator.
      expect(await failure(speak('outsider', 'CHECK', 'NOTE', 'x'))).toEqual({ status: 403, code: 'OPINION_NOT_ALLOWED' });
      expect(await failure(speak('checker', 'COORDINATE', 'NOTE', 'x'))).toEqual({ status: 403, code: 'OPINION_NOT_ALLOWED' });
      const book = await results.results('PETITION', recordId, key_);
      expect(book.opinions.map((o) => [o.kind, o.verdict, o.authorName])).toEqual([['SUPERVISOR', 'NOTE', 'head Tester'], ['COORDINATE', 'NOTE', 'coordinator Tester']]);
      expect(flow.steps[0].latestOpinion).toMatchObject({ kind: 'COORDINATE', verdict: 'NOTE' });
    });

    it('a check names the exact report and its revision; it needs a result to pass; the verdicts of the kind are the only ones', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      let flow = await get();
      const key_ = await key();
      expect(await failure(results.addOpinion(user.checker, 'PETITION', recordId, key_, { expectedRevision: flow.revision, kind: 'CHECK', verdict: 'PASS' }))).toEqual({ status: 409, code: 'NO_RESULT_REPORT' });
      expect(await failure(results.addOpinion(user.checker, 'PETITION', recordId, key_, { expectedRevision: flow.revision, kind: 'CHECK', verdict: 'AGREE' }))).toEqual({ status: 400, code: 'VERDICT_INVALID' });
      expect(await failure(results.addOpinion(user.head, 'PETITION', recordId, key_, { expectedRevision: flow.revision, kind: 'SUPERVISOR', verdict: 'PASS' }))).toEqual({ status: 400, code: 'VERDICT_INVALID' });
      expect(await failure(results.addOpinion(user.checker, 'PETITION', recordId, key_, { expectedRevision: flow.revision, kind: 'APPROVAL' as never, verdict: 'AGREE' }))).toEqual({ status: 400, code: 'OPINION_NOT_ALLOWED' });
      flow = await results.submitReport(user.worker, 'PETITION', recordId, key_, { expectedRevision: flow.revision, ...report({ kind: 'RESULT', doneWork: 'Verified' }) });
      flow = await results.addOpinion(user.checker, 'PETITION', recordId, key_, { expectedRevision: flow.revision, kind: 'CHECK', verdict: 'PASS', content: 'In order' });
      const book = await results.results('PETITION', recordId, key_);
      expect(book.opinions[0]).toMatchObject({ kind: 'CHECK', verdict: 'PASS', reportId: book.reports[0].id, reportRevision: 1 });
      expect(book.reports[0].answered).toBe(true);
      expect(flow.steps[0].status).toBe('REPORTED'); // a pass is not a decision: the leader still decides
    });

    it('a check that asks for rework sends a result waiting for the leader back to the unit', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      let flow = await get();
      flow = await results.submitReport(user.worker, 'PETITION', recordId, await key(), { expectedRevision: flow.revision, ...report({ kind: 'RESULT', doneWork: 'Verified' }) });
      flow = await results.addOpinion(user.checker, 'PETITION', recordId, await key(), { expectedRevision: flow.revision, kind: 'CHECK', verdict: 'REQUEST_REWORK', content: 'The dates do not match' });
      expect(flow.steps[0].status).toBe('OPEN');
      const returned = await scratch.db.procStepChange.findFirstOrThrow({ where: { recordId, action: 'STEP_RETURNED' } });
      expect(returned.reason).toBe('The dates do not match');
    });

    it('its author takes it back while nobody has spoken after it; a decision of the leader cannot be taken back', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      let flow = await get();
      const key_ = await key();
      flow = await results.addOpinion(user.head, 'PETITION', recordId, key_, { expectedRevision: flow.revision, kind: 'SUPERVISOR', verdict: 'NOTE', content: 'First' });
      flow = await results.addOpinion(user.coordinator, 'PETITION', recordId, key_, { expectedRevision: flow.revision, kind: 'COORDINATE', verdict: 'NOTE', content: 'Second' });
      const [first, second] = (await results.results('PETITION', recordId, key_)).opinions;
      expect(await failure(results.withdrawOpinion(user.head, 'PETITION', recordId, key_, first.id, { expectedRevision: flow.revision }))).toEqual({ status: 409, code: 'OPINION_ANSWERED' });
      expect(await failure(results.withdrawOpinion(user.head, 'PETITION', recordId, key_, second.id, { expectedRevision: flow.revision }))).toEqual({ status: 403, code: 'OPINION_NOT_YOURS' });
      flow = await results.withdrawOpinion(user.coordinator, 'PETITION', recordId, key_, second.id, { expectedRevision: flow.revision });
      flow = await results.withdrawOpinion(user.head, 'PETITION', recordId, key_, first.id, { expectedRevision: flow.revision });
      expect((await results.results('PETITION', recordId, key_)).opinions.every((o) => o.withdrawnAt !== null)).toBe(true);
      expect(flow.steps[0].latestOpinion).toBeNull();
    });
  });

  describe('a nudge in the book', () => {
    it('is never filed through the opinion route, by anybody: only the nudge command writes one', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      const flow = await get();
      const key_ = await key();
      for (const who of [user.head, user.coordinator, user.worker]) {
        expect(await failure(results.addOpinion(who, 'PETITION', recordId, key_, { expectedRevision: flow.revision, kind: 'NUDGE', verdict: 'NOTE', content: 'Hurry' }))).toEqual({ status: 400, code: 'OPINION_NOT_ALLOWED' });
      }
      expect((await results.results('PETITION', recordId, key_)).opinions).toEqual([]);
    });

    it('cannot be taken back by its author, and does not stop the author of an earlier opinion from taking theirs back', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      let flow = await get();
      const key_ = await key();
      flow = await results.addOpinion(user.head, 'PETITION', recordId, key_, { expectedRevision: flow.revision, kind: 'SUPERVISOR', verdict: 'NOTE', content: 'First' });
      // As the nudge command writes it: after the opinion, by the head themselves.
      const stepRow = await scratch.db.procRecordStep.findFirstOrThrow({ where: { recordId, stepKey: key_ } });
      const nudge = await scratch.db.procStepOpinion.create({ data: { recordStepId: stepRow.id, recordKind: 'PETITION', recordId, kind: 'NUDGE', verdict: 'NOTE', content: 'Hurry', authorId: user.head, createdAt: new Date(Date.now() + 60_000) } });
      expect(await failure(results.withdrawOpinion(user.head, 'PETITION', recordId, key_, nudge.id, { expectedRevision: flow.revision }))).toEqual({ status: 409, code: 'OPINION_NOT_ALLOWED' });
      const [first] = (await results.results('PETITION', recordId, key_)).opinions;
      await results.withdrawOpinion(user.head, 'PETITION', recordId, key_, first.id, { expectedRevision: flow.revision });
      expect((await results.results('PETITION', recordId, key_)).opinions.map((o) => [o.kind, o.withdrawnAt !== null])).toEqual([['SUPERVISOR', true], ['NUDGE', false]]);
    });
  });

  describe('the leader\'s decision', () => {
    const reportedResult = async (steps: unknown[] = [step()]) => {
      const base = await withFlow(steps);
      let flow = await base.get();
      flow = await results.submitReport(user.worker, 'PETITION', base.recordId, flow.steps[0].stepKey, { expectedRevision: flow.revision, ...report({ kind: 'RESULT', doneWork: 'Verified', proposalKind: 'SAVE_FILE' }) });
      return { ...base, flow, stepKey: flow.steps[0].stepKey };
    };

    it('agreeing finishes the step and starts the one counted from it; the decision names the report it was given on', async () => {
      const { recordId, flow, stepKey } = await reportedResult([step(), step({ anchor: 'PREVIOUS_STEP_DONE', requiresApproval: false })]);
      const after = await results.decide(user.approver, 'PETITION', recordId, stepKey, { expectedRevision: flow.revision, verdict: 'AGREE' });
      expect(after.steps[0]).toMatchObject({ status: 'DONE', completion: 'DONE_ON_TIME' });
      expect(after.steps[1].status).toBe('OPEN');
      const book = await results.results('PETITION', recordId, stepKey);
      expect(book.opinions[0]).toMatchObject({ kind: 'APPROVAL', verdict: 'AGREE', reportId: book.reports[0].id, reportRevision: 1, authorName: 'approver Tester' });
    });

    it('disagreeing, or giving another direction, needs a text and sends the step back to the unit', async () => {
      const { recordId, flow, stepKey } = await reportedResult();
      expect(await failure(results.decide(user.approver, 'PETITION', recordId, stepKey, { expectedRevision: flow.revision, verdict: 'DISAGREE' }))).toEqual({ status: 400, code: 'REPORT_TEXT_REQUIRED' });
      expect(await failure(results.decide(user.approver, 'PETITION', recordId, stepKey, { expectedRevision: flow.revision, verdict: 'MAYBE' }))).toEqual({ status: 400, code: 'VERDICT_INVALID' });
      const after = await results.decide(user.approver, 'PETITION', recordId, stepKey, { expectedRevision: flow.revision, verdict: 'OTHER_DIRECTION', content: 'Transfer it to the incident unit instead' });
      expect(after.steps[0].status).toBe('OPEN');
      expect((await scratch.db.procStepChange.findFirstOrThrow({ where: { recordId, action: 'STEP_RETURNED' } })).reason).toBe('Transfer it to the incident unit instead');
    });

    it('is refused when nothing waits for it, and a decision cannot be taken back', async () => {
      const open = await withFlow([step()]);
      const flow = await open.get();
      expect(await failure(results.decide(user.approver, 'PETITION', open.recordId, flow.steps[0].stepKey, { expectedRevision: flow.revision, verdict: 'AGREE' }))).toEqual({ status: 409, code: 'STEP_NOT_REPORTED' });

      const { recordId, flow: reported, stepKey } = await reportedResult();
      const after = await results.decide(user.approver, 'PETITION', recordId, stepKey, { expectedRevision: reported.revision, verdict: 'DISAGREE', content: 'No' });
      const [decision] = (await results.results('PETITION', recordId, stepKey)).opinions;
      expect(await failure(results.withdrawOpinion(user.approver, 'PETITION', recordId, stepKey, decision.id, { expectedRevision: after.revision }))).toEqual({ status: 409, code: 'OPINION_NOT_ALLOWED' });
    });

    it('after a disagreement the unit reports again, and the next decision is given on the new report', async () => {
      const { recordId, flow, stepKey } = await reportedResult();
      let state = await results.decide(user.approver, 'PETITION', recordId, stepKey, { expectedRevision: flow.revision, verdict: 'DISAGREE', content: 'The proposal is not supported' });
      state = await results.submitReport(user.worker, 'PETITION', recordId, stepKey, { expectedRevision: state.revision, ...report({ kind: 'RESULT', doneWork: 'Verified again, with the missing document' }) });
      expect(state.steps[0].status).toBe('REPORTED');
      state = await results.decide(user.approver, 'PETITION', recordId, stepKey, { expectedRevision: state.revision, verdict: 'AGREE' });
      expect(state.steps[0].status).toBe('DONE');
      const book = await results.results('PETITION', recordId, stepKey);
      const reports = book.reports.filter((r) => r.kind === 'RESULT');
      expect(reports).toHaveLength(2);
      const last = book.opinions.at(-1)!;
      expect(last).toMatchObject({ verdict: 'AGREE', reportId: reports[1].id });
    });
  });

  describe('what the person looking may do on a step by their role (viewer)', () => {
    it('says for each person what the write routes would answer: the working unit, its head, the checker, the coordinator, an outsider, the leader', async () => {
      const { recordId, key } = await withFlow([step()]);
      const viewerOf = async (who: string) => (await commands.get('PETITION', recordId, user[who])).steps[0].viewer;
      const parties = (await commands.get('PETITION', recordId)).steps[0].parties;
      const partyOf = (role: string) => parties.find((p) => p.role === role)!.id;

      expect(await viewerOf('worker')).toEqual({ canReport: true, opinionKinds: [], canApprove: false, canAssignByScope: false, memberOfPartyIds: [partyOf('MAIN')], leaderOfPartyIds: [] });
      expect(await viewerOf('head')).toEqual({ canReport: true, opinionKinds: ['SUPERVISOR'], canApprove: false, canAssignByScope: false, memberOfPartyIds: [partyOf('MAIN')], leaderOfPartyIds: [partyOf('MAIN')] });
      expect(await viewerOf('checker')).toEqual({ canReport: false, opinionKinds: ['CHECK'], canApprove: false, canAssignByScope: false, memberOfPartyIds: [partyOf('CHECK')], leaderOfPartyIds: [] });
      expect(await viewerOf('coordinator')).toEqual({ canReport: true, opinionKinds: ['COORDINATE'], canApprove: false, canAssignByScope: false, memberOfPartyIds: [partyOf('COORDINATE')], leaderOfPartyIds: [] });
      // A person with no part in the step: no report, no opinion. Nobody here holds `read:Petition`, so the record is in
      // nobody's own scope: no decision and no assignment by permission either (the scope side: processing-assignment spec).
      for (const who of ['outsider', 'admin', 'approver']) expect(await viewerOf(who)).toEqual({ canReport: false, opinionKinds: [], canApprove: false, canAssignByScope: false, memberOfPartyIds: [], leaderOfPartyIds: [] });

      // The answers are the ones the write routes give.
      const stepKey = await key();
      const { revision } = await commands.get('PETITION', recordId);
      expect(await failure(results.submitReport(user.outsider, 'PETITION', recordId, stepKey, { expectedRevision: revision, ...report() }))).toEqual({ status: 403, code: 'NOT_A_PARTY_OF_STEP' });
      expect(await failure(results.addOpinion(user.worker, 'PETITION', recordId, stepKey, { expectedRevision: revision, kind: 'SUPERVISOR', verdict: 'NOTE', content: 'x' }))).toEqual({ status: 403, code: 'OPINION_NOT_ALLOWED' });
    });

    it('an answer for nobody carries no viewer, and the answer of a write is the actor’s', async () => {
      const { recordId, get, key } = await withFlow([step()]);
      const before = await get();
      expect(before.steps[0]).not.toHaveProperty('viewer');
      const after = await results.submitReport(user.worker, 'PETITION', recordId, await key(), { expectedRevision: before.revision, ...report() });
      expect(after.steps[0].viewer).toMatchObject({ canReport: true, opinionKinds: [] });
    });

    it('a person only NAMED on a party reports but is not a member of it; a stopped unit gives nothing', async () => {
      const { recordId } = await withFlow([step()]);
      await scratch.db.procRecordStepParty.updateMany({ where: { recordStep: { recordId }, role: 'COORDINATE' }, data: { teamId: null, partyKind: 'RECORD_TEAM', assigneeUserId: user.outsider } });
      expect((await commands.get('PETITION', recordId, user.outsider)).steps[0].viewer).toEqual({ canReport: true, opinionKinds: ['COORDINATE'], canApprove: false, canAssignByScope: false, memberOfPartyIds: [], leaderOfPartyIds: [] });
      await scratch.db.team.update({ where: { id: team.A }, data: { status: 'INACTIVE' } });
      try {
        expect((await commands.get('PETITION', recordId, user.head)).steps[0].viewer).toEqual({ canReport: false, opinionKinds: [], canApprove: false, canAssignByScope: false, memberOfPartyIds: [], leaderOfPartyIds: [] });
      } finally {
        await scratch.db.team.update({ where: { id: team.A }, data: { status: 'ACTIVE' } });
      }
    });
  });
});
