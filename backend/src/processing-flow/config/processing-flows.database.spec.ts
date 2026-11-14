import { HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { openScratchDatabase, type ScratchDatabase } from '../../common/testing/scratch-database';
import { takeTurnOnSharedRow } from '../../common/testing/shared-row-turn';
import { LOAI_DANH_MUC_LOAI_THONG_TIN } from '../../common/utils/khoa-loai-thong-tin.util';
import { WorkingCalendarService } from '../calendar/working-calendar.service';
import { ProcessingFlowsService, type FlowDetailDto } from './processing-flows.service';

/**
 * The flow configuration on a REAL PostgreSQL: flows, their bindings, versions and steps; one default flow and one
 * name per record kind; a published version that never changes; the order children are deleted in; the audit rows.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database. "One default flow per record kind" is one fact
 * for the whole database, so the suite takes its turn on it (`processing-flows`) and works on rows of its own: flows
 * named after its tag, catalogue entries and teams of its own. Everything is removed at the end.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

// In CI a missing database is a failure, not a suite silently skipped.
if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

/** Flows of an earlier run that was killed carry this prefix too. */
const PREFIX = 'pfc-test-';

run('ProcessingFlowsService on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let flows: ProcessingFlowsService;
  const tag = `${PREFIX}${randomUUID().slice(0, 8)}`;
  let actor = '';
  let other = '';
  let roleId = '';
  let teamA = '';
  let teamB = '';
  let teamPaused = '';
  /** Catalogue entries of the suite: [denunciation-like, complaint-like, a third one]. */
  let types: Array<{ id: string; name: string }> = [];
  let otherDirectory = '';
  let counter = 0;
  const fresh = (what = 'flow') => `${tag} ${what} ${++counter}`;

  type Refusal = { status: number; code: unknown; details?: unknown };
  const refusal = async (attempt: Promise<unknown>): Promise<Refusal | 'RESOLVED'> => {
    try {
      await attempt;
    } catch (error) {
      if (!(error instanceof HttpException)) throw error;
      const body = error.getResponse() as { code?: unknown; details?: unknown };
      return { status: error.getStatus(), code: body.code, ...(body.details === undefined ? {} : { details: body.details }) };
    }
    return 'RESOLVED';
  };
  const codeOf = async (attempt: Promise<unknown>) => {
    const result = await refusal(attempt);
    return result === 'RESOLVED' ? result : `${result.status} ${String(result.code)}`;
  };

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

  const make = (recordKind: 'PETITION' | 'INCIDENT' | 'CASE' = 'PETITION', over: Record<string, unknown> = {}) =>
    flows.create(actor, { name: fresh(), recordKind, ...over });

  /** A flow whose first version is published with the steps given. */
  const published = async (recordKind: 'PETITION' | 'INCIDENT' | 'CASE' = 'PETITION', steps: unknown[] = [step()]): Promise<FlowDetailDto> => {
    const flow = await make(recordKind);
    const saved = await flows.replaceSteps(flow.id, flow.draft!.id, actor, { steps, expectedRevision: flow.draft!.revision });
    return flows.publish(flow.id, saved.flow.draft!.id, actor, saved.flow.draft!.revision);
  };

  const dropFlows = async (nameStartsWith: string): Promise<void> => {
    const { db } = scratch;
    const flow = { name: { startsWith: nameStartsWith } };
    await db.procFlowStepVariant.deleteMany({ where: { step: { version: { flow } } } });
    await db.procFlowStepParty.deleteMany({ where: { step: { version: { flow } } } });
    await db.procFlowStep.deleteMany({ where: { version: { flow } } });
    await db.procFlowVersion.deleteMany({ where: { flow } });
    await db.procFlowBinding.deleteMany({ where: { flow } });
    await db.procFlow.deleteMany({ where: flow });
  };

  /** The audit rows about one flow, oldest first. */
  const auditOf = async (flowId: string) => {
    const rows = await scratch.db.auditLog.findMany({
      where: { userId: { in: [actor, other] }, OR: [{ subjectId: flowId }, { metadata: { path: ['flowId'], equals: flowId } }] },
      orderBy: { createdAt: 'asc' },
    });
    return rows;
  };

  beforeAll(async () => {
    scratch = await openScratchDatabase(url as string);
    const { db } = scratch;
    await takeTurnOnSharedRow(scratch.pg, 'processing-flows');
    await dropFlows(PREFIX);
    // The suite creates default flows: a default flow of somebody else would make every such test fail for a reason
    // that has nothing to do with the code. Said here, once, instead of thirty red tests.
    const foreign = await db.procFlow.findMany({ where: { isDefault: true, status: 'ACTIVE' }, select: { name: true, recordKind: true } });
    if (foreign.length > 0) throw new Error(`The scratch database already holds default flows: ${JSON.stringify(foreign)}`);

    const role = await db.role.create({ data: { name: `${tag}-role` } });
    roleId = role.id;
    actor = (await db.user.create({ data: { username: `${tag}-actor`, passwordHash: 'x', roleId, isActive: true } })).id;
    other = (await db.user.create({ data: { username: `${tag}-other`, passwordHash: 'x', roleId, isActive: true } })).id;
    teamA = (await db.team.create({ data: { name: `${tag} team A`, code: `${tag}-A` } })).id;
    teamB = (await db.team.create({ data: { name: `${tag} team B`, code: `${tag}-B` } })).id;
    teamPaused = (await db.team.create({ data: { name: `${tag} team paused`, code: `${tag}-P`, status: 'INACTIVE' } })).id;
    types = [];
    for (const [index, name] of [`Tố cáo ${tag}`, `Khiếu nại ${tag}`, `Trình báo ${tag}`].entries()) {
      const row = await db.directory.create({ data: { type: LOAI_DANH_MUC_LOAI_THONG_TIN, code: `${tag}-${index}`, name } });
      types.push({ id: row.id, name });
    }
    otherDirectory = (await db.directory.create({ data: { type: `${tag}-OTHER`, code: `${tag}-x`, name: `${tag} not a type` } })).id;

    const audit = new AuditService(db as never);
    flows = new ProcessingFlowsService(db as never, audit, new WorkingCalendarService(db as never, audit));
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    await dropFlows(PREFIX);
    await db.directory.deleteMany({ where: { code: { startsWith: tag } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.auditLog.deleteMany({ where: { userId: { in: [actor, other] } } });
    await db.user.deleteMany({ where: { id: { in: [actor, other] } } });
    await db.role.deleteMany({ where: { id: roleId } });
    await scratch.close();
  });

  describe('creating', () => {
    it('a flow starts with an empty draft, version 1, and is in use', async () => {
      const name = fresh();
      const flow = await flows.create(actor, { name: `  ${name}  `, recordKind: 'INCIDENT', description: '  what it is for ' });

      expect(flow).toMatchObject({
        name,
        recordKind: 'INCIDENT',
        description: 'what it is for',
        isDefault: false,
        status: 'ACTIVE',
        revision: 1,
        archivedAt: null,
        boundTypes: [],
        boundGroups: [],
        stepCount: 0,
        publishedVersionNo: null,
        draftVersionNo: 1,
        published: null,
      });
      expect(flow.draft).toMatchObject({ versionNo: 1, status: 'DRAFT', revision: 1, steps: [] });
      expect(await scratch.db.procFlow.findUniqueOrThrow({ where: { id: flow.id } })).toMatchObject({ createdById: actor, updatedById: actor });
    });

    it('refuses a flow without a name, and an unknown record kind', async () => {
      expect(await codeOf(flows.create(actor, { name: '   ', recordKind: 'PETITION' }))).toBe('400 FLOW_NAME_REQUIRED');
      expect(await codeOf(flows.create(actor, { name: fresh(), recordKind: 'LETTER' as never }))).toBe('400 RECORD_KIND_INVALID');
    });

    it('a name is used once per record kind among the flows in use; another kind may use it too', async () => {
      const first = await make('PETITION');
      expect(await codeOf(flows.create(actor, { name: first.name, recordKind: 'PETITION' }))).toBe('409 FLOW_NAME_TAKEN');
      expect(await codeOf(flows.create(actor, { name: first.name, recordKind: 'CASE' }))).toBe('RESOLVED');
    });

    it('two people creating the same name at the same moment: exactly one flow', async () => {
      const name = fresh();
      const results = await Promise.allSettled(Array.from({ length: 4 }, () => flows.create(actor, { name, recordKind: 'CASE' })));
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await scratch.db.procFlow.count({ where: { name } })).toBe(1);
    });

    it('from a legal template: its steps in a draft, each with its legal basis and none verified', async () => {
      const flow = await flows.create(actor, { name: fresh(), recordKind: 'CASE', templateKey: 'CASE_INVESTIGATION' });

      expect(flow.draft?.steps).toHaveLength(1);
      const [investigation] = flow.draft!.steps;
      expect(investigation).toMatchObject({
        order: 0,
        name: 'Điều tra',
        durationValue: 2,
        durationUnit: 'MONTH',
        anchor: 'PROSECUTED',
        setsRecordDeadline: true,
        requiresApproval: true,
        legalBasis: 'Điều 172 BLTTHS 2015',
        legalVerifiedAt: null,
        legalVerifiedById: null,
      });
      expect(investigation.stepKey).toEqual(expect.any(String));
      expect(investigation.parties).toEqual([{ partyKind: 'RECORD_TEAM', teamId: null, teamName: null, teamStatus: null, role: 'MAIN', note: null }]);
      expect(investigation.variants.map((v) => `${v.conditionValue}:${v.durationValue}${v.durationUnit}`)).toEqual([
        'IT_NGHIEM_TRONG:2MONTH',
        'NGHIEM_TRONG:3MONTH',
        'RAT_NGHIEM_TRONG:4MONTH',
        'DAC_BIET_NGHIEM_TRONG:4MONTH',
      ]);
      expect(flow.published).toBeNull();
    });

    it('refuses a template that does not exist, or one of another record kind', async () => {
      expect(await codeOf(flows.create(actor, { name: fresh(), recordKind: 'CASE', templateKey: 'NOPE' }))).toBe('400 TEMPLATE_UNKNOWN');
      expect(await codeOf(flows.create(actor, { name: fresh(), recordKind: 'PETITION', templateKey: 'CASE_INVESTIGATION' }))).toBe('400 SOURCE_KIND_MISMATCH');
    });

    it('as a copy: the steps of the latest version of the source, under NEW step keys, none verified', async () => {
      const source = await published('PETITION', [step({ name: 'One' }), step({ name: 'Two', anchor: 'PREVIOUS_STEP_DONE', parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }, { partyKind: 'TEAM', teamId: teamA, role: 'CHECK', note: 'look' }] })]);
      const sourceKeys = source.published!.steps.map((s) => s.stepKey);
      await flows.verifyLegal(source.id, source.published!.id, sourceKeys[0], actor);

      const copy = await flows.create(other, { name: fresh(), recordKind: 'PETITION', copyFromFlowId: source.id });

      expect(copy.draft?.steps.map((s) => s.name)).toEqual(['One', 'Two']);
      const copyKeys = copy.draft!.steps.map((s) => s.stepKey);
      expect(copyKeys.filter((key) => sourceKeys.includes(key))).toEqual([]);
      expect(copy.draft!.steps.map((s) => s.legalVerifiedAt)).toEqual([null, null]);
      expect(copy.draft!.steps[1].parties).toEqual([
        { partyKind: 'RECORD_TEAM', teamId: null, teamName: null, teamStatus: null, role: 'MAIN', note: null },
        { partyKind: 'TEAM', teamId: teamA, teamName: `${tag} team A`, teamStatus: 'ACTIVE', role: 'CHECK', note: 'look' },
      ]);
      // The source is untouched.
      expect((await flows.get(source.id)).published!.steps.map((s) => s.stepKey)).toEqual(sourceKeys);
    });

    it('refuses a copy of nothing, of another record kind, and a copy and a template at once', async () => {
      const source = await make('PETITION');
      expect(await codeOf(flows.create(actor, { name: fresh(), recordKind: 'PETITION', copyFromFlowId: 'no-such-flow' }))).toBe('404 FLOW_SOURCE_NOT_FOUND');
      expect(await codeOf(flows.create(actor, { name: fresh(), recordKind: 'CASE', copyFromFlowId: source.id }))).toBe('400 SOURCE_KIND_MISMATCH');
      expect(
        await codeOf(flows.create(actor, { name: fresh(), recordKind: 'PETITION', copyFromFlowId: source.id, templateKey: 'PETITION_COMPLAINT' })),
      ).toBe('400 FLOW_SOURCE_AMBIGUOUS');
    });
  });

  describe('the default flow of a record kind', () => {
    it('there is one: a second default of the same kind is refused, on create and on edit, naming the one that is', async () => {
      const first = await make('INCIDENT', { isDefault: true });
      expect(first.isDefault).toBe(true);

      expect(await refusal(flows.create(actor, { name: fresh(), recordKind: 'INCIDENT', isDefault: true }))).toEqual({
        status: 409,
        code: 'DEFAULT_FLOW_EXISTS',
        details: { flowId: first.id, name: first.name },
      });
      const plain = await make('INCIDENT');
      expect(await codeOf(flows.update(plain.id, actor, { isDefault: true, expectedRevision: plain.revision }))).toBe('409 DEFAULT_FLOW_EXISTS');

      // Handing the mark over: take it off one, put it on the other.
      const cleared = await flows.update(first.id, actor, { isDefault: false, expectedRevision: first.revision });
      expect(cleared.isDefault).toBe(false);
      expect((await flows.update(plain.id, actor, { isDefault: true, expectedRevision: plain.revision })).isDefault).toBe(true);
      await flows.update(plain.id, actor, { isDefault: false, expectedRevision: plain.revision + 1 });
    });

    it('another record kind has its own default', async () => {
      const petition = await make('PETITION', { isDefault: true });
      const caseFlow = await make('CASE', { isDefault: true });
      expect([petition.isDefault, caseFlow.isDefault]).toEqual([true, true]);
      await flows.archive(petition.id, actor, petition.revision);
      await flows.archive(caseFlow.id, actor, caseFlow.revision);
    });

    it('two people creating a default flow of the same kind at the same moment: exactly one', async () => {
      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () => flows.create(actor, { name: fresh('default'), recordKind: 'CASE', isDefault: true })),
      );
      const created = results.filter((r): r is PromiseFulfilledResult<FlowDetailDto> => r.status === 'fulfilled');
      expect(created).toHaveLength(1);
      const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(refused.map((r) => (r.reason as { response?: { code?: string } }).response?.code)).toEqual([
        'DEFAULT_FLOW_EXISTS', 'DEFAULT_FLOW_EXISTS', 'DEFAULT_FLOW_EXISTS',
      ]);
      expect(await scratch.db.procFlow.count({ where: { recordKind: 'CASE', isDefault: true, status: 'ACTIVE' } })).toBe(1);
      await flows.archive(created[0].value.id, actor, created[0].value.revision);
    });
  });

  describe('editing', () => {
    it('changes what is sent and leaves the rest; the revision moves on and the editor is recorded', async () => {
      const flow = await flows.create(actor, { name: fresh(), recordKind: 'PETITION', description: 'before' });
      const renamed = fresh();

      const updated = await flows.update(flow.id, other, { name: renamed, expectedRevision: 1 });
      expect(updated).toMatchObject({ name: renamed, description: 'before', revision: 2 });
      expect(await scratch.db.procFlow.findUniqueOrThrow({ where: { id: flow.id } })).toMatchObject({ createdById: actor, updatedById: other });

      const cleared = await flows.update(flow.id, other, { description: null, expectedRevision: 2 });
      expect(cleared).toMatchObject({ name: renamed, description: null, revision: 3 });
    });

    it('refuses an edit made from an older revision, a name in use, an empty name, and a flow that does not exist', async () => {
      const flow = await make();
      const taken = await make();
      await flows.update(flow.id, actor, { description: 'x', expectedRevision: 1 });

      expect(await codeOf(flows.update(flow.id, actor, { description: 'y', expectedRevision: 1 }))).toBe('409 REVISION_CONFLICT');
      expect(await codeOf(flows.update(flow.id, actor, { name: taken.name, expectedRevision: 2 }))).toBe('409 FLOW_NAME_TAKEN');
      expect(await codeOf(flows.update(flow.id, actor, { name: '  ', expectedRevision: 2 }))).toBe('400 FLOW_NAME_REQUIRED');
      expect(await codeOf(flows.update('no-such-flow', actor, { name: 'x', expectedRevision: 1 }))).toBe('404 FLOW_NOT_FOUND');
      expect((await flows.get(flow.id)).revision).toBe(2);
    });

    it('an archived flow is not edited', async () => {
      const flow = await make();
      const archived = await flows.archive(flow.id, actor, flow.revision);
      expect(await codeOf(flows.update(flow.id, actor, { description: 'x', expectedRevision: archived.revision }))).toBe('409 FLOW_ARCHIVED');
    });
  });

  describe('bindings', () => {
    it('replace all: what is sent is what the flow is bound to afterwards', async () => {
      const flow = await make('PETITION');

      const bound = await flows.setBindings(flow.id, actor, { directoryIds: [types[0].id, types[1].id], deadlineGroups: ['KIEN_NGHI'], expectedRevision: 1 });
      expect(bound.revision).toBe(2);
      expect(bound.boundTypes.map((t) => t.name).sort()).toEqual([types[0].name, types[1].name].sort());
      expect(bound.boundTypes.every((t) => t.typeKey === t.currentTypeKey && !t.renamed)).toBe(true);
      expect(bound.boundGroups).toEqual(['KIEN_NGHI']);

      const replaced = await flows.setBindings(flow.id, actor, { directoryIds: [types[1].id, types[2].id], deadlineGroups: [], expectedRevision: 2 });
      expect(replaced.boundTypes.map((t) => t.name).sort()).toEqual([types[1].name, types[2].name].sort());
      expect(replaced.boundGroups).toEqual([]);
      const rows = await scratch.db.procFlowBinding.findMany({ where: { flowId: flow.id } });
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.recordKind === 'PETITION' && row.deadlineGroup === null && row.typeKey)).toBe(true);

      await flows.setBindings(flow.id, actor, { directoryIds: [], deadlineGroups: [], expectedRevision: 3 });
      expect(await scratch.db.procFlowBinding.count({ where: { flowId: flow.id } })).toBe(0);
    });

    it('a binding that stays keeps the key it was made with: a later rename of the entry is visible', async () => {
      const entry = await scratch.db.directory.create({ data: { type: LOAI_DANH_MUC_LOAI_THONG_TIN, code: `${tag}-rename`, name: `Phản ánh ${tag}` } });
      const flow = await make('PETITION');
      const bound = await flows.setBindings(flow.id, actor, { directoryIds: [entry.id], deadlineGroups: [], expectedRevision: 1 });
      const keyThen = bound.boundTypes[0].typeKey;

      await scratch.db.directory.update({ where: { id: entry.id }, data: { name: `Phản ánh mới ${tag}` } });
      const again = await flows.setBindings(flow.id, actor, { directoryIds: [entry.id, types[2].id], deadlineGroups: [], expectedRevision: 2 });

      const kept = again.boundTypes.find((t) => t.directoryId === entry.id);
      expect(kept).toMatchObject({ name: `Phản ánh mới ${tag}`, typeKey: keyThen, renamed: true });
      expect(kept?.currentTypeKey).not.toBe(keyThen);
      await flows.setBindings(flow.id, actor, { directoryIds: [], deadlineGroups: [], expectedRevision: 3 });
    });

    it('refuses an entry that is not an information type, a group for a kind that has none, and an unknown group', async () => {
      const petition = await make('PETITION');
      const incident = await make('INCIDENT');

      expect(await refusal(flows.setBindings(petition.id, actor, { directoryIds: [types[0].id, 'no-such-entry', otherDirectory], deadlineGroups: [], expectedRevision: 1 }))).toEqual({
        status: 400,
        code: 'TYPE_UNKNOWN',
        details: ['no-such-entry', otherDirectory],
      });
      expect(await codeOf(flows.setBindings(incident.id, actor, { directoryIds: [], deadlineGroups: ['TO_CAO'], expectedRevision: 1 }))).toBe('400 GROUP_NOT_FOR_KIND');
      expect(await codeOf(flows.setBindings(petition.id, actor, { directoryIds: [], deadlineGroups: ['WHATEVER'], expectedRevision: 1 }))).toBe('400 GROUP_UNKNOWN');
      expect(await scratch.db.procFlowBinding.count({ where: { flowId: { in: [petition.id, incident.id] } } })).toBe(0);
    });

    it('a type and a group belong to one flow per record kind: the refusal names the flow that holds them', async () => {
      const holder = await make('PETITION');
      await flows.setBindings(holder.id, actor, { directoryIds: [types[0].id], deadlineGroups: ['TO_CAO'], expectedRevision: 1 });
      const second = await make('PETITION');

      expect(await refusal(flows.setBindings(second.id, actor, { directoryIds: [types[0].id, types[1].id], deadlineGroups: ['TO_CAO'], expectedRevision: 1 }))).toEqual({
        status: 409,
        code: 'TYPE_ALREADY_BOUND',
        details: [
          { directoryId: types[0].id, flowId: holder.id, flowName: holder.name },
          { deadlineGroup: 'TO_CAO', flowId: holder.id, flowName: holder.name },
        ],
      });
      expect(await scratch.db.procFlowBinding.count({ where: { flowId: second.id } })).toBe(0);

      // The same type for another record kind is another matter.
      const incident = await make('INCIDENT');
      expect((await flows.setBindings(incident.id, actor, { directoryIds: [types[0].id], deadlineGroups: [], expectedRevision: 1 })).boundTypes).toHaveLength(1);

      await flows.setBindings(holder.id, actor, { directoryIds: [], deadlineGroups: [], expectedRevision: 2 });
      await flows.setBindings(incident.id, actor, { directoryIds: [], deadlineGroups: [], expectedRevision: 2 });
    });

    it('two flows taking the same type at the same moment: exactly one holds it', async () => {
      const [a, b] = [await make('CASE'), await make('CASE')];
      const results = await Promise.allSettled([
        flows.setBindings(a.id, actor, { directoryIds: [types[2].id], deadlineGroups: [], expectedRevision: 1 }),
        flows.setBindings(b.id, actor, { directoryIds: [types[2].id], deadlineGroups: [], expectedRevision: 1 }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await scratch.db.procFlowBinding.count({ where: { recordKind: 'CASE', directoryId: types[2].id } })).toBe(1);
      await scratch.db.procFlowBinding.deleteMany({ where: { flowId: { in: [a.id, b.id] } } });
    });

    it('refuses bindings decided on an older revision, and on an archived flow', async () => {
      const flow = await make('PETITION');
      await flows.update(flow.id, actor, { description: 'x', expectedRevision: 1 });
      expect(await codeOf(flows.setBindings(flow.id, actor, { directoryIds: [], deadlineGroups: [], expectedRevision: 1 }))).toBe('409 REVISION_CONFLICT');
      const archived = await flows.archive(flow.id, actor, 2);
      expect(await codeOf(flows.setBindings(flow.id, actor, { directoryIds: [], deadlineGroups: [], expectedRevision: archived.revision }))).toBe('409 FLOW_ARCHIVED');
    });
  });

  describe('the steps of a draft', () => {
    it('replace all: the order is the order sent; a step sent with its key keeps it, one without gets a new key', async () => {
      const flow = await make('PETITION');
      const draftId = flow.draft!.id;

      const first = await flows.replaceSteps(flow.id, draftId, actor, {
        steps: [
          step({ name: 'Receive' }),
          step({
            name: 'Settle',
            anchor: 'PREVIOUS_STEP_DONE',
            setsRecordDeadline: true,
            maxExtensions: 1,
            extensionValue: 30,
            extensionUnit: 'DAY',
            escalateAfterDays: 2,
            escalateLeadershipAfterDays: 5,
            parties: [
              { partyKind: 'RECORD_TEAM', role: 'MAIN' },
              { partyKind: 'TEAM', teamId: teamA, role: 'CHECK' },
              { partyKind: 'TEAM', teamId: teamB, role: 'INFORM', note: 'for information' },
            ],
          }),
        ],
        expectedRevision: 1,
      });
      expect(first.warnings).toEqual([]);
      expect(first.flow.draft).toMatchObject({ revision: 2 });
      const [receive, settle] = first.flow.draft!.steps;
      expect([receive.order, receive.name, settle.order, settle.name]).toEqual([0, 'Receive', 1, 'Settle']);
      expect(settle).toMatchObject({ setsRecordDeadline: true, maxExtensions: 1, extensionValue: 30, extensionUnit: 'DAY', escalateAfterDays: 2, escalateLeadershipAfterDays: 5 });
      expect(settle.parties.map((p) => [p.partyKind, p.teamId, p.role, p.note])).toEqual([
        ['RECORD_TEAM', null, 'MAIN', null],
        ['TEAM', teamA, 'CHECK', null],
        ['TEAM', teamB, 'INFORM', 'for information'],
      ]);
      expect(receive.stepKey).not.toBe(settle.stepKey);

      // Swap them, rename one, add a third.
      const second = await flows.replaceSteps(flow.id, draftId, actor, {
        steps: [
          step({ stepKey: settle.stepKey, name: 'Settle it', anchor: 'RECEIVED' }),
          step({ stepKey: receive.stepKey, name: 'Receive', anchor: 'PREVIOUS_STEP_DONE' }),
          step({ name: 'Archive', anchor: 'PREVIOUS_STEP_DONE' }),
        ],
        expectedRevision: 2,
      });
      const after = second.flow.draft!.steps;
      expect(after.map((s) => [s.order, s.name])).toEqual([[0, 'Settle it'], [1, 'Receive'], [2, 'Archive']]);
      expect(after[0].stepKey).toBe(settle.stepKey);
      expect(after[1].stepKey).toBe(receive.stepKey);
      expect([receive.stepKey, settle.stepKey]).not.toContain(after[2].stepKey);
      // What the second save did not send is gone: the parties of "Settle" were replaced with the one sent.
      expect(after[0].parties).toHaveLength(1);
      expect(await scratch.db.procFlowStepParty.count({ where: { step: { versionId: draftId } } })).toBe(3);
      expect(second.flow.stepCount).toBe(3);
    });

    it('a draft that breaks a rule of a flow is saved, and told what stops it from being published', async () => {
      const flow = await make('PETITION');
      const saved = await flows.replaceSteps(flow.id, flow.draft!.id, actor, {
        steps: [step({ name: '', anchor: 'PREVIOUS_STEP_DONE', parties: [] }), step({ redDays: 9, durationUnit: 'HOUR', anchor: 'PROPOSED' })],
        expectedRevision: 1,
      });
      expect(saved.flow.draft?.steps).toHaveLength(2);
      const keys = saved.flow.draft!.steps.map((s) => s.stepKey);
      expect(saved.warnings).toEqual([
        { code: 'STEP_NAME_REQUIRED', stepIndex: 0, stepKey: keys[0] },
        { code: 'STEP_NEEDS_ONE_MAIN', stepIndex: 0, stepKey: keys[0] },
        { code: 'PREVIOUS_STEP_ANCHOR_ON_FIRST_STEP', stepIndex: 0, stepKey: keys[0] },
        { code: 'THRESHOLDS_NOT_ASCENDING', stepIndex: 1, stepKey: keys[1] },
        { code: 'HOUR_ANCHOR_HAS_NO_TIME', stepIndex: 1, stepKey: keys[1] },
      ]);
    });

    it('refuses what cannot be stored at all: a shape that is not steps, a unit that does not exist, a key of another flow', async () => {
      const flow = await make('PETITION');
      const draftId = flow.draft!.id;
      const elsewhere = await make('PETITION');
      const foreign = await flows.replaceSteps(elsewhere.id, elsewhere.draft!.id, actor, { steps: [step()], expectedRevision: 1 });

      expect(await refusal(flows.replaceSteps(flow.id, draftId, actor, { steps: [step({ durationUnit: 'WEEK' })], expectedRevision: 1 }))).toEqual({
        status: 400,
        code: 'STEPS_INVALID',
        details: [{ stepIndex: 0, field: 'durationUnit' }],
      });
      expect(
        await refusal(
          flows.replaceSteps(flow.id, draftId, actor, {
            steps: [step({ parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }, { partyKind: 'TEAM', teamId: 'no-such-team', role: 'CHECK' }] })],
            expectedRevision: 1,
          }),
        ),
      ).toEqual({ status: 400, code: 'TEAM_UNKNOWN', details: ['no-such-team'] });
      expect(
        await refusal(flows.replaceSteps(flow.id, draftId, actor, { steps: [step({ stepKey: foreign.flow.draft!.steps[0].stepKey })], expectedRevision: 1 })),
      ).toEqual({ status: 400, code: 'STEP_KEY_UNKNOWN', details: [foreign.flow.draft!.steps[0].stepKey] });

      expect((await flows.get(flow.id)).draft).toMatchObject({ revision: 1, steps: [] });
    });

    it('refuses steps saved from an older revision of the version, and a version of another flow', async () => {
      const flow = await make('PETITION');
      const elsewhere = await make('PETITION');
      await flows.replaceSteps(flow.id, flow.draft!.id, actor, { steps: [step()], expectedRevision: 1 });

      expect(await codeOf(flows.replaceSteps(flow.id, flow.draft!.id, other, { steps: [], expectedRevision: 1 }))).toBe('409 REVISION_CONFLICT');
      expect(await codeOf(flows.replaceSteps(flow.id, elsewhere.draft!.id, actor, { steps: [], expectedRevision: 1 }))).toBe('404 FLOW_VERSION_NOT_FOUND');
      expect((await flows.get(flow.id)).draft?.steps).toHaveLength(1);
    });

    it('a draft can be thrown away, and a new one started', async () => {
      const flow = await make('PETITION');
      await flows.replaceSteps(flow.id, flow.draft!.id, actor, {
        steps: [step({ parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }, { partyKind: 'TEAM', teamId: teamA, role: 'CHECK' }] })],
        expectedRevision: 1,
      });

      expect(await codeOf(flows.deleteDraft(flow.id, flow.draft!.id, actor, 1))).toBe('409 REVISION_CONFLICT');
      const without = await flows.deleteDraft(flow.id, flow.draft!.id, actor, 2);
      expect(without).toMatchObject({ draft: null, draftVersionNo: null, versions: [] });
      expect(await scratch.db.procFlowStep.count({ where: { versionId: flow.draft!.id } })).toBe(0);

      const again = await flows.createDraft(flow.id, actor);
      expect(again.draft).toMatchObject({ versionNo: 1, status: 'DRAFT', steps: [] });
    });
  });

  describe('publishing', () => {
    it('refuses a version that breaks a rule of a flow, with every issue; nothing changes', async () => {
      const flow = await make('PETITION');
      const saved = await flows.replaceSteps(flow.id, flow.draft!.id, actor, {
        steps: [step({ parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }, { partyKind: 'TEAM', teamId: teamA, role: 'MAIN' }] })],
        expectedRevision: 1,
      });
      const key = saved.flow.draft!.steps[0].stepKey;

      expect(await refusal(flows.publish(flow.id, flow.draft!.id, actor, 2))).toEqual({
        status: 400,
        code: 'FLOW_INVALID',
        details: [{ code: 'STEP_NEEDS_ONE_MAIN', stepIndex: 0, stepKey: key }],
      });
      expect((await flows.get(flow.id)).draft).toMatchObject({ status: 'DRAFT', revision: 2 });
    });

    it('refuses an empty version', async () => {
      const flow = await make('PETITION');
      expect(await refusal(flows.publish(flow.id, flow.draft!.id, actor, 1))).toEqual({ status: 400, code: 'FLOW_INVALID', details: [{ code: 'FLOW_HAS_NO_STEPS' }] });
    });

    it('refuses a version that names a unit which is not active', async () => {
      const flow = await make('PETITION');
      const saved = await flows.replaceSteps(flow.id, flow.draft!.id, actor, {
        steps: [step({ parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }, { partyKind: 'TEAM', teamId: teamPaused, role: 'INFORM' }] })],
        expectedRevision: 1,
      });
      expect(saved.warnings).toEqual([]);
      expect(await refusal(flows.publish(flow.id, flow.draft!.id, actor, 2))).toEqual({
        status: 400,
        code: 'TEAM_NOT_ACTIVE',
        details: [{ stepIndex: 0, stepKey: saved.flow.draft!.steps[0].stepKey, teamId: teamPaused }],
      });
    });

    it('refuses a publish decided on an older revision of the version', async () => {
      const flow = await make('PETITION');
      await flows.replaceSteps(flow.id, flow.draft!.id, actor, { steps: [step()], expectedRevision: 1 });
      expect(await codeOf(flows.publish(flow.id, flow.draft!.id, actor, 1))).toBe('409 REVISION_CONFLICT');
    });

    it('a published version: who and when, no draft left, and the flow says which version records follow', async () => {
      const before = Date.now();
      const flow = await published('PETITION', [step({ name: 'Only' })]);

      expect(flow).toMatchObject({ publishedVersionNo: 1, draftVersionNo: null, draft: null, stepCount: 1 });
      expect(flow.published).toMatchObject({ versionNo: 1, status: 'PUBLISHED', publishedById: actor });
      expect(new Date(flow.published!.publishedAt as string).getTime()).toBeGreaterThanOrEqual(before - 1_000);
      expect(flow.versions.map((v) => [v.versionNo, v.status, v.stepCount])).toEqual([[1, 'PUBLISHED', 1]]);
    });

    it('a published version never changes: not its steps, not by deleting it, not by publishing it again', async () => {
      const flow = await published('PETITION', [step({ name: 'Fixed' })]);
      const version = flow.published!;

      expect(await codeOf(flows.replaceSteps(flow.id, version.id, actor, { steps: [step({ name: 'Changed' })], expectedRevision: version.revision }))).toBe('409 VERSION_IMMUTABLE');
      expect(await codeOf(flows.deleteDraft(flow.id, version.id, actor, version.revision))).toBe('409 VERSION_IMMUTABLE');
      expect(await codeOf(flows.publish(flow.id, version.id, actor, version.revision))).toBe('409 VERSION_IMMUTABLE');

      const now = await flows.get(flow.id);
      expect(now.published).toEqual(version);
    });

    it('the next draft is a copy of the published version under the SAME step keys, with what was verified', async () => {
      const flow = await published('PETITION', [
        step({ name: 'One', parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }, { partyKind: 'TEAM', teamId: teamA, role: 'CHECK' }] }),
        step({ name: 'Two', anchor: 'PREVIOUS_STEP_DONE' }),
      ]);
      const keys = flow.published!.steps.map((s) => s.stepKey);
      const verified = await flows.verifyLegal(flow.id, flow.published!.id, keys[0], other);

      const next = await flows.createDraft(flow.id, other);

      expect(next).toMatchObject({ publishedVersionNo: 1, draftVersionNo: 2 });
      expect(next.draft).toMatchObject({ versionNo: 2, status: 'DRAFT', revision: 1 });
      expect(next.draft!.steps.map((s) => [s.stepKey, s.name])).toEqual([[keys[0], 'One'], [keys[1], 'Two']]);
      expect(next.draft!.steps[0]).toMatchObject({ legalVerifiedAt: verified.published!.steps[0].legalVerifiedAt, legalVerifiedById: other });
      expect(next.draft!.steps[0].parties.map((p) => p.teamId)).toEqual([null, teamA]);
      // The published version is as it was.
      expect(next.published!.steps.map((s) => s.stepKey)).toEqual(keys);

      expect(await codeOf(flows.createDraft(flow.id, actor))).toBe('409 DRAFT_ALREADY_EXISTS');
    });

    it('publishing the next version supersedes the one before; there is never more than one published', async () => {
      const flow = await published('PETITION', [step({ name: 'First edition' })]);
      const next = await flows.createDraft(flow.id, actor);
      const key = next.draft!.steps[0].stepKey;
      const edited = await flows.replaceSteps(flow.id, next.draft!.id, actor, { steps: [step({ stepKey: key, name: 'Second edition' })], expectedRevision: 1 });

      const after = await flows.publish(flow.id, next.draft!.id, other, edited.flow.draft!.revision);

      expect(after.versions.map((v) => [v.versionNo, v.status])).toEqual([[2, 'PUBLISHED'], [1, 'SUPERSEDED']]);
      expect(after.published).toMatchObject({ versionNo: 2, publishedById: other });
      expect(after.published!.steps.map((s) => [s.stepKey, s.name])).toEqual([[key, 'Second edition']]);
      // The superseded version still holds what was published then.
      const old = await scratch.db.procFlowStep.findMany({ where: { versionId: flow.published!.id } });
      expect(old.map((s) => [s.stepKey, s.name])).toEqual([[key, 'First edition']]);
      // And is as immutable as before.
      expect(await codeOf(flows.replaceSteps(flow.id, flow.published!.id, actor, { steps: [], expectedRevision: flow.published!.revision }))).toBe('409 VERSION_IMMUTABLE');
    });

    it('two people publishing the same draft at the same moment: it is published once', async () => {
      const flow = await make('PETITION');
      await flows.replaceSteps(flow.id, flow.draft!.id, actor, { steps: [step()], expectedRevision: 1 });

      const results = await Promise.allSettled([
        flows.publish(flow.id, flow.draft!.id, actor, 2),
        flows.publish(flow.id, flow.draft!.id, other, 2),
        flows.publish(flow.id, flow.draft!.id, actor, 2),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const refused = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      expect(refused.map((r) => (r.reason as { response?: { code?: string } }).response?.code)).toEqual(['VERSION_IMMUTABLE', 'VERSION_IMMUTABLE']);
      expect(await scratch.db.procFlowVersion.count({ where: { flowId: flow.id, status: 'PUBLISHED' } })).toBe(1);
      expect((await auditOf(flow.id)).filter((row) => row.action === 'PROC_FLOW_VERSION_PUBLISH')).toHaveLength(1);
    });

    it('two drafts started at the same moment: one', async () => {
      const flow = await published('PETITION');
      const results = await Promise.allSettled([flows.createDraft(flow.id, actor), flows.createDraft(flow.id, other), flows.createDraft(flow.id, actor)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await scratch.db.procFlowVersion.count({ where: { flowId: flow.id, status: 'DRAFT' } })).toBe(1);
    });
  });

  describe('confirming the legal basis of a step', () => {
    it('stamps who and when, on a draft and on a published version alike; the way back clears it', async () => {
      const flow = await published('PETITION', [step({ name: 'One' })]);
      const key = flow.published!.steps[0].stepKey;
      const revision = flow.published!.revision;

      const verified = await flows.verifyLegal(flow.id, flow.published!.id, key, other);
      expect(verified.published!.steps[0].legalVerifiedById).toBe(other);
      expect(typeof verified.published!.steps[0].legalVerifiedAt).toBe('string');
      expect(verified.published).toMatchObject({ status: 'PUBLISHED', revision: revision + 1 });
      expect(await codeOf(flows.verifyLegal(flow.id, flow.published!.id, key, actor))).toBe('409 LEGAL_ALREADY_VERIFIED');

      const cleared = await flows.unverifyLegal(flow.id, flow.published!.id, key, actor);
      expect(cleared.published!.steps[0]).toMatchObject({ legalVerifiedById: null, legalVerifiedAt: null });
      expect(await codeOf(flows.unverifyLegal(flow.id, flow.published!.id, key, actor))).toBe('409 LEGAL_NOT_VERIFIED');

      const draft = await flows.createDraft(flow.id, actor);
      expect((await flows.verifyLegal(flow.id, draft.draft!.id, key, actor)).draft!.steps[0].legalVerifiedById).toBe(actor);
    });

    it('refuses a step that does not exist, and one that names no legal basis to confirm', async () => {
      const flow = await make('PETITION');
      const saved = await flows.replaceSteps(flow.id, flow.draft!.id, actor, { steps: [step({ legalBasis: null })], expectedRevision: 1 });
      const key = saved.flow.draft!.steps[0].stepKey;

      expect(await codeOf(flows.verifyLegal(flow.id, flow.draft!.id, 'no-such-step', actor))).toBe('404 FLOW_STEP_NOT_FOUND');
      expect(await codeOf(flows.verifyLegal(flow.id, flow.draft!.id, key, actor))).toBe('400 LEGAL_BASIS_REQUIRED');
      expect(await codeOf(flows.verifyLegal(flow.id, 'no-such-version', key, actor))).toBe('404 FLOW_VERSION_NOT_FOUND');
    });

    it('editing a draft keeps the confirmation while the legal figures are the same, and drops it when they change', async () => {
      const flow = await make('PETITION');
      const saved = await flows.replaceSteps(flow.id, flow.draft!.id, actor, { steps: [step({ name: 'A' }), step({ name: 'B', anchor: 'PREVIOUS_STEP_DONE' })], expectedRevision: 1 });
      const [a, b] = saved.flow.draft!.steps.map((s) => s.stepKey);
      await flows.verifyLegal(flow.id, flow.draft!.id, a, other);
      const both = await flows.verifyLegal(flow.id, flow.draft!.id, b, other);

      const edited = await flows.replaceSteps(flow.id, flow.draft!.id, actor, {
        steps: [
          // Renamed, other thresholds, another party: the figures a person confirmed are untouched.
          step({ stepKey: a, name: 'A renamed', greenDays: 9, parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }, { partyKind: 'TEAM', teamId: teamA, role: 'INFORM' }] }),
          // One day longer.
          step({ stepKey: b, name: 'B', anchor: 'PREVIOUS_STEP_DONE', durationValue: 11 }),
        ],
        expectedRevision: both.draft!.revision,
      });

      expect(edited.flow.draft!.steps.map((s) => [s.name, s.legalVerifiedById])).toEqual([['A renamed', other], ['B', null]]);
    });
  });

  describe('archiving and restoring', () => {
    it('an archived flow leaves the working list and frees its name; restoring brings it back as it was', async () => {
      const flow = await make('INCIDENT');
      await flows.setBindings(flow.id, actor, { directoryIds: [types[1].id], deadlineGroups: [], expectedRevision: 1 });

      const archived = await flows.archive(flow.id, other, 2);
      expect(archived).toMatchObject({ status: 'ARCHIVED', revision: 3 });
      expect(archived.archivedAt).toEqual(expect.any(String));
      expect((await flows.list({ recordKind: 'INCIDENT', includeArchived: false })).map((f) => f.id)).not.toContain(flow.id);
      expect((await flows.list({ recordKind: 'INCIDENT', includeArchived: true })).map((f) => f.id)).toContain(flow.id);
      expect(await codeOf(flows.archive(flow.id, actor, 3))).toBe('409 FLOW_ALREADY_ARCHIVED');
      expect(await codeOf(flows.archive(flow.id, actor, 2))).toBe('409 REVISION_CONFLICT');

      const restored = await flows.restore(flow.id, actor, 3);
      expect(restored).toMatchObject({ status: 'ACTIVE', archivedAt: null, revision: 4, name: flow.name });
      expect(restored.boundTypes.map((t) => t.directoryId)).toEqual([types[1].id]);
      expect(await codeOf(flows.restore(flow.id, actor, 4))).toBe('409 FLOW_NOT_ARCHIVED');
      await flows.setBindings(flow.id, actor, { directoryIds: [], deadlineGroups: [], expectedRevision: 4 });
    });

    it('restoring is refused when the name was taken meanwhile', async () => {
      const flow = await make('INCIDENT');
      await flows.archive(flow.id, actor, 1);
      const usurper = await flows.create(actor, { name: flow.name, recordKind: 'INCIDENT' });

      expect(await codeOf(flows.restore(flow.id, actor, 2))).toBe('409 FLOW_NAME_TAKEN');

      await flows.update(usurper.id, actor, { name: fresh(), expectedRevision: 1 });
      expect((await flows.restore(flow.id, actor, 2)).status).toBe('ACTIVE');
    });

    it('restoring is refused when the default slot was taken meanwhile', async () => {
      const flow = await make('INCIDENT', { isDefault: true });
      await flows.archive(flow.id, actor, 1);
      const usurper = await make('INCIDENT', { isDefault: true });

      expect(await refusal(flows.restore(flow.id, actor, 2))).toEqual({
        status: 409,
        code: 'DEFAULT_FLOW_EXISTS',
        details: { flowId: usurper.id, name: usurper.name },
      });

      await flows.archive(usurper.id, actor, 1);
      expect(await flows.restore(flow.id, actor, 2)).toMatchObject({ status: 'ACTIVE', isDefault: true });
      await flows.archive(flow.id, actor, 3);
    });

    it('restoring is refused when one of its bindings was taken meanwhile', async () => {
      const flow = await make('PETITION');
      await flows.setBindings(flow.id, actor, { directoryIds: [types[0].id, types[2].id], deadlineGroups: ['KHIEU_NAI'], expectedRevision: 1 });
      await flows.archive(flow.id, actor, 2);
      const usurper = await make('PETITION');
      // An archived flow holds nothing: its type and its group are free to take.
      await flows.setBindings(usurper.id, actor, { directoryIds: [types[0].id], deadlineGroups: ['KHIEU_NAI'], expectedRevision: 1 });

      expect(await refusal(flows.restore(flow.id, actor, 3))).toEqual({
        status: 409,
        code: 'TYPE_ALREADY_BOUND',
        details: [
          { directoryId: types[0].id, flowId: usurper.id, flowName: usurper.name },
          { deadlineGroup: 'KHIEU_NAI', flowId: usurper.id, flowName: usurper.name },
        ],
      });
      expect((await flows.get(flow.id)).status).toBe('ARCHIVED');

      await flows.setBindings(usurper.id, actor, { directoryIds: [], deadlineGroups: [], expectedRevision: 2 });
      expect((await flows.restore(flow.id, actor, 3)).boundTypes).toHaveLength(2);
      await flows.setBindings(flow.id, actor, { directoryIds: [], deadlineGroups: [], expectedRevision: 4 });
    });
  });

  describe('deleting', () => {
    it('a flow that was never published goes for good, with everything under it, in an order the database accepts', async () => {
      const flow = await flows.create(actor, { name: fresh(), recordKind: 'CASE', templateKey: 'CASE_INVESTIGATION' });
      const draft = flow.draft!;
      await flows.replaceSteps(flow.id, draft.id, actor, {
        steps: [
          step({
            anchor: 'PROSECUTED',
            parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }, { partyKind: 'TEAM', teamId: teamA, role: 'CHECK' }],
            variants: [{ conditionKey: 'CRIME_GRAVITY', conditionValue: 'NGHIEM_TRONG', durationValue: 3, durationUnit: 'MONTH' }],
          }),
          step({ anchor: 'PREVIOUS_STEP_DONE' }),
        ],
        expectedRevision: 1,
      });
      await flows.setBindings(flow.id, actor, { directoryIds: [types[1].id], deadlineGroups: [], expectedRevision: 1 });

      expect(await flows.remove(flow.id, other, { expectedRevision: 2, confirmName: flow.name })).toEqual({ deleted: true, id: flow.id });

      const { db } = scratch;
      expect(await db.procFlow.count({ where: { id: flow.id } })).toBe(0);
      expect(await db.procFlowBinding.count({ where: { flowId: flow.id } })).toBe(0);
      expect(await db.procFlowVersion.count({ where: { flowId: flow.id } })).toBe(0);
      expect(await db.procFlowStep.count({ where: { versionId: draft.id } })).toBe(0);
      expect(await codeOf(flows.get(flow.id))).toBe('404 FLOW_NOT_FOUND');
      // What it pointed at is still there.
      expect(await db.team.count({ where: { id: teamA } })).toBe(1);
      expect(await db.directory.count({ where: { id: types[1].id } })).toBe(1);
    });

    it('asks for the name of the flow typed back, and for the revision it was looked at', async () => {
      const flow = await make('CASE');
      expect(await codeOf(flows.remove(flow.id, actor, { expectedRevision: 1, confirmName: 'something else' }))).toBe('400 CONFIRMATION_MISMATCH');
      expect(await codeOf(flows.remove(flow.id, actor, { expectedRevision: 1, confirmName: undefined }))).toBe('400 CONFIRMATION_MISMATCH');
      expect(await codeOf(flows.remove(flow.id, actor, { expectedRevision: 7, confirmName: flow.name }))).toBe('409 REVISION_CONFLICT');
      expect(await scratch.db.procFlow.count({ where: { id: flow.id } })).toBe(1);
    });

    it('a flow that has ever had a published version is not deleted: it is archived instead', async () => {
      const flow = await published('CASE', [step({ anchor: 'PROSECUTED' })]);
      expect(await codeOf(flows.remove(flow.id, actor, { expectedRevision: flow.revision, confirmName: flow.name }))).toBe('409 FLOW_IN_USE');

      // Superseded and archived: it was still published once.
      const next = await flows.createDraft(flow.id, actor);
      await flows.publish(flow.id, next.draft!.id, actor, 1);
      const archived = await flows.archive(flow.id, actor, flow.revision);
      expect(await codeOf(flows.remove(flow.id, actor, { expectedRevision: archived.revision, confirmName: flow.name }))).toBe('409 FLOW_IN_USE');
      expect(await scratch.db.procFlowVersion.count({ where: { flowId: flow.id } })).toBe(2);
    });

    it('an archived flow that was never published can be deleted', async () => {
      const flow = await make('CASE');
      const archived = await flows.archive(flow.id, actor, 1);
      expect(await flows.remove(flow.id, actor, { expectedRevision: archived.revision, confirmName: flow.name })).toEqual({ deleted: true, id: flow.id });
    });
  });

  describe('the audit trail', () => {
    it('every write leaves one row, in the same transaction, with metadata only', async () => {
      const flow = await flows.create(actor, { name: fresh(), recordKind: 'PETITION', description: 'SECRET-DESCRIPTION' });
      await flows.update(flow.id, actor, { description: 'SECRET-DESCRIPTION-2', expectedRevision: 1 });
      await flows.setBindings(flow.id, actor, { directoryIds: [types[2].id], deadlineGroups: [], expectedRevision: 2 });
      const saved = await flows.replaceSteps(flow.id, flow.draft!.id, actor, {
        steps: [step({ name: 'SECRET-STEP-NAME', description: 'SECRET-STEP-TEXT', legalBasis: 'SECRET-BASIS', parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN', note: 'SECRET-NOTE' }] })],
        expectedRevision: 1,
      });
      const key = saved.flow.draft!.steps[0].stepKey;
      await flows.verifyLegal(flow.id, flow.draft!.id, key, other);
      await flows.unverifyLegal(flow.id, flow.draft!.id, key, other);
      await flows.publish(flow.id, flow.draft!.id, actor, 4);
      const next = await flows.createDraft(flow.id, actor);
      await flows.deleteDraft(flow.id, next.draft!.id, actor);
      await flows.setBindings(flow.id, actor, { directoryIds: [], deadlineGroups: [], expectedRevision: 3 });
      await flows.archive(flow.id, actor, 4);
      await flows.restore(flow.id, actor, 5);

      const rows = await auditOf(flow.id);
      expect(rows.map((row) => row.action).sort()).toEqual(
        [
          'PROC_FLOW_CREATE',
          'PROC_FLOW_UPDATE',
          'PROC_FLOW_BINDINGS_SET',
          'PROC_FLOW_STEPS_SAVE',
          'PROC_FLOW_STEP_LEGAL_VERIFY',
          'PROC_FLOW_STEP_LEGAL_UNVERIFY',
          'PROC_FLOW_VERSION_PUBLISH',
          'PROC_FLOW_VERSION_CREATE',
          'PROC_FLOW_VERSION_DELETE',
          'PROC_FLOW_BINDINGS_SET',
          'PROC_FLOW_ARCHIVE',
          'PROC_FLOW_RESTORE',
        ].sort(),
      );
      expect(rows.every((row) => row.subject === 'ProcFlow' || row.subject === 'ProcFlowVersion')).toBe(true);
      expect(rows.filter((row) => row.userId === other).map((row) => row.action).sort()).toEqual(['PROC_FLOW_STEP_LEGAL_UNVERIFY', 'PROC_FLOW_STEP_LEGAL_VERIFY']);
      // Which flow, which version, how many: never what a step says.
      expect(JSON.stringify(rows.map((row) => row.metadata))).not.toMatch(/SECRET/);
      const publish = rows.find((row) => row.action === 'PROC_FLOW_VERSION_PUBLISH');
      expect(publish?.metadata).toMatchObject({ flowId: flow.id, versionNo: 1, steps: 1, supersededVersionNo: null });
    });

    it('a write that is refused leaves no row; a delete leaves its own', async () => {
      const flow = await make('PETITION');
      await refusal(flows.update(flow.id, actor, { description: 'x', expectedRevision: 9 }));
      await refusal(flows.publish(flow.id, flow.draft!.id, actor, 1));
      expect((await auditOf(flow.id)).map((row) => row.action)).toEqual(['PROC_FLOW_CREATE']);

      await flows.remove(flow.id, actor, { expectedRevision: 1, confirmName: flow.name });
      const rows = await auditOf(flow.id);
      expect(rows.map((row) => row.action)).toEqual(['PROC_FLOW_CREATE', 'PROC_FLOW_DELETE']);
      expect(rows[1].metadata).toMatchObject({ recordKind: 'PETITION', versions: 1, steps: 0, bindings: 0 });
    });
  });

  describe('reading', () => {
    it('the list: what each flow is bound to, how many steps, which versions; by record kind', async () => {
      const flow = await published('INCIDENT', [step(), step({ anchor: 'PREVIOUS_STEP_DONE' })]);
      await flows.setBindings(flow.id, actor, { directoryIds: [types[0].id], deadlineGroups: [], expectedRevision: 1 });
      await flows.createDraft(flow.id, actor);

      const listed = (await flows.list({ recordKind: 'INCIDENT', includeArchived: false })).find((f) => f.id === flow.id);
      expect(listed).toMatchObject({
        name: flow.name,
        recordKind: 'INCIDENT',
        stepCount: 2,
        publishedVersionNo: 1,
        draftVersionNo: 2,
        boundGroups: [],
      });
      expect(listed?.boundTypes.map((t) => t.name)).toEqual([types[0].name]);
      // The list carries no steps.
      expect(listed).not.toHaveProperty('draft');
      expect((await flows.list({ recordKind: 'CASE', includeArchived: true })).map((f) => f.id)).not.toContain(flow.id);
      expect((await flows.list({ includeArchived: false })).map((f) => f.id)).toContain(flow.id);
      await flows.setBindings(flow.id, actor, { directoryIds: [], deadlineGroups: [], expectedRevision: 2 });
    });

    it('resolve: the flow a record of a kind and an information type follows', async () => {
      const typed = await published('PETITION');
      await flows.setBindings(typed.id, actor, { directoryIds: [types[0].id], deadlineGroups: [], expectedRevision: 1 });
      const fallback = await make('PETITION', { isDefault: true });

      expect(await flows.resolve('PETITION', `  ${types[0].name.toUpperCase()}. `)).toMatchObject({
        match: 'TYPE',
        flowId: typed.id,
        flowName: typed.name,
        directoryId: types[0].id,
        publishedVersionNo: 1,
      });
      expect(await flows.resolve('PETITION', types[2].name)).toMatchObject({ match: 'DEFAULT', flowId: fallback.id, flowName: fallback.name, publishedVersionNo: null });
      expect(await flows.resolve('PETITION', `${tag} chữ gõ tay của hệ cũ`)).toMatchObject({ match: 'UNKNOWN_TYPE', flowId: fallback.id });
      expect(await flows.resolve('PETITION', null)).toMatchObject({ match: 'DEFAULT', flowId: fallback.id });
      // No default flow for cases, and nothing bound: no flow.
      expect(await flows.resolve('CASE', types[0].name)).toEqual({ match: null, flowId: null });

      await flows.setBindings(typed.id, actor, { directoryIds: [], deadlineGroups: [], expectedRevision: 2 });
      await flows.archive(fallback.id, actor, 1);
    });

    it('the schedule preview reads the working calendar and says what stops the steps from being published', async () => {
      const preview = await flows.previewSchedule({
        recordKind: 'PETITION',
        steps: [step({ durationValue: 20, setsRecordDeadline: true }), step({ anchor: 'PREVIOUS_STEP_DONE', parties: [] })],
        anchors: { RECEIVED: '2026-03-02' },
      });
      expect(preview.steps[0]).toMatchObject({ stepIndex: 0, startAt: '2026-03-02T00:00:00.000Z', dueAt: '2026-03-23T16:59:59.999Z', problem: null });
      expect(preview.steps[1]).toMatchObject({ stepIndex: 1, startAt: '2026-03-23T16:59:59.999Z', problem: null });
      expect(preview.recordDeadline).toBe('2026-03-23T16:59:59.999Z');
      expect(preview.issues).toEqual([{ code: 'STEP_NEEDS_ONE_MAIN', stepIndex: 1 }]);

      expect(await codeOf(flows.previewSchedule({ recordKind: 'PETITION', steps: [step()], anchors: { RECEIVED: 'yesterday' } }))).toBe('400 PREVIEW_ANCHORS_INVALID');
      expect(await codeOf(flows.previewSchedule({ recordKind: 'PETITION', steps: [step()], anchors: { SOMEDAY: '2026-03-02' } }))).toBe('400 PREVIEW_ANCHORS_INVALID');
      expect(await codeOf(flows.previewSchedule({ recordKind: 'PETITION', steps: [step({ anchor: 'NOPE' })], anchors: {} }))).toBe('400 STEPS_INVALID');
    });
  });
});
