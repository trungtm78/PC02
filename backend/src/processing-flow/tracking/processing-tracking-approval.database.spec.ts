import { HttpException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { configurationHash } from '../../cases/governance/case-configuration.service';
import { ensurePermissions, openScratchDatabase, type EnsuredPermissions, type ScratchDatabase } from '../../common/testing/scratch-database';
import { TeamsService } from '../../teams/teams.service';
import { WorkingCalendarService } from '../calendar/working-calendar.service';
import { bandInstants } from '../engine/bands';
import { CaseAdapter } from '../gateway/case.adapter';
import { IncidentAdapter } from '../gateway/incident.adapter';
import { PetitionAdapter } from '../gateway/petition.adapter';
import { RecordGateway } from '../gateway/record-gateway';
import type { RecordKind } from '../gateway/record-snapshot';
import { FlowApplicationService } from '../records/flow-application.service';
import { ProcessingCommandService } from '../records/processing-command.service';
import { ProcessingResultsService } from '../records/processing-results.service';
import { finishedStatuses, recordLink } from '../records/record-alert';
import { RecordDeadlineWriter } from '../records/record-deadline-writer.service';
import { RecordStepAccessService } from '../records/record-step-access.service';
import { TRACKED_BANDS } from './band-conditions';
import { ProcessingTrackingService, type TrackingItem } from './processing-tracking.service';

/**
 * The card "waiting for my approval" and the search box of the tracking screen, on a REAL PostgreSQL: the number of the
 * card is the rows of its list for every person, it follows the rule of the decision route (the permission AND the
 * record in the person's own scope), and a search narrows the cards and the list by the same condition.
 *
 * The database is shared: every row carries the tag of this run, nothing is truncated, only its own rows are removed.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

type Who = 'owner' | 'boss' | 'bossU' | 'member' | 'bareBoss' | 'sensitive';
const PEOPLE: Who[] = ['owner', 'boss', 'bossU', 'member', 'bareBoss'];
const T = { redDays: 1, yellowDays: 2, greenDays: 3 };
/** 10 December 2026, 10:00 in Vietnam. */
const NOW = new Date('2026-12-10T03:00:00.000Z');
const endOf = (day: number) => new Date(`2026-12-${String(day).padStart(2, '0')}T16:59:59.999Z`);
const RED = endOf(11);

run('Waiting for my approval, and the search, on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let tracking: ProcessingTrackingService;
  let gateway: RecordGateway;
  let results: ProcessingResultsService;
  let permissions: EnsuredPermissions;
  const tag = `apv-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  const roleOf: Record<string, string> = {};
  const stepConfig = { approval: '', plain: '' };
  let flowConfig = { flowId: '', versionId: '' };
  let counter = 0;
  /** name -> the record, and its code. */
  const rec: Record<string, { kind: RecordKind; id: string; code: string }> = {};

  const user = (who: Who) => ({ id: id[who], role: roleOf[who], canDispatch: false });
  const asOf = NOW.toISOString();

  interface Spec {
    kind?: RecordKind;
    status?: 'OPEN' | 'REPORTED';
    config?: 'approval' | 'plain';
    due?: Date | null;
    confirmed?: boolean;
    paused?: boolean;
    over?: Record<string, unknown>;
    /** `false`: a REPORTED step with no standing result report (written as rows; the commands never leave one). */
    report?: boolean;
    parties?: Array<{ team: 'T' | 'U'; role?: 'MAIN' | 'CHECK' }>;
  }

  /** A record with ONE step, written as rows. */
  const make = async (name: string, spec: Spec = {}): Promise<void> => {
    const { db } = scratch;
    const kind = spec.kind ?? 'PETITION';
    const n = ++counter;
    const code = `${tag}-${kind === 'PETITION' ? 'p' : kind === 'INCIDENT' ? 'i' : 'c'}${n}`;
    const recordId =
      kind === 'CASE'
        ? (await db.case.create({ data: { name: `${tag} case ${n}`, caseCode: code, caseProvenance: 'DIRECT_DISCOVERY', investigatorId: id.owner, assignedTeamId: id.T, status: 'DANG_DIEU_TRA', ...spec.over } as never })).id
        : kind === 'PETITION'
        ? (await db.petition.create({ data: { stt: code, receivedDate: new Date('2026-12-01T00:00:00Z'), senderName: `${tag} sender ${n}`, loaiThongTin: 'Tố cáo', enteredById: id.owner, assignedTeamId: id.T, status: 'DANG_XU_LY', ...spec.over } as never })).id
        : (await db.incident.create({ data: { code, name: `${tag} incident ${n}`, loaiThongTin: 'Tố giác', investigatorId: id.owner, assignedTeamId: id.T, status: 'DANG_XAC_MINH', ...spec.over } as never })).id;
    rec[name] = { kind, id: recordId, code };
    const flow = await db.procRecordFlow.create({ data: { recordKind: kind, recordId, ...recordLink(kind, recordId), flowId: flowConfig.flowId, versionId: flowConfig.versionId, match: 'MANUAL', confirmed: spec.confirmed ?? true } });
    const due = spec.due === undefined ? RED : spec.due;
    const step = await db.procRecordStep.create({
      data: {
        recordFlowId: flow.id,
        recordKind: kind,
        recordId,
        stepId: stepConfig[spec.config ?? 'approval'],
        stepKey: 'k1',
        order: 0,
        status: spec.status ?? 'REPORTED',
        startAt: new Date('2026-12-01T00:00:00Z'),
        ...(due ? { regulatoryDueAt: due, internalDueAt: due, ...bandInstants(due, T) } : {}),
        parties: { create: (spec.parties ?? [{ team: 'T' }]).map((party, order) => ({ partyKind: 'TEAM' as const, teamId: id[party.team], role: party.role ?? 'MAIN', order })) },
      },
    });
    // The result the unit reported, standing: what a decision is given on.
    if ((spec.status ?? 'REPORTED') === 'REPORTED' && spec.report !== false) {
      await db.procStepReport.create({ data: { recordStepId: step.id, recordKind: kind, recordId, kind: 'RESULT', doneWork: `${tag} done`, authorId: id.owner } });
    }
    if (spec.paused) await db.procRecordPause.create({ data: { recordFlowId: flow.id, from: NOW, reason: 'SUSPENDED' } });
  };

  const waiting = async (who: Who, filter: Record<string, unknown> = {}): Promise<TrackingItem[]> => {
    const answer = await tracking.items(user(who), { asOf, awaiting: 'approval', pageSize: 100, ...filter });
    expect(answer.items).toHaveLength(answer.total);
    return answer.items;
  };
  const names = (items: TrackingItem[]) =>
    items
      .map((item) => Object.keys(rec).find((name) => rec[name].id === item.recordId))
      .filter((name): name is string => name !== undefined)
      .sort();
  const found = async (who: Who, filter: Record<string, unknown>) => names((await tracking.items(user(who), { asOf, pageSize: 100, ...filter })).items);

  beforeAll(async () => {
    scratch = await openScratchDatabase(url as string);
    const { db } = scratch;
    const reads = ['read:Petition', 'read:Incident', 'read:Case'];
    permissions = await ensurePermissions(scratch, [...reads, 'approve:ProcessingStep', 'read_sensitive:CaseGovernance']);
    const grant = (keys: string[]) => ({ create: keys.map((key) => ({ permissionId: permissions.ids[key] })) });
    const officer = await db.role.create({ data: { name: `${tag}-officer`, permissions: grant(reads) } });
    const approver = await db.role.create({ data: { name: `${tag}-approver`, permissions: grant([...reads, 'approve:ProcessingStep']) } });
    // Holds the permission to approve, and reads no kind of record at all.
    const bare = await db.role.create({ data: { name: `${tag}-bare`, permissions: grant(['approve:ProcessingStep']) } });
    const person = async (who: Who, role: { id: string; name: string }) => {
      roleOf[who] = role.name;
      id[who] = (await db.user.create({ data: { username: `${tag}-${who}`, passwordHash: 'x', roleId: role.id, isActive: true } })).id;
    };
    await person('owner', officer);
    await person('boss', approver);
    await person('bossU', approver);
    await person('member', officer);
    await person('bareBoss', bare);
    // Reads the fields of a case its schema restricts.
    const trusted = await db.role.create({ data: { name: `${tag}-trusted`, permissions: grant([...reads, 'approve:ProcessingStep', 'read_sensitive:CaseGovernance']) } });
    await person('sensitive', trusted);
    for (const code of ['T', 'U', 'O']) id[code] = (await db.team.create({ data: { code: `${tag}-${code}`, name: `${tag} Tổ ${code}` } })).id;
    await db.userTeam.createMany({
      data: [
        { userId: id.owner, teamId: id.O },
        { userId: id.boss, teamId: id.T },
        { userId: id.member, teamId: id.T },
        { userId: id.bareBoss, teamId: id.T },
        { userId: id.sensitive, teamId: id.T },
        { userId: id.bossU, teamId: id.U },
      ],
    });

    const flow = await db.procFlow.create({ data: { recordKind: 'PETITION', name: `${tag}-flow`, createdById: id.owner, updatedById: id.owner } });
    const version = await db.procFlowVersion.create({ data: { flowId: flow.id, versionNo: 1, status: 'PUBLISHED', createdById: id.owner } });
    flowConfig = { flowId: flow.id, versionId: version.id };
    const base = { versionId: version.id, durationValue: 5, durationUnit: 'DAY' as const, anchor: 'RECEIVED' as const, ...T };
    stepConfig.approval = (await db.procFlowStep.create({ data: { ...base, stepKey: 'k1', order: 0, name: `${tag} Settle`, requiresApproval: true } })).id;
    stepConfig.plain = (await db.procFlowStep.create({ data: { ...base, stepKey: 'k2', order: 1, name: `${tag} Verify` } })).id;

    const prisma = db as never;
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, new AuditService(prisma), {} as never));
    const stepAccess = new RecordStepAccessService(prisma, { isEnabled: () => Promise.resolve(true) } as never);
    await stepAccess.refreshSwitch();
    stepAccess.now = () => NOW;
    gateway = new RecordGateway(new PetitionAdapter(prisma, scopes, stepAccess), new IncidentAdapter(prisma, scopes, stepAccess), new CaseAdapter(prisma, scopes, stepAccess));
    tracking = new ProcessingTrackingService(prisma, scopes);
    tracking.now = () => NOW;
    // The REAL decision path, as the route runs it.
    const audit = new AuditService(prisma);
    const calendars = new WorkingCalendarService(prisma, audit);
    const writer = new RecordDeadlineWriter(prisma, gateway);
    const commands = new ProcessingCommandService(prisma, gateway, calendars, new FlowApplicationService(prisma, gateway, calendars, audit, writer), audit, writer);
    results = new ProcessingResultsService(prisma, commands);

    // ---- waiting for a decision (held by T unless said)
    await make('reported');
    // An incident whose step has no deadline at all: it still waits for a decision.
    await make('no-deadline', { kind: 'INCIDENT', due: null });
    // U checks it: U's leader reaches the record through that step only.
    await make('checked-by-U', { parties: [{ team: 'T' }, { team: 'U', role: 'CHECK' }] });
    // Held, entered and worked by U.
    await make('of-U', { over: { assignedTeamId: id.U, enteredById: id.bossU }, parties: [{ team: 'U' }] });
    // ---- never waiting for a decision
    await make('no-approval-asked', { config: 'plain' });
    await make('still-open', { status: 'OPEN' });
    await make('proposal', { confirmed: false });
    await make('paused', { paused: true });
    await make('finished', { over: { status: finishedStatuses('PETITION')[0] } });
    await make('suspended', { over: { status: 'TAM_DINH_CHI' } });
    await make('deleted', { over: { deletedAt: NOW } });
    await make('no-result-report', { report: false });
    // ---- for the search: two names that differ where a LIKE wildcard would not tell them apart
    await make('percent', { status: 'OPEN', config: 'plain', over: { senderName: `${tag} done 100% sure` } });
    await make('letter', { status: 'OPEN', config: 'plain', over: { senderName: `${tag} done 100x sure` } });
    await make('incident-open', { kind: 'INCIDENT', status: 'OPEN', config: 'plain', over: { name: `${tag} Mất Trộm xe` } });
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    const flows = { flowId: flowConfig.flowId };
    const recordIds = Object.values(rec).map((record) => record.id);
    const flowIds = (await db.procRecordFlow.findMany({ where: flows, select: { id: true } })).map((flow) => flow.id);
    await db.auditLog.deleteMany({ where: { subject: 'ProcRecordFlow', subjectId: { in: flowIds } } });
    await db.auditLog.deleteMany({ where: { userId: { in: Object.values(id) } } });
    await db.procStepOpinion.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procStepReport.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procCommandKey.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procStepChange.deleteMany({ where: { recordId: { in: recordIds } } });
    await db.procRecordStepParty.deleteMany({ where: { recordStep: { recordFlow: flows } } });
    await db.procRecordStep.deleteMany({ where: { recordFlow: flows } });
    await db.procRecordPause.deleteMany({ where: { recordFlow: flows } });
    await db.procRecordFlow.deleteMany({ where: flows });
    await db.procFlowStep.deleteMany({ where: { versionId: flowConfig.versionId } });
    await db.procFlowVersion.deleteMany({ where: { id: flowConfig.versionId } });
    await db.procFlow.deleteMany({ where: { id: flowConfig.flowId } });
    await db.petition.deleteMany({ where: { stt: { startsWith: tag } } });
    await db.incident.deleteMany({ where: { code: { startsWith: tag } } });
    await db.case.deleteMany({ where: { name: { startsWith: tag } } });
    await db.caseFieldDefinitionVersion.deleteMany({ where: { code: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await permissions?.dropCreated();
    await scratch.close();
  });

  describe('waiting for my approval', () => {
    it('lists the steps REPORTED with a standing result, of the records in the person\'s OWN scope, for a person who may approve', async () => {
      // Everything the decision route accepts today: also a record that is suspended, finished or paused, a flow that
      // is only a proposal, and a reported step whose flow step asks for no approval (the last block proves each).
      expect(names(await waiting('boss'))).toEqual(['checked-by-U', 'finished', 'no-approval-asked', 'no-deadline', 'paused', 'proposal', 'reported', 'suspended']);
      // Still open, deleted, or reported with no standing result: none of the three.
      const [row] = (await waiting('boss')).filter((item) => item.recordId === rec.reported.id);
      expect(row).toMatchObject({ recordKind: 'PETITION', recordCode: rec.reported.code, stepKey: 'k1', teamId: id.T, band: 'RED', dueAt: RED.toISOString(), remainingDays: 1 });
    });

    it('a step with no deadline still waits: it is listed with no deadline and no colour', async () => {
      const [row] = (await waiting('boss')).filter((item) => item.recordId === rec['no-deadline'].id);
      expect(row).toMatchObject({ recordKind: 'INCIDENT', dueAt: null, band: 'NONE', remainingDays: null });
    });

    it('a holder of the permission who reaches a record only through a step does not decide on it: not counted', async () => {
      // `bossU` opens `checked-by-U` (U checks it) but the record is T's: only what U holds waits for them.
      expect(await found('bossU', { role: 'CHECK' })).toContain('checked-by-U');
      expect(names(await waiting('bossU'))).toEqual(['of-U']);
      expect(names(await waiting('bossU', { role: 'CHECK' }))).toEqual([]);
      expect(names(await waiting('boss'))).not.toContain('of-U');
    });

    it('a person without the permission has none, whatever they read; neither has one who may approve and reads no record', async () => {
      expect(await found('member', { band: 'RED' })).toContain('reported');
      expect(await waiting('member')).toEqual([]);
      expect((await tracking.summary(user('member'), { asOf })).awaitingMyApproval).toBe(0);
      expect(await waiting('bareBoss')).toEqual([]);
      expect((await tracking.summary(user('bareBoss'), { asOf })).awaitingMyApproval).toBe(0);
    });

    it('the number of the card IS the rows of its list, for every person and filter, at the same instant', async () => {
      const compared: Array<{ cell: string; number: number; rows: number }> = [];
      const filters: Array<Record<string, unknown>> = [{}, { kind: 'INCIDENT' }, { kind: 'PETITION' }, { teamId: id.T }, { teamId: id.U }, { role: 'CHECK' }, { mine: true }, { from: '2026-12-02' }, { q: rec['checked-by-U'].code }];
      for (const who of PEOPLE) {
        for (const filter of filters) {
          const summary = await tracking.summary(user(who), { asOf, ...filter });
          const rows = await waiting(who, { asOf: summary.asOf, ...filter });
          compared.push({ cell: `${who}/${JSON.stringify(filter)}`, number: summary.awaitingMyApproval, rows: rows.length });
        }
      }
      expect(compared.filter((cell) => cell.number !== cell.rows)).toEqual([]);
      expect(compared.find((cell) => cell.cell === 'boss/{}')).toMatchObject({ number: 8 });
      expect(compared.find((cell) => cell.cell === 'boss/{"kind":"INCIDENT"}')).toMatchObject({ number: 1 });
      expect(compared.find((cell) => cell.cell === `boss/{"q":"${rec['checked-by-U'].code}"}`)).toMatchObject({ number: 1 });
      expect(compared.filter((cell) => cell.number > 0).length).toBeGreaterThanOrEqual(8);
    });

    it('is the rule of the decision route: the permission, and the gateway\'s own answer WITHOUT the step rule, row by row', async () => {
      const candidates = Object.entries(rec).filter(([name]) => ['reported', 'no-deadline', 'checked-by-U', 'of-U', 'finished', 'no-approval-asked', 'paused', 'proposal', 'suspended'].includes(name));
      for (const who of ['boss', 'bossU'] as Who[]) {
        const expected: string[] = [];
        for (const [name, record] of candidates) if (await gateway.canRead(record.kind, record.id, user(who), { viaStep: false })) expected.push(name);
        expect(names(await waiting(who))).toEqual(expected.sort());
      }
    });

    it('decided, the step no longer waits; the band cards never were this list', async () => {
      await make('to-decide');
      expect(names(await waiting('boss'))).toContain('to-decide');
      await scratch.db.procRecordStep.updateMany({ where: { recordId: rec['to-decide'].id }, data: { status: 'DONE', doneAt: NOW } });
      expect(names(await waiting('boss'))).not.toContain('to-decide');
      // Without `awaiting` the list is the work of a band, as before.
      expect(await found('boss', { band: 'RED' })).toEqual(expect.arrayContaining(['reported', 'still-open', 'no-approval-asked']));
    });
  });

  describe('the search', () => {
    const countsOf = async (who: Who, filter: Record<string, unknown>) => {
      const summary = await tracking.summary(user(who), { asOf, ...filter });
      return TRACKED_BANDS.reduce((sum, band) => sum + summary.counts[band], 0);
    };

    it('finds a record by its code, whatever the case of the letters, in the cards and the list alike', async () => {
      const code = rec.percent.code;
      expect(await found('boss', { q: code })).toEqual(['percent']);
      expect(await found('boss', { q: `  ${code.toUpperCase()}  ` })).toEqual(['percent']);
      expect(await countsOf('boss', { q: code })).toBe(1);
      // A part of the code is enough.
      expect(await found('boss', { q: code.slice(4) })).toEqual(['percent']);
      expect(await found('boss', { q: `${tag}-nothing` })).toEqual([]);
      expect(await countsOf('boss', { q: `${tag}-nothing` })).toBe(0);
    });

    it('finds a petition by its sender and an incident by its name; a LIKE wildcard typed by a person is a plain character', async () => {
      expect(await found('boss', { q: '100% sure' })).toEqual(['percent']);
      expect(await found('boss', { q: '100x sure' })).toEqual(['letter']);
      // Unescaped, `_` would match both and `%` everything.
      expect(await found('boss', { q: `${tag} done 100_ sure` })).toEqual([]);
      expect(await found('boss', { q: `${tag}%sure` })).toEqual([]);
      expect(await found('boss', { q: `${tag} mất trộm` })).toEqual(['incident-open']);
      expect(await countsOf('boss', { q: `${tag} mất trộm` })).toBe(1);
    });

    it('the cards and the list agree under a search, and it never widens what a person reaches', async () => {
      for (const who of PEOPLE) {
        for (const q of [tag, rec.percent.code, '100']) {
          const summary = await tracking.summary(user(who), { asOf, q });
          const list = await tracking.items(user(who), { asOf: summary.asOf, q, pageSize: 100 });
          expect(list.total).toBe(TRACKED_BANDS.reduce((sum, band) => sum + summary.counts[band], 0));
        }
      }
      // `bossU` does not reach T's record by typing its code.
      expect(await found('bossU', { q: rec.percent.code })).toEqual([]);
      expect(await found('bareBoss', { q: tag })).toEqual([]);
    });

    it('fewer than two characters after trimming is no search at all', async () => {
      expect(await countsOf('boss', { q: ' x ' })).toBe(await countsOf('boss', {}));
    });

    it('the proposals counted apart follow the search too', async () => {
      expect((await tracking.summary(user('boss'), { asOf, q: rec.proposal.code })).unconfirmed).toBe(1);
      expect((await tracking.summary(user('boss'), { asOf, q: rec.percent.code })).unconfirmed).toBe(0);
    });
  });

  describe('the units of the filter follow the role and the card of the screen', () => {
    const offered = async (who: Who, filter: Record<string, unknown> = {}) =>
      (await tracking.teams(user(who), filter))
        .filter((team) => team.name.startsWith(tag))
        .map((team) => team.name)
        .sort();

    it('MAIN by default; a unit that only CHECKS is offered when the screen lists the checking work', async () => {
      expect(await offered('boss')).toEqual([`${tag} Tổ T`]);
      // U only checks `checked-by-U` among what `boss` reaches.
      expect(await offered('boss', { role: 'CHECK' })).toEqual([`${tag} Tổ U`]);
      expect(await offered('boss', { role: 'COORDINATE' })).toEqual([]);
    });

    it('with the card "waiting for my approval": the units of exactly that work', async () => {
      expect(await offered('boss', { awaiting: 'approval' })).toEqual([`${tag} Tổ T`]);
      expect(await offered('bossU', { awaiting: 'approval' })).toEqual([`${tag} Tổ U`]);
      expect(await offered('member', { awaiting: 'approval' })).toEqual([]);
      // Every unit offered has rows on that list, and every unit of a row is offered.
      for (const who of ['boss', 'bossU'] as Who[]) {
        const inRows = [...new Set((await waiting(who)).flatMap((item) => (item.teamName?.startsWith(tag) ? [item.teamName] : [])))].sort();
        expect(await offered(who, { awaiting: 'approval' })).toEqual(inRows);
      }
    });
  });

  describe('the code of a case under the case field policy', () => {
    const codeOf = async (who: Who, name: string) => (await tracking.items(user(who), { asOf, kind: 'CASE', pageSize: 100 })).items.find((item) => item.recordId === rec[name].id)?.recordCode;
    const countsOf = async (who: Who, q: string) => {
      const summary = await tracking.summary(user(who), { asOf, q });
      return TRACKED_BANDS.reduce((sum, band) => sum + summary.counts[band], 0) + summary.unconfirmed + summary.awaitingMyApproval;
    };

    beforeAll(async () => {
      const { db } = scratch;
      const schema = async (suffix: string, policy: Record<string, unknown>) => {
        const definition = { fields: [], fieldPolicies: [{ key: 'caseCode', ...policy }] };
        return (await db.caseFieldDefinitionVersion.create({ data: { code: `${tag}-${suffix}`, definition, contentHash: configurationHash(definition), status: 'PUBLISHED', authorId: id.owner, publishedAt: new Date() } })).id;
      };
      const restricted = await schema('restricted', { sensitivity: 'RESTRICTED' });
      const unsearchable = await schema('unsearchable', { sensitivity: 'NORMAL', searchable: false });
      await make('case-plain', { kind: 'CASE', status: 'OPEN', config: 'plain' });
      await make('case-restricted', { kind: 'CASE', status: 'OPEN', config: 'plain', over: { fieldDefinitionVersionId: restricted } });
      await make('case-unsearchable', { kind: 'CASE', status: 'OPEN', config: 'plain', over: { fieldDefinitionVersionId: unsearchable } });
      // The same restricted schema, waiting for a decision and only a proposal: the other numbers that take `q`.
      await make('case-restricted-reported', { kind: 'CASE', over: { fieldDefinitionVersionId: restricted } });
      await make('case-restricted-proposal', { kind: 'CASE', status: 'OPEN', config: 'plain', confirmed: false, over: { fieldDefinitionVersionId: restricted } });
    });

    it('a reader for whom the code is RESTRICTED cannot probe it: a search by it matches nothing, in every number that takes `q`', async () => {
      expect(await found('boss', { q: rec['case-plain'].code })).toEqual(['case-plain']);
      for (const name of ['case-restricted', 'case-restricted-reported', 'case-restricted-proposal']) {
        const code = rec[name].code;
        // The whole code, a fragment of it (its end, which no other code shares), and a text that is in no record at
        // all: the same answer, nothing.
        for (const q of [code, code.slice(4)]) {
          expect(await found('boss', { q })).toEqual([]);
          expect(names(await waiting('boss', { q }))).toEqual([]);
          expect(await countsOf('boss', q)).toBe(await countsOf('boss', `${tag}-in-no-record`));
        }
      }
      expect(await countsOf('boss', `${tag}-in-no-record`)).toBe(0);
      // The cases themselves are within reach: only the code is closed.
      expect(await found('boss', { kind: 'CASE' })).toEqual(expect.arrayContaining(['case-plain', 'case-restricted', 'case-unsearchable']));
    });

    it('the row of such a case shows the step and NO code; a reader who holds the sensitive capability sees and finds it', async () => {
      expect(await codeOf('boss', 'case-plain')).toBe(rec['case-plain'].code);
      expect(await codeOf('boss', 'case-restricted')).toBeNull();
      const [row] = (await waiting('boss', { kind: 'CASE' })).filter((item) => item.recordId === rec['case-restricted-reported'].id);
      expect(row).toMatchObject({ recordCode: null, recordLabel: null, stepKey: 'k1' });

      expect(await codeOf('sensitive', 'case-restricted')).toBe(rec['case-restricted'].code);
      expect(await found('sensitive', { q: rec['case-restricted'].code })).toEqual(['case-restricted']);
    });

    it('a code the policy says is not searchable is shown and matched by nobody', async () => {
      for (const who of ['boss', 'sensitive'] as Who[]) {
        expect(await codeOf(who, 'case-unsearchable')).toBe(rec['case-unsearchable'].code);
        expect(await found(who, { q: rec['case-unsearchable'].code })).toEqual([]);
      }
    });
  });

  // LAST: it decides on the records, which moves their steps.
  describe('the card is exactly what the decision route accepts today', () => {
    const STATES = ['reported', 'no-deadline', 'suspended', 'paused', 'proposal', 'finished', 'deleted', 'no-result-report', 'no-approval-asked', 'still-open'];

    it('for every state of a record: listed on the card if and only if the real decide path accepts the decision', async () => {
      const listed = new Set(names(await waiting('boss')));
      const outcome: Record<string, { listed: boolean; accepted: boolean; why: string }> = {};
      for (const name of STATES) {
        const record = rec[name];
        // The route: `readable()` is the gateway's answer WITHOUT the step rule; then the command.
        let why = 'NOT_READABLE';
        if (await gateway.canRead(record.kind, record.id, user('boss'), { viaStep: false })) {
          const flow = await scratch.db.procRecordFlow.findFirstOrThrow({ where: { recordId: record.id }, select: { revision: true } });
          try {
            await results.decide(id.boss, record.kind, record.id, 'k1', { expectedRevision: flow.revision, verdict: 'DISAGREE', content: 'Not enough' });
            why = 'ACCEPTED';
          } catch (error) {
            if (!(error instanceof HttpException)) throw error;
            why = String((error.getResponse() as { code?: unknown }).code);
          }
        }
        outcome[name] = { listed: listed.has(name), accepted: why === 'ACCEPTED', why };
      }
      expect(Object.entries(outcome).filter(([, state]) => state.listed !== state.accepted)).toEqual([]);
      // What the route does today, state by state (the owner may tighten the command later; the card follows it).
      expect(Object.fromEntries(Object.entries(outcome).map(([name, state]) => [name, state.why]))).toEqual({
        reported: 'ACCEPTED',
        'no-deadline': 'ACCEPTED',
        suspended: 'ACCEPTED',
        paused: 'ACCEPTED',
        proposal: 'ACCEPTED',
        finished: 'ACCEPTED',
        deleted: 'NOT_READABLE',
        'no-result-report': 'NO_RESULT_REPORT',
        'no-approval-asked': 'ACCEPTED',
        'still-open': 'STEP_NOT_REPORTED',
      });
    });
  });
});
