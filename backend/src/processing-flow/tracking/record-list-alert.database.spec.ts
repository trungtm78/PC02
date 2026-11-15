import type { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { CasesService } from '../../cases/cases.service';
import { SETTINGS_KEY } from '../../common/constants/settings-keys.constants';
import { ensurePermissions, openScratchDatabase, type EnsuredPermissions, type ScratchDatabase } from '../../common/testing/scratch-database';
import { IncidentsService } from '../../incidents/incidents.service';
import { PetitionsService } from '../../petitions/petitions.service';
import { TeamsService } from '../../teams/teams.service';
import { BANDS } from '../contract/processing-codes';
import { bandInstants } from '../engine/bands';
import type { Band } from '../engine/types';
import { CaseAdapter } from '../gateway/case.adapter';
import { IncidentAdapter } from '../gateway/incident.adapter';
import { PetitionAdapter } from '../gateway/petition.adapter';
import { RecordGateway } from '../gateway/record-gateway';
import type { RecordKind } from '../gateway/record-snapshot';
import { recordLink, refreshRecordAlert } from '../records/record-alert';
import { RecordListAlertService, type RecordAlert } from './record-list-alert.service';

/**
 * The alert column of the three lists on a REAL PostgreSQL: the colour of a row, the filter by colour, the order by
 * urgency, through `RecordListAlertService` and through `getList` of the three record services themselves, with the
 * switch on and off.
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

const T = { redDays: 1, yellowDays: 2, greenDays: 3 };
/** 10 December 2026, 10:00 in Vietnam. */
const NOW = new Date('2026-12-10T03:00:00.000Z');
const endOf = (day: number) => new Date(`2026-12-${String(day).padStart(2, '0')}T16:59:59.999Z`);
/** A date column: the calendar day at 00:00 UTC. */
const day = (d: number) => new Date(`2026-12-${String(d).padStart(2, '0')}T00:00:00.000Z`);

run('The alert column of the three lists on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let gateway: RecordGateway;
  let alerts: RecordListAlertService;
  let petitions: PetitionsService;
  let incidents: IncidentsService;
  let cases: CasesService;
  let permissions: EnsuredPermissions;
  let switchOn = true;
  let warnDays: string | null = '7';
  const tag = `rla-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  let flowConfig = { flowId: '', versionId: '' };
  const stepConfig: Record<string, string> = {};
  let counter = 0;
  const records: Record<string, { kind: RecordKind; id: string }> = {};

  /** The real client, except that the warning threshold is what this suite says (the row is the whole database's). */
  const withSetting = (client: PrismaClient): PrismaClient =>
    new Proxy(client, {
      get(target, property, receiver) {
        if (property !== 'systemSetting') return Reflect.get(target, property, receiver) as unknown;
        return new Proxy(target.systemSetting, {
          get(setting, method, settingReceiver) {
            if (method !== 'findUnique') return Reflect.get(setting, method, settingReceiver) as unknown;
            return (args: { where: { key: string } }) =>
              args.where.key === SETTINGS_KEY.CANH_BAO_SAP_HAN ? Promise.resolve(warnDays === null ? null : { value: warnDays }) : setting.findUnique(args as never);
          },
        });
      },
    });

  const record = async (name: string, kind: RecordKind, over: Record<string, unknown> = {}): Promise<string> => {
    const { db } = scratch;
    const n = ++counter;
    let recordId: string;
    if (kind === 'PETITION') {
      recordId = (await db.petition.create({ data: { stt: `${tag}-p${n}`, receivedDate: day(1), senderName: `${tag} ${name}`, loaiThongTin: 'Tố cáo', enteredById: id.actor, assignedTeamId: id.T, status: 'DANG_XU_LY', ...over } as never })).id;
    } else if (kind === 'INCIDENT') {
      recordId = (await db.incident.create({ data: { code: `${tag}-i${n}`, name: `${tag} ${name}`, loaiThongTin: 'Tố giác', investigatorId: id.actor, assignedTeamId: id.T, status: 'DANG_XAC_MINH', ngayDeXuat: day(1), ...over } as never })).id;
    } else {
      recordId = (await db.case.create({ data: { name: `${tag} ${name}`, caseCode: `${tag}-c${n}`, caseProvenance: 'DIRECT_DISCOVERY', investigatorId: id.actor, assignedTeamId: id.T, status: 'DANG_DIEU_TRA', ngayDeXuat: day(1), ...over } as never })).id;
    }
    records[name] = { kind, id: recordId };
    return recordId;
  };

  const flowOn = async (kind: RecordKind, recordId: string, steps: Array<{ name: 'Verify' | 'Answer'; due: Date; status?: 'OPEN' | 'REPORTED' | 'DONE' }>): Promise<void> => {
    const { db } = scratch;
    const flow = await db.procRecordFlow.create({ data: { recordKind: kind, recordId, ...recordLink(kind, recordId), flowId: flowConfig.flowId, versionId: flowConfig.versionId, match: 'MANUAL' } });
    for (const [order, spec] of steps.entries()) {
      await db.procRecordStep.create({
        data: {
          recordFlowId: flow.id,
          recordKind: kind,
          recordId,
          stepId: stepConfig[spec.name],
          stepKey: `k${order + 1}`,
          order,
          status: spec.status ?? 'OPEN',
          startAt: day(1),
          regulatoryDueAt: spec.due,
          internalDueAt: spec.due,
          ...bandInstants(spec.due, T),
          ...(spec.status === 'DONE' ? { doneAt: NOW } : {}),
          parties: { create: [{ partyKind: 'TEAM', teamId: id.T, role: 'MAIN', order: 0 }] },
        },
      });
    }
    await db.$transaction((tx) => refreshRecordAlert(tx, gateway, kind, recordId));
  };

  const idsOf = (kind: RecordKind) => Object.values(records).filter((r) => r.kind === kind).map((r) => r.id);
  const nameOf = (recordId: string) => Object.keys(records).find((name) => records[name].id === recordId) ?? `?${recordId}`;
  const alertOf = async (name: string): Promise<RecordAlert | null> => (await alerts.forRecords(records[name].kind, [records[name].id], NOW)).get(records[name].id) ?? null;
  const ownRows = <R extends { id: string }>(rows: R[]) => rows.filter((row) => Object.values(records).some((r) => r.id === row.id));

  beforeAll(async () => {
    scratch = await openScratchDatabase(url as string);
    const { db } = scratch;
    permissions = await ensurePermissions(scratch, ['read:Case']);
    id.role = (await db.role.create({ data: { name: `${tag}-role`, permissions: { create: [{ permissionId: permissions.ids['read:Case'] }] } } })).id;
    id.actor = (await db.user.create({ data: { username: `${tag}-actor`, passwordHash: 'x', roleId: id.role, isActive: true } })).id;
    id.T = (await db.team.create({ data: { code: `${tag}-T`, name: `${tag} Tổ T` } })).id;
    await db.userTeam.create({ data: { userId: id.actor, teamId: id.T } });

    const flow = await db.procFlow.create({ data: { recordKind: 'PETITION', name: `${tag}-flow`, createdById: id.actor, updatedById: id.actor } });
    const version = await db.procFlowVersion.create({ data: { flowId: flow.id, versionNo: 1, status: 'PUBLISHED', createdById: id.actor } });
    flowConfig = { flowId: flow.id, versionId: version.id };
    for (const [order, name] of ['Verify', 'Answer'].entries()) {
      stepConfig[name] = (await db.procFlowStep.create({ data: { versionId: version.id, stepKey: `k${order + 1}`, order, name, durationValue: 5, durationUnit: 'DAY', anchor: 'RECEIVED', ...T } })).id;
    }

    const prisma = withSetting(db) as never;
    const audit = new AuditService(prisma);
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, audit, {} as never));
    gateway = new RecordGateway(new PetitionAdapter(prisma, scopes), new IncidentAdapter(prisma, scopes), new CaseAdapter(prisma, scopes));
    alerts = new RecordListAlertService(prisma, { isEnabled: () => Promise.resolve(switchOn) } as never);
    alerts.now = () => NOW;
    // The lists apply the configured statistics period; this suite reads every period.
    const settings = { getKyThongKe: () => Promise.resolve({ ky: 'TAT_CA', truong: 'NGAY_TIEP_NHAN', tuNgay: null, denNgay: null }) } as never;
    const noEvents = { emit: () => false } as never;
    petitions = new PetitionsService(prisma, audit, settings, {} as never, {} as never, noEvents, {} as never, {} as never, {} as never, undefined, undefined, undefined, undefined, alerts);
    incidents = new IncidentsService(prisma, audit, settings, {} as never, {} as never, noEvents, {} as never, {} as never, undefined, undefined, undefined, undefined, alerts);
    cases = new CasesService(prisma, audit, settings, {} as never, noEvents, undefined, undefined, undefined, undefined, undefined, alerts);

    // ---- petitions with a flow
    await flowOn('PETITION', await record('flow-red', 'PETITION', { deadline: day(30) }), [{ name: 'Answer', due: endOf(13) }, { name: 'Verify', due: endOf(11) }]);
    await flowOn('PETITION', await record('flow-overdue', 'PETITION'), [{ name: 'Verify', due: endOf(8), status: 'REPORTED' }]);
    await flowOn('PETITION', await record('flow-far', 'PETITION'), [{ name: 'Verify', due: endOf(25) }]);
    // Its own deadline has passed, but it has a flow and no step of it counts: no alert, not the record's deadline.
    await flowOn('PETITION', await record('flow-done', 'PETITION', { deadline: day(1) }), [{ name: 'Verify', due: endOf(8), status: 'DONE' }]);
    // Finished AFTER its alert was stored, and nobody reconciled: the stored alert still says red.
    const finished = await record('flow-finished-stale', 'PETITION');
    await flowOn('PETITION', finished, [{ name: 'Verify', due: endOf(11) }]);
    await scratch.db.petition.update({ where: { id: finished }, data: { status: 'DA_GIAI_QUYET' } });
    // ---- petitions without a flow: their own deadline, a calendar day
    await record('own-overdue', 'PETITION', { deadline: day(9) });
    await record('own-today', 'PETITION', { deadline: day(10) });
    await record('own-week', 'PETITION', { deadline: day(17) });
    await record('own-far', 'PETITION', { deadline: day(18) });
    await record('own-none', 'PETITION', { deadline: null });
    await record('own-suspended', 'PETITION', { deadline: day(9), status: 'TAM_DINH_CHI' });
    // ---- an incident and a case of each source
    await flowOn('INCIDENT', await record('I-flow-yellow', 'INCIDENT'), [{ name: 'Verify', due: endOf(12) }]);
    await record('I-own-overdue', 'INCIDENT', { deadline: day(9) });
    await flowOn('CASE', await record('C-flow-green', 'CASE'), [{ name: 'Verify', due: endOf(13) }]);
    await record('C-own-today', 'CASE', { deadline: day(10) });
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    const flows = { flowId: flowConfig.flowId };
    await db.procRecordStepParty.deleteMany({ where: { recordStep: { recordFlow: flows } } });
    await db.procRecordStep.deleteMany({ where: { recordFlow: flows } });
    await db.procRecordFlow.deleteMany({ where: flows });
    await db.procFlowStep.deleteMany({ where: { versionId: flowConfig.versionId } });
    await db.procFlowVersion.deleteMany({ where: { id: flowConfig.versionId } });
    await db.procFlow.deleteMany({ where: { id: flowConfig.flowId } });
    await db.petition.deleteMany({ where: { stt: { startsWith: tag } } });
    await db.incident.deleteMany({ where: { code: { startsWith: tag } } });
    await db.case.deleteMany({ where: { name: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { userId: id.actor } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { id: id.actor } });
    await db.role.deleteMany({ where: { id: id.role } });
    await permissions?.dropCreated();
    await scratch.close();
  });

  beforeEach(async () => {
    switchOn = true;
    warnDays = '7';
    await alerts.refresh();
  });

  describe('the alert of a row', () => {
    it('a record with a flow shows the worst colour among its steps being worked, and the step it comes from', async () => {
      expect(await alertOf('flow-red')).toEqual({ source: 'FLOW', band: 'RED', remainingDays: 1, stepName: 'Verify', dueAt: endOf(11).toISOString() });
      expect(await alertOf('flow-overdue')).toEqual({ source: 'FLOW', band: 'OVERDUE', remainingDays: -2, stepName: 'Verify', dueAt: endOf(8).toISOString() });
      expect(await alertOf('flow-far')).toMatchObject({ source: 'FLOW', band: 'NONE', remainingDays: 15 });
    });

    it('a record with a flow and no step being worked has no alert: its own deadline is not shown in its place', async () => {
      expect(await alertOf('flow-done')).toBeNull();
    });

    it('a record with no flow shows its own deadline: overdue after the day, red on the day, yellow within the warning days', async () => {
      expect(await alertOf('own-overdue')).toEqual({ source: 'RECORD_DEADLINE', band: 'OVERDUE', remainingDays: -1, stepName: null, dueAt: endOf(9).toISOString() });
      expect(await alertOf('own-today')).toMatchObject({ source: 'RECORD_DEADLINE', band: 'RED', remainingDays: 0 });
      expect(await alertOf('own-week')).toMatchObject({ source: 'RECORD_DEADLINE', band: 'YELLOW', remainingDays: 7 });
      expect(await alertOf('own-far')).toMatchObject({ source: 'RECORD_DEADLINE', band: 'NONE', remainingDays: 8 });
      expect(await alertOf('own-none')).toBeNull();
    });

    it('a finished or suspended record has no alert, even while the stored alert of its flow has not been reconciled', async () => {
      const stale = await scratch.db.procRecordFlow.findFirstOrThrow({ where: { recordId: records['flow-finished-stale'].id } });
      expect(stale.alertDueAt).not.toBeNull();
      expect(await alertOf('flow-finished-stale')).toBeNull();
      expect(await alertOf('own-suspended')).toBeNull();
    });

    it('the warning days come from the setting of the old reminder; a value that is not a number of days falls back to 7', async () => {
      warnDays = '3';
      await alerts.refresh();
      expect(alerts.thresholds()).toEqual({ redDays: 0, yellowDays: 3, greenDays: 3 });
      expect(await alertOf('own-week')).toMatchObject({ band: 'NONE' });
      for (const broken of ['soon', '-1', null]) {
        warnDays = broken;
        await alerts.refresh();
        expect(alerts.thresholds()).toEqual({ redDays: 0, yellowDays: 7, greenDays: 7 });
      }
    });

    it('a page costs one query whatever its length, and an id that is not a record of the kind has no alert', async () => {
      const found = await alerts.forRecords('PETITION', [...idsOf('PETITION'), 'no-such-record'], NOW);
      expect(found.size).toBe(idsOf('PETITION').length + 1);
      expect(found.get('no-such-record')).toBeNull();
    });
  });

  describe('the filter and the order', () => {
    it('each band finds exactly the records whose alert shows that band; a record with no alert is in none (same instant)', async () => {
      for (const kind of ['PETITION', 'INCIDENT', 'CASE'] as const) {
        const shown = await alerts.forRecords(kind, idsOf(kind), NOW);
        const model = kind === 'PETITION' ? scratch.db.petition : kind === 'INCIDENT' ? scratch.db.incident : scratch.db.case;
        const found = {} as Record<Band, string[]>;
        for (const band of BANDS) {
          const rows = await (model as typeof scratch.db.petition).findMany({ where: { AND: [{ id: { in: idsOf(kind) } }, alerts.where(kind, band, NOW)] }, select: { id: true } });
          found[band] = rows.map((row) => nameOf(row.id)).sort();
        }
        const expected = {} as Record<Band, string[]>;
        for (const band of BANDS) expected[band] = idsOf(kind).filter((recordId) => shown.get(recordId)?.band === band).map(nameOf).sort();
        expect({ kind, found }).toEqual({ kind, found: expected });
      }
      // And the table is not empty: every band holds something.
      const petitionBands = [...(await alerts.forRecords('PETITION', idsOf('PETITION'), NOW)).values()].flatMap((alert) => (alert ? [alert.band] : []));
      expect(new Set(petitionBands)).toEqual(new Set(['OVERDUE', 'RED', 'YELLOW', 'NONE']));
    });

    it('the order by urgency: records with a flow by their earliest step deadline, then the others by their own, none last', async () => {
      const rows = await scratch.db.petition.findMany({ where: { id: { in: idsOf('PETITION') } }, orderBy: alerts.orderBy('asc') as never, select: { id: true } });
      const order = rows.map((row) => nameOf(row.id));
      expect(order.slice(0, 4)).toEqual(['flow-overdue', 'flow-red', 'flow-finished-stale', 'flow-far']);
      // A flow with no step that counts has no stored alert: it is ordered with the others, by its own deadline.
      expect(order[4]).toBe("flow-done");
      expect(order.indexOf('own-overdue')).toBeLessThan(order.indexOf('own-today'));
      expect(order.indexOf('own-today')).toBeLessThan(order.indexOf('own-week'));
      expect(order[order.length - 1]).toBe('own-none');
    });
  });

  describe('getList of the three record services', () => {
    const asOf = NOW.toISOString();
    const lists = {
      PETITION: (query: Record<string, unknown>) => petitions.getList({ limit: 100, offset: 0, ...query } as never, null),
      INCIDENT: (query: Record<string, unknown>) => incidents.getList({ limit: 100, offset: 0, ...query } as never, null),
      CASE: (query: Record<string, unknown>) => cases.getList({ limit: 100, offset: 0, ...query } as never, null, id.actor),
    };
    type Listed = { id: string; alert?: RecordAlert | null };
    const listed = async (kind: RecordKind, query: Record<string, unknown>) => {
      const answer = (await lists[kind](query)) as unknown as { data: Listed[]; total: number; alertAsOf?: string };
      return { ...answer, own: ownRows(answer.data) };
    };

    it.each(['PETITION', 'INCIDENT', 'CASE'] as const)('%s: while the switch is off nothing is added: no alert on a row, no instant, and the alert parameters change nothing', async (kind) => {
      switchOn = false;
      await alerts.refresh();
      expect(alerts.clock()).toBeNull();
      const plain = await listed(kind, {});
      const asked = await listed(kind, { alertBand: 'RED', alertAsOf: asOf });
      // `sortBy=alert` is then a column the list does not know, ordered exactly as any other unknown one.
      const sorted = await listed(kind, { sortBy: 'alert', sortOrder: 'asc' });
      const unknown = await listed(kind, { sortBy: 'not-a-column', sortOrder: 'asc' });
      expect(sorted.data.map((row) => row.id)).toEqual(unknown.data.map((row) => row.id));
      for (const answer of [plain, asked, sorted]) {
        expect(answer.own.length).toBe(idsOf(kind).length);
        expect('alertAsOf' in answer).toBe(false);
        expect(answer.own.filter((row) => 'alert' in row)).toEqual([]);
      }
      expect(asked.total).toBe(plain.total);
      expect(asked.data.map((row) => row.id)).toEqual(plain.data.map((row) => row.id));
    });

    it.each(['PETITION', 'INCIDENT', 'CASE'] as const)('%s: with the switch on every row carries its alert, judged at the instant the answer names', async (kind) => {
      const answer = await listed(kind, {});
      expect(answer.alertAsOf).toBe(asOf);
      const expected = await alerts.forRecords(kind, idsOf(kind), NOW);
      expect(Object.fromEntries(answer.own.map((row) => [nameOf(row.id), row.alert]))).toEqual(Object.fromEntries(idsOf(kind).map((recordId) => [nameOf(recordId), expected.get(recordId)])));
      expect(answer.own.some((row) => row.alert?.source === 'FLOW')).toBe(true);
      expect(answer.own.some((row) => row.alert?.source === 'RECORD_DEADLINE')).toBe(true);
    });

    it('filters by band and counts what it lists; the instant passed back is the instant used', async () => {
      const overdue = await listed('PETITION', { alertBand: 'OVERDUE', alertAsOf: asOf });
      expect(overdue.own.map((row) => nameOf(row.id)).sort()).toEqual(['flow-overdue', 'own-overdue']);
      expect(overdue.data.every((row) => row.alert?.band === 'OVERDUE')).toBe(true);
      expect(overdue.total).toBe(overdue.data.length);
      // One millisecond after the red step's deadline, at the instant the screen passes back, it is overdue as well.
      const later = await listed('PETITION', { alertBand: 'OVERDUE', alertAsOf: new Date(endOf(11).getTime() + 1).toISOString() });
      expect(later.alertAsOf).toBe('2026-12-11T17:00:00.000Z');
      expect(later.own.map((row) => nameOf(row.id))).toEqual(expect.arrayContaining(['flow-red', 'own-today']));
      expect((await listed('INCIDENT', { alertBand: 'YELLOW' })).own.map((row) => nameOf(row.id))).toEqual(['I-flow-yellow']);
      expect((await listed('CASE', { alertBand: 'GREEN' })).own.map((row) => nameOf(row.id))).toEqual(['C-flow-green']);
      expect((await listed('CASE', { alertBand: 'RED' })).own.map((row) => nameOf(row.id))).toEqual(['C-own-today']);
    });

    it('sorts by urgency when asked to', async () => {
      const sorted = await listed('PETITION', { sortBy: 'alert', sortOrder: 'asc' });
      const order = sorted.own.map((row) => nameOf(row.id));
      expect(order.indexOf('flow-overdue')).toBeLessThan(order.indexOf('flow-red'));
      expect(order.indexOf('flow-red')).toBeLessThan(order.indexOf('flow-far'));
      expect(order.indexOf('flow-far')).toBeLessThan(order.indexOf('own-overdue'));
      expect(order.indexOf('own-overdue')).toBeLessThan(order.indexOf('own-week'));
    });
  });
});
