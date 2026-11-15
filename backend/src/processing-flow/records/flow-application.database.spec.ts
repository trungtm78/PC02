import { HttpException } from '@nestjs/common';
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
import { FlowApplicationService } from './flow-application.service';

/**
 * Applying a flow to a record, on a REAL PostgreSQL: the flow found for the record, the version it is pinned to, the
 * steps with their stored deadlines, the units that work them, the history and audit rows, and the guarantees that a
 * second call (or two at once) changes nothing.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database. A default flow is one fact for the whole
 * database, so the suite takes its turn on it (`processing-flows`) and works on rows of its own, removed at the end.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

const PREFIX = 'pfa-test-';

run('FlowApplicationService on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let flows: ProcessingFlowsService;
  let applier: FlowApplicationService;
  const tag = `${PREFIX}${randomUUID().slice(0, 8)}`;
  let actor = '';
  let roleId = '';
  let unit = '';
  let otherUnit = '';
  let counter = 0;
  const records: Array<{ kind: RecordKind; id: string }> = [];
  const catalogue: Record<string, string> = {};
  const fresh = (what: string) => `${tag} ${what} ${++counter}`;

  const step = (over: Record<string, unknown> = {}) => ({
    name: 'Check',
    durationValue: 10,
    durationUnit: 'DAY',
    anchor: 'RECEIVED',
    redDays: 1,
    yellowDays: 2,
    greenDays: 3,
    legalBasis: 'Article 1',
    parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }],
    ...over,
  });

  /** A flow of `kind`, published, bound to the catalogue entries named (by key). */
  const publishedFlow = async (kind: RecordKind, steps: unknown[], bindTo: string[] = [], isDefault = false) => {
    const flow = await flows.create(actor, { name: fresh('flow'), recordKind: kind, isDefault });
    const saved = await flows.replaceSteps(flow.id, flow.draft!.id, actor, { steps, expectedRevision: flow.draft!.revision });
    const done = await flows.publish(flow.id, saved.flow.draft!.id, actor, saved.flow.draft!.revision);
    if (bindTo.length > 0) await flows.setBindings(done.id, actor, { directoryIds: bindTo.map((key) => catalogue[key]), deadlineGroups: [], expectedRevision: done.revision });
    return done;
  };

  const petition = async (over: Record<string, unknown> = {}) => {
    const row = await scratch.db.petition.create({
      data: {
        stt: fresh('p'),
        receivedDate: new Date('2026-12-01T00:00:00Z'),
        senderName: `${tag} sender`,
        loaiThongTin: `Tố cáo ${tag}`,
        enteredById: actor,
        assignedTeamId: unit,
        status: 'DANG_XU_LY',
        ...over,
      } as never,
    });
    records.push({ kind: 'PETITION', id: row.id });
    return row.id;
  };
  const aCase = async (over: Record<string, unknown> = {}) => {
    const row = await scratch.db.case.create({
      data: {
        name: fresh('case'),
        caseCode: fresh('c'),
        caseProvenance: 'DIRECT_DISCOVERY',
        investigatorId: actor,
        assignedTeamId: unit,
        status: 'DANG_DIEU_TRA',
        receiveDate: new Date('2026-12-01T00:00:00Z'),
        loaiThongTin: `Tố cáo ${tag}`,
        ...over,
      } as never,
    });
    records.push({ kind: 'CASE', id: row.id });
    return row.id;
  };

  const refusal = async (attempt: Promise<unknown>) => {
    try {
      await attempt;
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      return { status: error.getStatus(), code: (error.getResponse() as { code?: unknown }).code };
    }
    return 'RESOLVED' as const;
  };

  const dropRecordFlows = async () => {
    const { db } = scratch;
    const ids = records.map((record) => record.id);
    const flowIds = (await db.procRecordFlow.findMany({ where: { recordId: { in: ids } }, select: { id: true } })).map((row) => row.id);
    await db.auditLog.deleteMany({ where: { subject: 'ProcRecordFlow', subjectId: { in: flowIds } } });
    await db.procStepChange.deleteMany({ where: { recordId: { in: ids } } });
    await db.procRecordStepParty.deleteMany({ where: { recordStep: { recordId: { in: ids } } } });
    await db.procRecordStep.deleteMany({ where: { recordId: { in: ids } } });
    await db.procRecordFlow.deleteMany({ where: { recordId: { in: ids } } });
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
    otherUnit = (await db.team.create({ data: { name: `${tag} other unit`, code: `${tag}-O` } })).id;
    for (const [key, name] of [['denunciation', `Tố cáo ${tag}`], ['complaint', `Khiếu nại ${tag}`]] as const) {
      const row = await db.directory.create({ data: { type: LOAI_DANH_MUC_LOAI_THONG_TIN, code: `${tag}-${key}`, name } });
      catalogue[key] = row.id;
    }

    const prisma = db as never;
    const audit = new AuditService(prisma);
    const calendars = new WorkingCalendarService(prisma, audit);
    flows = new ProcessingFlowsService(prisma, audit, calendars);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    const gateway = new RecordGateway(new PetitionAdapter(prisma, scopes), new IncidentAdapter(prisma, scopes), new CaseAdapter(prisma, scopes));
    applier = new FlowApplicationService(prisma, gateway, calendars, audit);
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    await dropRecordFlows();
    await db.petition.deleteMany({ where: { id: { in: records.filter((r) => r.kind === 'PETITION').map((r) => r.id) } } });
    await db.case.deleteMany({ where: { id: { in: records.filter((r) => r.kind === 'CASE').map((r) => r.id) } } });
    await dropFlows();
    await db.directory.deleteMany({ where: { code: { startsWith: tag } } });
    await db.auditLog.deleteMany({ where: { userId: actor } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { id: actor } });
    await db.role.deleteMany({ where: { id: roleId } });
    await scratch.close();
  });

  describe('the flow bound to the information type of the record', () => {
    it('pins the published version, makes the steps with stored deadlines, resolves the unit holding the record, and writes the history and the audit', async () => {
      const flow = await publishedFlow('PETITION', [step({ name: 'Receive', durationValue: 5, rollToWorkingDay: false }), step({ name: 'Decide', anchor: 'PREVIOUS_STEP_DONE', durationValue: 20, parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }, { partyKind: 'TEAM', teamId: otherUnit, role: 'CHECK' }] })], ['denunciation']);
      const recordId = await petition();

      const outcome = await applier.apply({ kind: 'PETITION', recordId, reason: 'CREATED', actorId: null });
      expect(outcome).toMatchObject({ outcome: 'APPLIED', flowId: flow.id, match: 'TYPE', confirmed: true, steps: 2 });

      const stored = await scratch.db.procRecordFlow.findUniqueOrThrow({
        where: { recordKind_recordId: { recordKind: 'PETITION', recordId } },
        include: { steps: { orderBy: { order: 'asc' }, include: { parties: { orderBy: { order: 'asc' } } } } },
      });
      expect(stored).toMatchObject({ flowId: flow.id, versionId: flow.published!.id, match: 'TYPE', directoryId: catalogue.denunciation, confirmed: true, appliedById: null, revision: 1 });
      expect(stored.bindingId).not.toBeNull();

      const [first, second] = stored.steps;
      // 1 December 2026 + 5 days: the end of 6 December, Vietnam time. Both deadlines start equal.
      expect(first).toMatchObject({ status: 'OPEN', stepKey: flow.published!.steps[0].stepKey, order: 0, problem: null, deadlineRevision: 1 });
      expect(first.startAt?.toISOString()).toBe('2026-12-01T00:00:00.000Z');
      expect(first.regulatoryDueAt?.toISOString()).toBe('2026-12-06T16:59:59.999Z');
      expect(first.internalDueAt?.toISOString()).toBe('2026-12-06T16:59:59.999Z');
      expect(first.redFrom?.toISOString()).toBe('2026-12-04T17:00:00.000Z');
      // The step counted from the one before waits: no date, no deadline.
      expect(second).toMatchObject({ status: 'WAITING_ANCHOR', startAt: null, regulatoryDueAt: null, internalDueAt: null, redFrom: null });

      // "The unit holding the record" became that unit; a named unit stays itself.
      expect(first.parties).toMatchObject([{ partyKind: 'RECORD_TEAM', teamId: unit, role: 'MAIN', assigneeUserId: null }]);
      expect(second.parties).toMatchObject([
        { partyKind: 'RECORD_TEAM', teamId: unit, role: 'MAIN' },
        { partyKind: 'TEAM', teamId: otherUnit, role: 'CHECK' },
      ]);

      const history = await scratch.db.procStepChange.findMany({ where: { recordId } });
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({ action: 'FLOW_APPLIED', stepKey: null, actorId: null, recordFlowId: stored.id });
      const audit = await scratch.db.auditLog.findMany({ where: { subject: 'ProcRecordFlow', subjectId: stored.id } });
      expect(audit).toHaveLength(1);
      expect(audit[0].action).toBe('PROC_FLOW_APPLIED');
      expect(JSON.stringify(audit[0].metadata)).not.toContain('2026-12'); // metadata only: no deadline, no date
    });

    it('a second call for the same record changes nothing, and two at once make exactly one', async () => {
      await publishedFlow('PETITION', [step()], ['complaint']);
      const recordId = await petition({ loaiThongTin: `Khiếu nại ${tag}` });
      const results = await Promise.all([
        applier.apply({ kind: 'PETITION', recordId, reason: 'CREATED', actorId: null }),
        applier.apply({ kind: 'PETITION', recordId, reason: 'REAPPLY', actorId: actor }),
        applier.apply({ kind: 'PETITION', recordId, reason: 'CLI', actorId: null }),
      ]);
      expect(results.filter((r) => r.outcome === 'APPLIED')).toHaveLength(1);
      expect(results.filter((r) => r.outcome === 'ALREADY_APPLIED')).toHaveLength(2);
      expect(await scratch.db.procRecordFlow.count({ where: { recordId } })).toBe(1);
      expect(await scratch.db.procRecordStep.count({ where: { recordId } })).toBe(1);
      expect(await scratch.db.procStepChange.count({ where: { recordId } })).toBe(1);
    });

    it('a step counted from a date the record does not carry yet (acceptance) waits, and says nothing is wrong with it', async () => {
      await publishedFlow('CASE', [step({ name: 'Accept', anchor: 'ACCEPTED' })], ['denunciation']);
      const recordId = await aCase();
      await applier.apply({ kind: 'CASE', recordId, reason: 'CREATED', actorId: null });
      expect(await scratch.db.procRecordStep.findFirstOrThrow({ where: { recordId } })).toMatchObject({ status: 'WAITING_ANCHOR', problem: null, regulatoryDueAt: null });
    });

    it('a case takes the duration of the variant for the gravity of its crime', async () => {
      await publishedFlow(
        'CASE',
        [step({ name: 'Investigate', durationValue: 60, variants: [{ conditionKey: 'CRIME_GRAVITY', conditionValue: 'RAT_NGHIEM_TRONG', durationValue: 120, durationUnit: 'DAY' }] })],
        ['complaint'],
      );
      const plain = await aCase({ loaiThongTin: `Khiếu nại ${tag}` });
      const grave = await aCase({ loaiThongTin: `Khiếu nại ${tag}`, capDoToiPham: 'RAT_NGHIEM_TRONG' });
      await applier.apply({ kind: 'CASE', recordId: plain, reason: 'CREATED', actorId: null });
      await applier.apply({ kind: 'CASE', recordId: grave, reason: 'CREATED', actorId: null });
      const dueOf = async (recordId: string) => (await scratch.db.procRecordStep.findFirstOrThrow({ where: { recordId } })).regulatoryDueAt!.getTime();
      const graveStep = await scratch.db.procRecordStep.findFirstOrThrow({ where: { recordId: grave } });
      expect(graveStep.variant).toBe('RAT_NGHIEM_TRONG');
      expect(await dueOf(grave)).toBeGreaterThan(await dueOf(plain));
      expect((await scratch.db.procRecordFlow.findUniqueOrThrow({ where: { recordKind_recordId: { recordKind: 'CASE', recordId: grave } } })).conditions).toEqual({ CRIME_GRAVITY: 'RAT_NGHIEM_TRONG' });
    });

    it('a record with no unit yet leaves "the unit holding the record" empty', async () => {
      const recordId = await petition({ assignedTeamId: null });
      expect(await applier.apply({ kind: 'PETITION', recordId, reason: 'CREATED', actorId: null })).toMatchObject({ outcome: 'APPLIED' });
      const parties = await scratch.db.procRecordStepParty.findMany({ where: { recordStep: { recordId } } });
      const ofTheRecord = parties.filter((party) => party.partyKind === 'RECORD_TEAM');
      expect(ofTheRecord.length).toBeGreaterThan(0);
      expect(ofTheRecord.every((party) => party.teamId === null)).toBe(true);
      // A named unit is still that unit.
      expect(parties.filter((party) => party.partyKind === 'TEAM').every((party) => party.teamId === otherUnit)).toBe(true);
    });

    it('the steps stay on the version the record was pinned to when a later version is published', async () => {
      const flow = await publishedFlow('PETITION', [step({ name: 'Old step' })]);
      // Bind a catalogue entry of its own so only this flow answers for it.
      const entry = await scratch.db.directory.create({ data: { type: LOAI_DANH_MUC_LOAI_THONG_TIN, code: `${tag}-pin`, name: `Trình báo ${tag}` } });
      await flows.setBindings(flow.id, actor, { directoryIds: [entry.id], deadlineGroups: [], expectedRevision: flow.revision });
      const recordId = await petition({ loaiThongTin: `Trình báo ${tag}` });
      await applier.apply({ kind: 'PETITION', recordId, reason: 'CREATED', actorId: null });

      const current = await flows.get(flow.id);
      const draft = await flows.createDraft(flow.id, actor);
      await flows.replaceSteps(flow.id, draft.draft!.id, actor, { steps: [step({ name: 'New step', stepKey: current.published!.steps[0].stepKey })], expectedRevision: draft.draft!.revision });
      const latest = await flows.get(flow.id);
      await flows.publish(flow.id, latest.draft!.id, actor, latest.draft!.revision);

      const stored = await scratch.db.procRecordFlow.findUniqueOrThrow({
        where: { recordKind_recordId: { recordKind: 'PETITION', recordId } },
        include: { steps: { include: { step: true } } },
      });
      expect(stored.versionId).toBe(flow.published!.id);
      expect(stored.steps[0].step.name).toBe('Old step');
    });
  });

  describe('when there is nothing to apply', () => {
    it('a finished record gets no steps', async () => {
      await publishedFlow('PETITION', [step()], []);
      const recordId = await petition({ status: 'DA_GIAI_QUYET' });
      expect(await applier.apply({ kind: 'PETITION', recordId, reason: 'CREATED', actorId: null })).toEqual({ outcome: 'RECORD_FINISHED' });
      expect(await scratch.db.procRecordFlow.count({ where: { recordId } })).toBe(0);
    });

    it('a record that is gone is reported as gone', async () => {
      const recordId = await petition({ deletedAt: new Date() });
      expect(await applier.apply({ kind: 'PETITION', recordId, reason: 'CREATED', actorId: null })).toEqual({ outcome: 'RECORD_GONE' });
      expect(await applier.apply({ kind: 'PETITION', recordId: `${tag}-nothing`, reason: 'CREATED', actorId: null })).toEqual({ outcome: 'RECORD_GONE' });
    });

    it('a record whose kind has no flow bound and no default flow gets none', async () => {
      const recordId = await aCase({ loaiThongTin: `Không có quy trình ${tag}` });
      // No default flow of kind CASE exists in this suite.
      expect(await applier.apply({ kind: 'CASE', recordId, reason: 'CREATED', actorId: null })).toEqual({ outcome: 'NO_FLOW' });
    });
  });

  describe('a person chooses the flow', () => {
    it('is used whatever the information type says, and is recorded as MANUAL', async () => {
      const flow = await publishedFlow('PETITION', [step({ name: 'Chosen' })]);
      const recordId = await petition({ loaiThongTin: `Một loại chưa ai nghe ${tag}` });
      const outcome = await applier.apply({ kind: 'PETITION', recordId, reason: 'REAPPLY', actorId: actor, flowId: flow.id });
      expect(outcome).toMatchObject({ outcome: 'APPLIED', flowId: flow.id, match: 'MANUAL', confirmed: true });
      expect((await scratch.db.procRecordFlow.findUniqueOrThrow({ where: { recordKind_recordId: { recordKind: 'PETITION', recordId } } })).appliedById).toBe(actor);
    });

    it('a flow of another kind, or one that does not exist, is refused', async () => {
      const caseFlow = await publishedFlow('CASE', [step()]);
      const recordId = await petition();
      expect(await refusal(applier.apply({ kind: 'PETITION', recordId, reason: 'REAPPLY', actorId: actor, flowId: caseFlow.id }))).toEqual({ status: 400, code: 'FLOW_NOT_FOUND' });
      expect(await refusal(applier.apply({ kind: 'PETITION', recordId, reason: 'REAPPLY', actorId: actor, flowId: 'nope' }))).toEqual({ status: 400, code: 'FLOW_NOT_FOUND' });
      expect(await scratch.db.procRecordFlow.count({ where: { recordId } })).toBe(0);
    });
  });

  describe('an information type nobody can recognise', () => {
    it('gets the default flow only as a PROPOSAL: not confirmed, matched as UNKNOWN_TYPE', async () => {
      const fallback = await publishedFlow('PETITION', [step({ name: 'Default step' })], [], true);
      const recordId = await petition({ loaiThongTin: 'Văn bản lạ; trộn nhiều thứ' });
      const outcome = await applier.apply({ kind: 'PETITION', recordId, reason: 'CREATED', actorId: null });
      expect(outcome).toMatchObject({ outcome: 'APPLIED', flowId: fallback.id, match: 'UNKNOWN_TYPE', confirmed: false });
      expect(await scratch.db.procRecordFlow.findUniqueOrThrow({ where: { recordKind_recordId: { recordKind: 'PETITION', recordId } } })).toMatchObject({ confirmed: false, match: 'UNKNOWN_TYPE', typeKey: expect.any(String) });
    });

    it('a known type nothing is bound to gets the default flow as a flow (confirmed)', async () => {
      const entry = await scratch.db.directory.create({ data: { type: LOAI_DANH_MUC_LOAI_THONG_TIN, code: `${tag}-plain`, name: `Đề xuất ${tag}` } });
      const recordId = await petition({ loaiThongTin: entry.name });
      const outcome = await applier.apply({ kind: 'PETITION', recordId, reason: 'CREATED', actorId: null });
      expect(outcome).toMatchObject({ outcome: 'APPLIED', match: 'DEFAULT', confirmed: true });
    });
  });
});
