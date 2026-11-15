import * as ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { UnitScopeService } from '../../auth/services/unit-scope.service';
import { ensurePermissions, openScratchDatabase, type EnsuredPermissions, type ScratchDatabase } from '../../common/testing/scratch-database';
import { TeamsService } from '../../teams/teams.service';
import { BANDS } from '../contract/processing-codes';
import { bandInstants } from '../engine/bands';
import type { RecordKind } from '../gateway/record-snapshot';
import { recordLink } from '../records/record-alert';
import { WORK_ROLES, type WorkRole } from './band-conditions';
import { DURATION_PAGE_SIZE, ProcessingBacklogService, ROLLED_UP_NOTE, type BacklogUnitRow } from './processing-backlog.service';
import { ProcessingTrackingService } from './processing-tracking.service';

/**
 * The backlog by unit on a REAL PostgreSQL: the number in every cell is the `total` of the list that cell opens, a
 * person sees only the units whose work they may read, and the on-time report follows the stored instants.
 *
 * Permissions by team are not enforced here (the scope rule itself is `ProcessingTrackingService.reach`, checked in
 * both modes by `processing-tracking.database.spec.ts`; this suite checks that the backlog goes through it).
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

if (process.env.DYN_REPORTS_DATABASE_REQUIRED === '1') {
  it('the database gate has a database to run against', () => {
    expect(url).toBeTruthy();
  });
}

type Who = 'owner' | 'member' | 'other' | 'unpermitted';
const T = { redDays: 1, yellowDays: 2, greenDays: 3 };
/** 10 December 2026, 10:00 in Vietnam. */
const NOW = new Date('2026-12-10T03:00:00.000Z');
const endOf = (day: number) => new Date(`2026-12-${String(day).padStart(2, '0')}T16:59:59.999Z`);
const DUE = { OVERDUE: endOf(8), RED: endOf(11), YELLOW: endOf(12), GREEN: endOf(13), NONE: endOf(25) };
const START = new Date('2026-12-01T00:00:00Z');

run('The backlog by unit on PostgreSQL', () => {
  jest.setTimeout(180_000);
  let scratch: ScratchDatabase;
  let tracking: ProcessingTrackingService;
  let backlog: ProcessingBacklogService;
  let permissions: EnsuredPermissions;
  const tag = `blg-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  const roleOf: Record<string, string> = {};
  let stepConfig = '';
  let flowConfig = { flowId: '', versionId: '' };
  let counter = 0;

  const user = (who: Who) => ({ id: id[who], role: roleOf[who], canDispatch: false });

  const record = async (kind: RecordKind, over: Record<string, unknown> = {}): Promise<string> => {
    const { db } = scratch;
    const n = ++counter;
    if (kind === 'PETITION') {
      return (await db.petition.create({ data: { stt: `${tag}-p${n}`, receivedDate: START, senderName: `${tag} sender ${n}`, loaiThongTin: 'Tố cáo', enteredById: id.owner, assignedTeamId: id.T, status: 'DANG_XU_LY', ...over } as never })).id;
    }
    return (await db.incident.create({ data: { code: `${tag}-i${n}`, name: `${tag} incident ${n}`, loaiThongTin: 'Tố giác', investigatorId: id.owner, assignedTeamId: id.T, status: 'DANG_XAC_MINH', ...over } as never })).id;
  };

  interface StepSpec {
    due: Date;
    status?: 'OPEN' | 'REPORTED' | 'DONE';
    startAt?: Date;
    doneAt?: Date;
    parties: Array<{ team: 'T' | 'U' | 'V'; role?: 'MAIN' | 'CHECK' | 'COORDINATE' | 'INFORM' }>;
  }

  const flowOn = async (kind: RecordKind, recordId: string, steps: StepSpec[]): Promise<void> => {
    const { db } = scratch;
    const flow = await db.procRecordFlow.create({ data: { recordKind: kind, recordId, ...recordLink(kind, recordId), flowId: flowConfig.flowId, versionId: flowConfig.versionId, match: 'MANUAL' } });
    for (const [order, spec] of steps.entries()) {
      await db.procRecordStep.create({
        data: {
          recordFlowId: flow.id,
          recordKind: kind,
          recordId,
          stepId: stepConfig,
          stepKey: `k${order + 1}`,
          order,
          status: spec.status ?? 'OPEN',
          startAt: spec.startAt ?? START,
          regulatoryDueAt: spec.due,
          internalDueAt: spec.due,
          ...bandInstants(spec.due, T),
          ...(spec.doneAt ? { doneAt: spec.doneAt } : {}),
          parties: { create: spec.parties.map((party, at) => ({ partyKind: 'TEAM', teamId: id[party.team], role: party.role ?? 'MAIN', order: at })) },
        },
      });
    }
  };

  const asOf = NOW.toISOString();
  const myTeams = () => new Set([id.T, id.U, id.V]);
  const unitsOf = async (who: Who, filter: Record<string, unknown> = {}) => {
    const table = await backlog.units(user(who), { asOf, ...filter });
    return { ...table, rows: table.rows.filter((row) => myTeams().has(row.teamId)) };
  };
  const brief = (row: BacklogUnitRow | undefined) => row && [row.holding, row.OVERDUE, row.RED, row.YELLOW, row.GREEN, row.NONE];
  const rowOf = (rows: BacklogUnitRow[], team: 'T' | 'U' | 'V') => rows.find((row) => row.teamId === id[team]);

  beforeAll(async () => {
    scratch = await openScratchDatabase(url as string);
    const { db } = scratch;
    const keys = ['read:Petition', 'read:Incident', 'read:Case'];
    permissions = await ensurePermissions(scratch, keys);
    const officer = await db.role.create({ data: { name: `${tag}-officer`, permissions: { create: keys.map((key) => ({ permissionId: permissions.ids[key] })) } } });
    const bare = await db.role.create({ data: { name: `${tag}-bare` } });
    const person = async (who: Who, role: { id: string; name: string }) => {
      roleOf[who] = role.name;
      id[who] = (await db.user.create({ data: { username: `${tag}-${who}`, passwordHash: 'x', roleId: role.id, isActive: true } })).id;
    };
    await person('owner', officer);
    await person('member', officer);
    await person('other', officer);
    await person('unpermitted', bare);

    // P is the unit above T. T holds every record; U and V are other units that steps name. V's name would be a formula.
    id.P = (await db.team.create({ data: { code: `${tag}-P`, name: `${tag} Đội P` } })).id;
    id.T = (await db.team.create({ data: { code: `${tag}-T`, name: `${tag} Tổ T`, parentId: id.P } })).id;
    id.U = (await db.team.create({ data: { code: `${tag}-U`, name: `${tag} Tổ U` } })).id;
    id.V = (await db.team.create({ data: { code: `${tag}-V`, name: `=${tag} V` } })).id;
    id.O = (await db.team.create({ data: { code: `${tag}-O`, name: `${tag} Tổ O` } })).id;
    await db.userTeam.createMany({
      data: [
        { userId: id.member, teamId: id.T },
        { userId: id.unpermitted, teamId: id.T },
        { userId: id.owner, teamId: id.O },
        { userId: id.other, teamId: id.U },
      ],
    });

    const flow = await db.procFlow.create({ data: { recordKind: 'PETITION', name: `${tag}-flow`, createdById: id.owner, updatedById: id.owner } });
    const version = await db.procFlowVersion.create({ data: { flowId: flow.id, versionNo: 1, status: 'PUBLISHED', createdById: id.owner } });
    flowConfig = { flowId: flow.id, versionId: version.id };
    stepConfig = (await db.procFlowStep.create({ data: { versionId: version.id, stepKey: 'k1', order: 0, name: `${tag} Verify`, durationValue: 5, durationUnit: 'DAY', anchor: 'RECEIVED', ...T } })).id;

    const prisma = db as never;
    const scopes = new UnitScopeService(prisma, new TeamsService(prisma, new AuditService(prisma), {} as never));
    tracking = new ProcessingTrackingService(prisma, scopes);
    tracking.now = () => NOW;
    backlog = new ProcessingBacklogService(prisma, tracking);

    // ---- the matrix (every record is held by T)
    // r1: overdue.
    await flowOn('PETITION', await record('PETITION'), [{ due: DUE.OVERDUE, parties: [{ team: 'T' }] }]);
    // r2: overdue, and a step DONE exactly at its deadline.
    await flowOn('PETITION', await record('PETITION'), [
      { due: DUE.OVERDUE, parties: [{ team: 'T' }] },
      { due: DUE.OVERDUE, status: 'DONE', doneAt: DUE.OVERDUE, parties: [{ team: 'T' }] },
    ]);
    // r3: red for T, which U checks.
    await flowOn('PETITION', await record('PETITION'), [{ due: DUE.RED, parties: [{ team: 'T' }, { team: 'U', role: 'CHECK' }] }]);
    // r4: two steps being worked on ONE record: two pieces of work, one record held.
    await flowOn('PETITION', await record('PETITION'), [
      { due: DUE.GREEN, parties: [{ team: 'T' }] },
      { due: DUE.YELLOW, status: 'REPORTED', parties: [{ team: 'T' }] },
    ]);
    // r5: not near its deadline, started in November; V coordinates, and is also only informed (never counted).
    await flowOn('PETITION', await record('PETITION'), [{ due: DUE.NONE, startAt: new Date('2026-11-01T00:00:00Z'), parties: [{ team: 'T' }, { team: 'V', role: 'COORDINATE' }, { team: 'V', role: 'INFORM' }] }]);
    // r6: an incident U works (yellow), with a step U finished late.
    await flowOn('INCIDENT', await record('INCIDENT'), [
      { due: DUE.YELLOW, parties: [{ team: 'U' }] },
      { due: endOf(5), status: 'DONE', doneAt: endOf(7), parties: [{ team: 'U' }] },
    ]);
    // r7: a step T finished one millisecond after its deadline; nothing open.
    await flowOn('PETITION', await record('PETITION'), [{ due: endOf(3), status: 'DONE', doneAt: new Date(endOf(3).getTime() + 1), parties: [{ team: 'T' }] }]);
    // Never counted: a deleted record, a suspended one.
    await flowOn('PETITION', await record('PETITION', { deletedAt: NOW }), [{ due: DUE.RED, parties: [{ team: 'T' }] }]);
    await flowOn('PETITION', await record('PETITION', { status: 'TAM_DINH_CHI' }), [{ due: DUE.RED, parties: [{ team: 'T' }] }]);
  });

  afterAll(async () => {
    if (!scratch) return;
    const { db } = scratch;
    const flows = { flowId: flowConfig.flowId };
    await db.procRecordStepParty.deleteMany({ where: { recordStep: { recordFlow: flows } } });
    await db.procRecordStep.deleteMany({ where: { recordFlow: flows } });
    // Not written here, but a worker of another suite on the shared database may pause a suspended record it finds.
    await db.procRecordPause.deleteMany({ where: { recordFlow: flows } });
    await db.procRecordFlow.deleteMany({ where: flows });
    await db.procFlowStep.deleteMany({ where: { versionId: flowConfig.versionId } });
    await db.procFlowVersion.deleteMany({ where: { id: flowConfig.versionId } });
    await db.procFlow.deleteMany({ where: { id: flowConfig.flowId } });
    await db.petition.deleteMany({ where: { stt: { startsWith: tag } } });
    await db.incident.deleteMany({ where: { code: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag }, parentId: { not: null } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await permissions?.dropCreated();
    await scratch.close();
  });

  describe('the units table', () => {
    it('one row per unit that works a step: records held, work per band, the oldest deadline, the unit above', async () => {
      const table = await unitsOf('member');
      expect(table.asOf).toBe(asOf);
      expect(table.rows.map((row) => row.teamId).sort()).toEqual([id.T, id.U].sort());
      // T: five records (r1..r5), six pieces of work.
      expect(rowOf(table.rows, 'T')).toEqual({ teamId: id.T, teamName: `${tag} Tổ T`, parentTeamId: id.P, holding: 5, OVERDUE: 2, RED: 1, YELLOW: 1, GREEN: 1, NONE: 1, oldestDueAt: DUE.OVERDUE.toISOString(), oldestDays: 2 });
      expect(rowOf(table.rows, 'U')).toEqual({ teamId: id.U, teamName: `${tag} Tổ U`, parentTeamId: null, holding: 1, OVERDUE: 0, RED: 0, YELLOW: 1, GREEN: 0, NONE: 0, oldestDueAt: DUE.YELLOW.toISOString(), oldestDays: 0 });
    });

    it('the totals add the band columns, and count each record once', async () => {
      // Unfiltered: exactly what the route answers. A member of T reaches the records of T only.
      const table = await backlog.units(user('member'), { asOf });
      expect(table.rows.every((row) => myTeams().has(row.teamId))).toBe(true);
      expect(table.totals).toEqual({ holding: 6, OVERDUE: 2, RED: 1, YELLOW: 2, GREEN: 1, NONE: 1 });
    });

    it('the role: CHECK and COORDINATE have tables of their own, INFORM is never work', async () => {
      const check = await unitsOf('member', { role: 'CHECK' });
      expect(check.rows.map((row) => [row.teamId, ...(brief(row) ?? [])])).toEqual([[id.U, 1, 0, 1, 0, 0, 0]]);
      const coordinate = await unitsOf('member', { role: 'COORDINATE' });
      expect(coordinate.rows.map((row) => [row.teamId, ...(brief(row) ?? [])])).toEqual([[id.V, 1, 0, 0, 0, 0, 1]]);
    });

    it('filters by kind, and by the period the step started in (a bare day is the civil day in Vietnam)', async () => {
      expect((await unitsOf('member', { kind: 'INCIDENT' })).rows.map((row) => row.teamId)).toEqual([id.U]);
      expect(brief(rowOf((await unitsOf('member', { from: '2026-12-01' })).rows, 'T'))).toEqual([4, 2, 1, 1, 1, 0]);
      expect(brief(rowOf((await unitsOf('member', { to: '2026-11-30' })).rows, 'T'))).toEqual([1, 0, 0, 0, 0, 1]);
      // 1 December 07:00 in Vietnam is when the December steps started: the day itself is inside `from` and `to`.
      expect(brief(rowOf((await unitsOf('member', { from: '2026-12-01', to: '2026-12-01' })).rows, 'T'))).toEqual([4, 2, 1, 1, 1, 0]);
    });

    it('the number in EVERY cell is the total of the list that cell opens, at the same instant', async () => {
      const cells: Array<{ cell: string; number: number; total: number }> = [];
      const filters: Array<Record<string, unknown>> = [{}, { from: '2026-12-01' }, { kind: 'PETITION' }];
      for (const who of ['member', 'other'] as Who[]) {
        for (const filter of filters) {
          for (const role of WORK_ROLES) {
            const table = await backlog.units(user(who), { asOf, role, ...filter });
            // Every unit of the suite, also the ones with no row (their cells are zero).
            for (const team of ['T', 'U', 'V'] as const) {
              const row = table.rows.find((found) => found.teamId === id[team]);
              let work = 0;
              for (const band of BANDS) {
                const list = await tracking.items(user(who), { asOf: table.asOf, teamId: id[team], band, role, pageSize: 100, ...filter });
                expect(list.items).toHaveLength(list.total);
                expect(list.items.every((item) => item.band === band && item.teamId === id[team])).toBe(true);
                cells.push({ cell: `${who}/${JSON.stringify(filter)}/${role}/${team}/${band}`, number: row?.[band] ?? 0, total: list.total });
                work += list.total;
              }
              // And the records held are the distinct records of those rows.
              const records = new Set<string>();
              for (const band of BANDS) {
                const list = await tracking.items(user(who), { asOf: table.asOf, teamId: id[team], band, role, pageSize: 100, ...filter });
                for (const item of list.items) records.add(item.recordId);
              }
              cells.push({ cell: `${who}/${JSON.stringify(filter)}/${role}/${team}/holding`, number: row?.holding ?? 0, total: records.size });
              expect(row === undefined).toBe(work === 0);
            }
          }
        }
      }
      expect(cells.filter((cell) => cell.number !== cell.total)).toEqual([]);
      // The matrix is not empty: the comparison compared something.
      expect(cells.filter((cell) => cell.number > 0).length).toBeGreaterThan(20);
    });

    it('the list of a cell takes the role and the band NONE', async () => {
      const none = await tracking.items(user('member'), { asOf, teamId: id.V, band: 'NONE', role: 'COORDINATE' });
      expect(none).toMatchObject({ band: 'NONE', total: 1 });
      expect(none.items[0]).toMatchObject({ band: 'NONE', teamId: id.V, remainingDays: 15 });
      // Without a role the list is the MAIN work, as before: V has none.
      expect((await tracking.items(user('member'), { asOf, teamId: id.V })).total).toBe(0);
    });
  });

  describe('who sees which unit', () => {
    it('a person of a unit a step names sees the work of that step only: no unit outside it', async () => {
      // `other` is in U. U works r6 (MAIN) and checks r3; the records are T's and outside their scope.
      const main = await unitsOf('other');
      expect(main.rows.map((row) => [row.teamId, ...(brief(row) ?? [])]).sort()).toEqual([[id.T, 1, 0, 1, 0, 0, 0], [id.U, 1, 0, 0, 1, 0, 0]].sort());
      expect(main.totals).toMatchObject({ holding: 2, OVERDUE: 0, RED: 1, YELLOW: 1 });
      // V's coordination is on a step that does not name U.
      expect((await unitsOf('other', { role: 'COORDINATE' })).rows).toEqual([]);
      expect((await unitsOf('other', { role: 'CHECK' })).rows.map((row) => row.teamId)).toEqual([id.U]);
    });

    it('a person whose role reads no kind of record sees no unit, even from inside the unit that holds the records', async () => {
      expect(await backlog.units(user('unpermitted'), { asOf })).toEqual({ asOf, rows: [], totals: { holding: 0, OVERDUE: 0, RED: 0, YELLOW: 0, GREEN: 0, NONE: 0 } });
      expect((await backlog.onTime(user('unpermitted'), { asOf })).rows).toEqual([]);
    });

    it('the on-time report and the export go through the same rule', async () => {
      const report = await backlog.onTime(user('other'), { asOf, from: '2026-12-01', to: '2026-12-31' });
      const mine = report.rows.filter((row) => myTeams().has(row.teamId));
      // The step T finished (r2, r7) is not a step that names U.
      expect(mine.map((row) => [row.teamId, row.doneOnTime, row.doneLate, row.openInTime, row.openOverdue]).sort()).toEqual([[id.T, 0, 0, 1, 0], [id.U, 0, 1, 1, 0]].sort());
    });
  });

  describe('on time, by unit and period', () => {
    it('done on time or late in the period, still open in time or overdue, the rate and the mean duration', async () => {
      const report = await backlog.onTime(user('member'), { asOf, from: '2026-12-01', to: '2026-12-31' });
      expect(report).toMatchObject({ asOf, from: '2026-11-30T17:00:00.000Z', to: '2026-12-31T16:59:59.999Z' });
      expect(report.rows.every((row) => myTeams().has(row.teamId))).toBe(true);
      // The rate counts against a unit the work that is overdue and not done: on time / (on time + late + open overdue).
      // T: r2 done EXACTLY at the deadline (on time), r7 one millisecond after it (late). 7.71 and 2.71 days of work.
      expect(report.rows.find((row) => row.teamId === id.T)).toEqual({ teamId: id.T, teamName: `${tag} Tổ T`, parentTeamId: id.P, doneOnTime: 1, doneLate: 1, openInTime: 4, openOverdue: 2, onTimeRate: 1 / (1 + 1 + 2), averageDays: 5.2 });
      expect(report.rows.find((row) => row.teamId === id.U)).toEqual({ teamId: id.U, teamName: `${tag} Tổ U`, parentTeamId: null, doneOnTime: 0, doneLate: 1, openInTime: 1, openOverdue: 0, onTimeRate: 0 / (0 + 1 + 0), averageDays: 6.7 });
      expect(report.totals).toEqual({ doneOnTime: 1, doneLate: 2, openInTime: 5, openOverdue: 2, onTimeRate: 1 / (1 + 2 + 2), averageDays: 5.7 });
    });

    it('the period is the day the step was DONE; a unit with nothing done and nothing overdue has no rate', async () => {
      const late = await backlog.onTime(user('member'), { asOf, from: '2026-12-08', to: '2026-12-31' });
      expect(late.rows.find((row) => row.teamId === id.T)).toMatchObject({ doneOnTime: 1, doneLate: 0, openOverdue: 2, onTimeRate: Math.round((1 / (1 + 0 + 2)) * 10_000) / 10_000, averageDays: 7.7 });
      expect(late.rows.find((row) => row.teamId === id.U)).toMatchObject({ doneOnTime: 0, doneLate: 0, openOverdue: 0, onTimeRate: null, averageDays: null, openInTime: 1 });
      const incidents = await backlog.onTime(user('member'), { asOf, kind: 'INCIDENT' });
      expect(incidents.rows.map((row) => row.teamId)).toEqual([id.U]);
    });
  });

  describe('the cost of a table', () => {
    it('reads no row of work for the units table or its export, and the on-time report reads durations a page at a time', async () => {
      const read = jest.spyOn(scratch.db.procRecordStepParty, 'findMany');
      try {
        await backlog.units(user('member'), { asOf });
        await backlog.unitsWorkbook(user('member'), { asOf, rollup: true });
        expect(read).not.toHaveBeenCalled();
        await backlog.onTime(user('member'), { asOf, from: '2026-12-01', to: '2026-12-31' });
        expect(read.mock.calls.length).toBeGreaterThan(0);
        for (const [args] of read.mock.calls) {
          expect((args as { take?: number }).take).toBe(DURATION_PAGE_SIZE);
          // Two instants and the unit: never the whole row.
          expect(Object.keys((args as { select: object }).select).sort()).toEqual(['id', 'recordStep', 'teamId']);
        }
      } finally {
        read.mockRestore();
      }
    });
  });

  describe('the export', () => {
    const sheetOf = async (who: Who, filter: Record<string, unknown> = {}) => {
      const { buffer } = await backlog.unitsWorkbook(user(who), { asOf, ...filter });
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as never);
      const rows: unknown[][] = [];
      workbook.worksheets[0].eachRow((row) => rows.push((row.values as unknown[]).slice(1)));
      return rows;
    };

    it('the table as filtered: a header, one line per unit, the totals', async () => {
      const rows = await sheetOf('member');
      expect(rows[0]).toEqual(['Đơn vị', 'Đang giữ (hồ sơ)', 'Quá hạn', 'Đỏ', 'Vàng', 'Xanh', 'Chưa tới ngưỡng', 'Hạn cũ nhất', 'Số ngày quá hạn']);
      expect(rows.slice(1)).toEqual([
        [`${tag} Tổ T`, 5, 2, 1, 1, 1, 1, DUE.OVERDUE.toISOString(), 2],
        [`${tag} Tổ U`, 1, 0, 0, 1, 0, 0, DUE.YELLOW.toISOString(), 0],
        ['Tổng cộng', 6, 2, 1, 2, 1, 1, '', ''],
      ]);
      expect((await sheetOf('member', { kind: 'INCIDENT' })).map((row) => row[0])).toEqual(['Đơn vị', `${tag} Tổ U`, 'Tổng cộng']);
    });

    it('rolled up, the file says so; units that stand alone keep their own exact figures', async () => {
      const rows = await sheetOf('member', { rollup: true });
      expect(rows.slice(1, 3)).toEqual([
        [`${tag} Tổ T`, 5, 2, 1, 1, 1, 1, DUE.OVERDUE.toISOString(), 2],
        [`${tag} Tổ U`, 1, 0, 0, 1, 0, 0, DUE.YELLOW.toISOString(), 0],
      ]);
      expect(rows[rows.length - 1]).toEqual([ROLLED_UP_NOTE]);
      const table = await backlog.units(user('member'), { asOf, rollup: true });
      expect(table.rows.map((row) => [row.teamId, row.descendants, row.holdingIsLowerBound])).toEqual([[id.T, 0, false], [id.U, 0, false]]);
    });

    it('a unit whose name would be a formula is written as text', async () => {
      const rows = await sheetOf('member', { role: 'COORDINATE' as WorkRole });
      expect(rows[1][0]).toBe(`'=${tag} V`);
    });
  });
});
