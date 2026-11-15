import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { ensurePermissions, openScratchDatabase, type EnsuredPermissions, type ScratchDatabase } from '../../common/testing/scratch-database';
import { TeamsService } from '../../teams/teams.service';
import { bandInstants } from '../engine/bands';
import { CaseAdapter } from '../gateway/case.adapter';
import { IncidentAdapter } from '../gateway/incident.adapter';
import { PetitionAdapter } from '../gateway/petition.adapter';
import { RecordGateway } from '../gateway/record-gateway';
import type { RecordKind } from '../gateway/record-snapshot';
import { finishedStatuses, recordLink } from '../records/record-alert';
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

type Who = 'owner' | 'boss' | 'bossU' | 'member' | 'bareBoss';
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
    parties?: Array<{ team: 'T' | 'U'; role?: 'MAIN' | 'CHECK' }>;
  }

  /** A record with ONE step, written as rows. */
  const make = async (name: string, spec: Spec = {}): Promise<void> => {
    const { db } = scratch;
    const kind = spec.kind ?? 'PETITION';
    const n = ++counter;
    const code = `${tag}-${kind === 'PETITION' ? 'p' : 'i'}${n}`;
    const recordId =
      kind === 'PETITION'
        ? (await db.petition.create({ data: { stt: code, receivedDate: new Date('2026-12-01T00:00:00Z'), senderName: `${tag} sender ${n}`, loaiThongTin: 'Tố cáo', enteredById: id.owner, assignedTeamId: id.T, status: 'DANG_XU_LY', ...spec.over } as never })).id
        : (await db.incident.create({ data: { code, name: `${tag} incident ${n}`, loaiThongTin: 'Tố giác', investigatorId: id.owner, assignedTeamId: id.T, status: 'DANG_XAC_MINH', ...spec.over } as never })).id;
    rec[name] = { kind, id: recordId, code };
    const flow = await db.procRecordFlow.create({ data: { recordKind: kind, recordId, ...recordLink(kind, recordId), flowId: flowConfig.flowId, versionId: flowConfig.versionId, match: 'MANUAL', confirmed: spec.confirmed ?? true } });
    const due = spec.due === undefined ? RED : spec.due;
    await db.procRecordStep.create({
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
    permissions = await ensurePermissions(scratch, [...reads, 'approve:ProcessingStep']);
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
    for (const code of ['T', 'U', 'O']) id[code] = (await db.team.create({ data: { code: `${tag}-${code}`, name: `${tag} Tổ ${code}` } })).id;
    await db.userTeam.createMany({
      data: [
        { userId: id.owner, teamId: id.O },
        { userId: id.boss, teamId: id.T },
        { userId: id.member, teamId: id.T },
        { userId: id.bareBoss, teamId: id.T },
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
    // ---- for the search: two names that differ where a LIKE wildcard would not tell them apart
    await make('percent', { status: 'OPEN', config: 'plain', over: { senderName: `${tag} done 100% sure` } });
    await make('letter', { status: 'OPEN', config: 'plain', over: { senderName: `${tag} done 100x sure` } });
    await make('incident-open', { kind: 'INCIDENT', status: 'OPEN', config: 'plain', over: { name: `${tag} Mất Trộm xe` } });
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    const flows = { flowId: flowConfig.flowId };
    await db.procRecordStepParty.deleteMany({ where: { recordStep: { recordFlow: flows } } });
    await db.procRecordStep.deleteMany({ where: { recordFlow: flows } });
    await db.procRecordPause.deleteMany({ where: { recordFlow: flows } });
    await db.procRecordFlow.deleteMany({ where: flows });
    await db.procFlowStep.deleteMany({ where: { versionId: flowConfig.versionId } });
    await db.procFlowVersion.deleteMany({ where: { id: flowConfig.versionId } });
    await db.procFlow.deleteMany({ where: { id: flowConfig.flowId } });
    await db.petition.deleteMany({ where: { stt: { startsWith: tag } } });
    await db.incident.deleteMany({ where: { code: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await permissions?.dropCreated();
    await scratch.close();
  });

  describe('waiting for my approval', () => {
    it('lists the steps REPORTED that ask for approval, of the records in the person\'s OWN scope, for a person who may approve', async () => {
      expect(names(await waiting('boss'))).toEqual(['checked-by-U', 'no-deadline', 'reported']);
      // Not asked for, still open, only a proposal, paused, finished, suspended, deleted: none of the seven.
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
      const filters: Array<Record<string, unknown>> = [{}, { kind: 'INCIDENT' }, { kind: 'PETITION' }, { teamId: id.T }, { teamId: id.U }, { role: 'CHECK' }, { mine: true }, { from: '2026-12-02' }, { q: rec.reported.code }];
      for (const who of PEOPLE) {
        for (const filter of filters) {
          const summary = await tracking.summary(user(who), { asOf, ...filter });
          const rows = await waiting(who, { asOf: summary.asOf, ...filter });
          compared.push({ cell: `${who}/${JSON.stringify(filter)}`, number: summary.awaitingMyApproval, rows: rows.length });
        }
      }
      expect(compared.filter((cell) => cell.number !== cell.rows)).toEqual([]);
      expect(compared.find((cell) => cell.cell === 'boss/{}')).toMatchObject({ number: 3 });
      expect(compared.find((cell) => cell.cell === 'boss/{"kind":"INCIDENT"}')).toMatchObject({ number: 1 });
      expect(compared.find((cell) => cell.cell === `boss/{"q":"${rec.reported.code}"}`)).toMatchObject({ number: 1 });
      expect(compared.filter((cell) => cell.number > 0).length).toBeGreaterThanOrEqual(8);
    });

    it('is the rule of the decision route: the permission, and the gateway\'s own answer WITHOUT the step rule, row by row', async () => {
      const candidates = Object.entries(rec).filter(([name]) => ['reported', 'no-deadline', 'checked-by-U', 'of-U'].includes(name));
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
});
