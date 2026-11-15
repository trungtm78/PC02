import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { escapeXlsxCell } from '../../common/utils/xlsx-formula-escape.util';
import { PrismaService } from '../../prisma/prisma.service';
import { remainingDays } from '../engine/bands';
import { BANDS } from '../contract/processing-codes';
import type { Band } from '../engine/types';
import { RECORD_KINDS, type GatewayUser, type RecordKind } from '../gateway/record-snapshot';
import { clocklessStatuses } from '../records/record-alert';
import { rollUpUnits } from './backlog-rollup';
import type { WorkRole } from './band-conditions';
import { TRACKING_DEFAULT_PAGE_SIZE, TRACKING_MAX_PAGE_SIZE } from './dto/tracking.dto';
import { ANY_WORK, periodOf, ProcessingTrackingService, type TrackingFilter } from './processing-tracking.service';

export type BacklogFilter = Pick<TrackingFilter, 'asOf' | 'kind' | 'role' | 'from' | 'to'> & {
  /** The table rolled up to its top units (`rollUpUnits`): what the screen shows with "Gộp lên tổ cha" on. */
  rollup?: boolean;
  /** Only this unit; with `rollup`, the unit and every unit under it. */
  teamId?: string;
};

type KindCounts = Record<RecordKind, number>;
const zeroKinds = (): KindCounts => ({ PETITION: 0, INCIDENT: 0, CASE: 0 });

/**
 * THE condition of a record that has NO FLOW YET (R6, the column "Chưa áp quy trình"): an OPEN record (not deleted,
 * not finished, not suspended) of one kind, within `inScope` (the person's own record scope, as the list of that kind
 * applies it: `ProcessingTrackingService.recordScopes`), held by a unit (`assignedTeamId`), with no flow at all (a
 * proposed flow is a flow: it is counted apart on the tracking screen). The number of a unit and the list behind it
 * (`ProcessingBacklogService.unapplied`) are both this condition and nothing else. No clock is asked: nothing in it
 * depends on the instant. The role and the period of the table do not apply (they are about steps; there is none).
 */
export function unappliedWhere(kind: RecordKind, inScope: object, teamIds: readonly string[] | null): Record<string, unknown> {
  return { AND: [inScope, { deletedAt: null, status: { notIn: clocklessStatuses(kind) }, procFlow: { is: null }, assignedTeamId: teamIds ? { in: [...teamIds] } : { not: null } }] };
}

/** A record with no flow yet, as the list behind a number of the column shows it. */
export interface UnappliedRecord {
  recordKind: RecordKind;
  recordId: string;
  recordCode: string | null;
  /** The name next to the code on the list; `null` for a case (its fields have a policy of their own). */
  recordLabel: string | null;
  /** The record's own deadline, the one it shows while it has no flow; `null` without one, and for a case. */
  deadline: string | null;
}

export interface UnappliedRecords {
  kind: RecordKind;
  teamId: string;
  items: UnappliedRecord[];
  total: number;
  page: number;
  pageSize: number;
}

type BandCounts = Record<Band, number>;

export interface BacklogUnitRow extends BandCounts {
  teamId: string;
  teamName: string;
  /** The unit above, for the screen to roll up; `null` at the top. */
  parentTeamId: string | null;
  /** How many distinct RECORDS have a step this unit is working. */
  holding: number;
  /** Open records this unit HOLDS (`assignedTeamId`) that have no flow yet (`unappliedWhere`), in all and per kind. */
  unapplied: number;
  unappliedByKind: KindCounts;
  /** The earliest deadline among the unit's work; `null` when none of it has a deadline. */
  oldestDueAt: string | null;
  /** Civil days (Vietnam) that deadline is past at `asOf`; 0 while it is not past; `null` with `oldestDueAt`. */
  oldestDays: number | null;
  /** Only on a rolled-up table: the units summed into this row besides itself. */
  descendants?: number;
  /** Only on a rolled-up table: `holding` is a lower bound of the group (records do not add up across units). */
  holdingIsLowerBound?: boolean;
}

export interface BacklogUnits {
  /** The instant the table was judged at: pass it back as `asOf` when opening the rows of a cell. */
  asOf: string;
  rows: BacklogUnitRow[];
  /** The band columns add up; `holding` is the number of distinct records over all units (a record two units work is one). */
  totals: BandCounts & { holding: number; unapplied: number };
}

export interface OnTimeRow {
  teamId: string;
  teamName: string;
  parentTeamId: string | null;
  doneOnTime: number;
  doneLate: number;
  openInTime: number;
  openOverdue: number;
  /**
   * doneOnTime / (doneOnTime + doneLate + openOverdue), 0..1: work that is overdue and not done counts against the unit.
   * `null` when nothing was done in the period and nothing is overdue.
   */
  onTimeRate: number | null;
  /** Mean of (doneAt - startAt) in days over the work done in the period, one decimal; `null` when none. */
  averageDays: number | null;
}

export interface OnTimeReport {
  asOf: string;
  from: string | null;
  to: string | null;
  rows: OnTimeRow[];
  totals: Omit<OnTimeRow, 'teamId' | 'teamName' | 'parentTeamId'>;
}

const zeroBands = (): BandCounts => ({ OVERDUE: 0, RED: 0, YELLOW: 0, GREEN: 0, NONE: 0 });
const MS_PER_DAY = 86_400_000;
const round1 = (value: number) => Math.round(value * 10) / 10;
/** How many units are asked about at once: the queries of a table are bounded by its units, never by its work. */
const UNITS_AT_ONCE = 8;
/** The rows of one page when durations are read: the report holds one page at a time, whatever the size of the period. */
export const DURATION_PAGE_SIZE = 1000;

/** The note under a rolled-up sheet: a reader of the file alone must know the figures are sums. */
export const ROLLED_UP_NOTE =
  'Số liệu đã gộp lên tổ cha: các cột cảnh báo là tổng của tổ cha và các tổ con. Cột "Đang giữ" ghi "≥" vì một hồ sơ có thể do hai tổ cùng giữ nên không cộng được.';

/**
 * The lines under the header of the exported sheet: what the screen shows, line for line. Rolled up, a group's
 * `holding` is written as the text "≥ N" and a note says the figures are sums. Unit names are escaped against formulas.
 */
export function backlogSheetLines(table: BacklogUnits, rolledUp: boolean): Array<Array<string | number>> {
  const lines: Array<Array<string | number>> = table.rows.map((row) => [
    escapeXlsxCell(row.teamName),
    row.holdingIsLowerBound ? `≥ ${row.holding}` : row.holding,
    ...BANDS.map((band) => row[band]),
    row.unapplied,
    row.oldestDueAt ?? '',
    row.oldestDays ?? '',
  ]);
  lines.push(['Tổng cộng', table.totals.holding, ...BANDS.map((band) => table.totals[band]), table.totals.unapplied, '', '']);
  if (rolledUp) lines.push([ROLLED_UP_NOTE]);
  return lines;
}

/** The column titles of the exported sheet are fixed labels of a document, as in the other exports of the system. */
const EXPORT_COLUMNS: Array<{ header: string; key: keyof BacklogUnitRow; width: number }> = [
  { header: 'Đơn vị', key: 'teamName', width: 36 },
  { header: 'Đang giữ (hồ sơ)', key: 'holding', width: 16 },
  { header: 'Quá hạn', key: 'OVERDUE', width: 12 },
  { header: 'Đỏ', key: 'RED', width: 10 },
  { header: 'Vàng', key: 'YELLOW', width: 10 },
  { header: 'Xanh', key: 'GREEN', width: 10 },
  { header: 'Chưa tới ngưỡng', key: 'NONE', width: 16 },
  { header: 'Chưa áp quy trình', key: 'unapplied', width: 18 },
  { header: 'Hạn cũ nhất', key: 'oldestDueAt', width: 22 },
  { header: 'Số ngày quá hạn', key: 'oldestDays', width: 16 },
];

/**
 * The backlog by unit ("Tồn đọng theo đơn vị") and the on-time report by unit and period.
 *
 * Nothing here decides who sees what or what a piece of work is: both come from `ProcessingTrackingService`
 * (`reach`, `workWhere`). A cell of the table is `workWhere` for one unit and one band at `asOf`, which is exactly the
 * condition of `GET /processing/tracking/items?teamId=&band=&role=&asOf=` (+ the same kind / from / to): the number in
 * the cell is the `total` of that list.
 *
 * Units of counting: `holding` counts RECORDS (distinct), the band columns count WORK (step x party of the role),
 * `unapplied` counts RECORDS with no flow by the unit that holds them (`unappliedWhere`; its list is `unapplied()`).
 */
@Injectable()
export class ProcessingBacklogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracking: ProcessingTrackingService,
  ) {}

  async units(user: GatewayUser, filter: BacklogFilter): Promise<BacklogUnits> {
    const asOf = this.tracking.instant(filter.asOf);
    const empty: BacklogUnits = { asOf: asOf.toISOString(), rows: [], totals: { ...zeroBands(), holding: 0, unapplied: 0 } };
    // The same reach as the tracking list a cell opens: the steps a delegation gives the person count here too.
    const acting = await this.tracking.acting(user);
    const reach = await this.tracking.reach(user, filter.kind, acting);
    if (!reach) return empty;

    const rows = new Map<string, BacklogUnitRow>();
    const row = (teamId: string): BacklogUnitRow => {
      let found = rows.get(teamId);
      if (!found) {
        found = { teamId, teamName: '', parentTeamId: null, holding: 0, unapplied: 0, unappliedByKind: zeroKinds(), ...zeroBands(), oldestDueAt: null, oldestDays: null };
        rows.set(teamId, found);
      }
      return found;
    };
    const only = await this.unitsOfFilter(filter);
    const ofAUnit: Prisma.ProcRecordStepPartyWhereInput = { teamId: only ? { in: only } : { not: null } };
    // The unit filter is `ofAUnit` (one unit, or it and the units under it): `workWhere` is asked without a unit.
    const work: BacklogFilter = { ...filter, teamId: undefined };

    // The band columns: the count of the SAME condition the list of a cell uses, grouped by unit.
    for (const band of BANDS) {
      const groups = await this.prisma.procRecordStepParty.groupBy({ by: ['teamId'], where: { AND: [this.tracking.workWhere(user, work, reach, band, asOf, acting), ofAUnit] }, _count: { _all: true } });
      for (const group of groups) if (group.teamId) row(group.teamId)[band] = group._count._all;
    }

    // "Holding" and the oldest deadline: every piece of work of the unit, whatever its band. Both are computed by
    // PostgreSQL, per unit: no row of work is read here, so the table costs the same whatever the size of the backlog.
    const everyWork: Prisma.ProcRecordStepPartyWhereInput = { AND: [this.tracking.workWhere(user, work, reach, ANY_WORK, asOf, acting), ofAUnit] };
    const working = await this.prisma.procRecordStepParty.groupBy({ by: ['teamId'], where: everyWork, _count: { _all: true } });
    for (const group of working) if (group.teamId) row(group.teamId);

    // "No flow yet": the open records each unit holds that carry no flow, under the person's OWN record scope (there is
    // no step to reach them by). One grouped count per kind over the record table; no row is read.
    const scopes = await this.tracking.recordScopes(user, filter.kind);
    for (const kind of RECORD_KINDS) {
      const scope = scopes[kind];
      if (!scope) continue;
      for (const group of await this.unappliedByUnit(kind, unappliedWhere(kind, scope.inScope, only))) {
        const found = row(group.teamId);
        found.unappliedByKind[kind] = group.count;
        found.unapplied += group.count;
      }
    }
    const workOf = (teamId: string): Prisma.ProcRecordStepPartyWhereInput => ({ AND: [everyWork, { teamId }] });
    const held = new Map<string, number>();
    const oldest = new Map<string, Date>();
    const unitIds = [...rows.keys()];
    for (let at = 0; at < unitIds.length; at += UNITS_AT_ONCE) {
      await Promise.all(
        unitIds.slice(at, at + UNITS_AT_ONCE).map(async (teamId) => {
          const [records, due] = await Promise.all([
            // Distinct records: the flows with at least one step this unit works.
            this.prisma.procRecordFlow.count({ where: { steps: { some: { parties: { some: workOf(teamId) } } } } }),
            this.prisma.procRecordStep.aggregate({ where: { parties: { some: workOf(teamId) } }, _min: { internalDueAt: true } }),
          ]);
          held.set(teamId, records);
          if (due._min.internalDueAt) oldest.set(teamId, due._min.internalDueAt);
        }),
      );
    }
    // A record two units work is ONE record of the table.
    const everyRecord = await this.prisma.procRecordFlow.count({ where: { steps: { some: { parties: { some: everyWork } } } } });

    const teams = await this.teamsOf([...rows.keys()]);
    const totals = { ...zeroBands(), holding: everyRecord, unapplied: 0 };
    for (const found of rows.values()) {
      const team = teams.get(found.teamId);
      found.teamName = team?.name ?? '';
      found.parentTeamId = team?.parentId ?? null;
      found.holding = held.get(found.teamId) ?? 0;
      const due = oldest.get(found.teamId);
      if (due) {
        found.oldestDueAt = due.toISOString();
        found.oldestDays = due.getTime() < asOf.getTime() ? Math.max(-remainingDays(asOf, due), 0) : 0;
      }
      for (const band of BANDS) totals[band] += found[band];
      totals.unapplied += found.unapplied;
    }
    // A unit all of whose work vanished between the queries has nothing to show; one that only holds records with no
    // flow is shown.
    const shown = [...rows.values()].filter((found) => found.holding > 0 || found.unapplied > 0 || BANDS.some((band) => found[band] > 0));
    shown.sort((a, b) => a.teamName.localeCompare(b.teamName, 'vi') || a.teamId.localeCompare(b.teamId));
    return { asOf: asOf.toISOString(), rows: filter.rollup ? rollUpUnits(shown) : shown, totals };
  }

  /**
   * The records ONE number of the column "Chưa áp quy trình" counts (a unit, a kind): `unappliedWhere`, the very
   * condition `units` groups by unit, so `total` here is that number at the same moment. The most urgent first (the
   * record's own deadline, the one it shows while it has no flow), the id settling ties.
   */
  async unapplied(user: GatewayUser, filter: { kind: RecordKind; teamId: string; page?: number; pageSize?: number }): Promise<UnappliedRecords> {
    const page = Math.max(filter.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filter.pageSize ?? TRACKING_DEFAULT_PAGE_SIZE, 1), TRACKING_MAX_PAGE_SIZE);
    const answer: UnappliedRecords = { kind: filter.kind, teamId: filter.teamId, items: [], total: 0, page, pageSize };
    const scope = (await this.tracking.recordScopes(user, filter.kind))[filter.kind];
    if (!scope) return answer;
    const where = unappliedWhere(filter.kind, scope.inScope, [filter.teamId]) as never;
    const paging = { where, orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }] as never, skip: (page - 1) * pageSize, take: pageSize };
    const day = (deadline: Date | null) => deadline?.toISOString() ?? null;
    if (filter.kind === 'PETITION') {
      const [rows, total] = await Promise.all([this.prisma.petition.findMany({ ...paging, select: { id: true, stt: true, senderName: true, deadline: true } }), this.prisma.petition.count({ where })]);
      return { ...answer, total, items: rows.map((row) => ({ recordKind: 'PETITION', recordId: row.id, recordCode: row.stt, recordLabel: row.senderName, deadline: day(row.deadline) })) };
    }
    if (filter.kind === 'INCIDENT') {
      const [rows, total] = await Promise.all([this.prisma.incident.findMany({ ...paging, select: { id: true, code: true, name: true, deadline: true } }), this.prisma.incident.count({ where })]);
      return { ...answer, total, items: rows.map((row) => ({ recordKind: 'INCIDENT', recordId: row.id, recordCode: row.code, recordLabel: row.name, deadline: day(row.deadline) })) };
    }
    // The code only: the name and the deadline of a case are fields its own schema may restrict, and that policy is not asked here.
    const [rows, total] = await Promise.all([this.prisma.case.findMany({ ...paging, select: { id: true, caseCode: true } }), this.prisma.case.count({ where })]);
    return { ...answer, total, items: rows.map((row) => ({ recordKind: 'CASE', recordId: row.id, recordCode: row.caseCode, recordLabel: null, deadline: null })) };
  }

  /** The records of a kind that meet `where`, counted per holding unit by PostgreSQL. */
  private async unappliedByUnit(kind: RecordKind, where: Record<string, unknown>): Promise<Array<{ teamId: string; count: number }>> {
    const args = { by: ['assignedTeamId'], where, _count: { _all: true } } as never;
    let groups: Array<{ assignedTeamId: string | null; _count: { _all: number } }>;
    if (kind === 'PETITION') groups = (await this.prisma.petition.groupBy(args)) as never;
    else if (kind === 'INCIDENT') groups = (await this.prisma.incident.groupBy(args)) as never;
    else groups = (await this.prisma.case.groupBy(args)) as never;
    return groups.flatMap((group) => (group.assignedTeamId ? [{ teamId: group.assignedTeamId, count: group._count._all }] : []));
  }

  /**
   * The units the filter `teamId` names: that unit, and with `rollup` every unit under it (the table then rolls them up
   * into it). `null`: no filter. The units of the office are a short table: read once, walked in memory.
   */
  private async unitsOfFilter(filter: Pick<BacklogFilter, 'teamId' | 'rollup'>): Promise<string[] | null> {
    if (!filter.teamId) return null;
    if (!filter.rollup) return [filter.teamId];
    const teams = await this.prisma.team.findMany({ select: { id: true, parentId: true } });
    const found = new Set<string>([filter.teamId]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const team of teams) {
        if (team.parentId && found.has(team.parentId) && !found.has(team.id)) {
          found.add(team.id);
          grew = true;
        }
      }
    }
    return [...found];
  }

  /**
   * Per unit: the work DONE in the period (by `doneAt`) on time or late, the work still open in time or overdue at
   * `asOf`, the on-time rate and the mean working duration. The rule is `completionClass` against the earlier of the two
   * deadlines, as on the tab of a record: done exactly at the deadline is on time. Work whose step has no deadline is
   * in none of the four.
   */
  async onTime(user: GatewayUser, filter: BacklogFilter): Promise<OnTimeReport> {
    const asOf = this.tracking.instant(filter.asOf);
    const period = periodOf(filter.from, filter.to);
    const zero = () => ({ doneOnTime: 0, doneLate: 0, openInTime: 0, openOverdue: 0, onTimeRate: null as number | null, averageDays: null as number | null });
    const report: OnTimeReport = { asOf: asOf.toISOString(), from: period?.gte?.toISOString() ?? null, to: period?.lte?.toISOString() ?? null, rows: [], totals: zero() };
    // The same reach as the tracking list a cell opens: the steps a delegation gives the person count here too.
    const acting = await this.tracking.acting(user);
    const reach = await this.tracking.reach(user, filter.kind, acting);
    if (!reach) return report;

    const kind: { recordKind?: RecordKind } = filter.kind ? { recordKind: filter.kind } : {};
    const role: WorkRole = filter.role ?? 'MAIN';
    const only = await this.unitsOfFilter(filter);
    const ofAUnit: Prisma.ProcRecordStepPartyWhereInput = { teamId: only ? { in: only } : { not: null } };
    const done: Prisma.ProcRecordStepPartyWhereInput = { AND: [{ role }, ofAUnit, { recordStep: { status: 'DONE', doneAt: period ?? { not: null }, ...kind } }, reach] };
    // Still open: the work of the backlog table, started no later than the end of the period.
    const open: Prisma.ProcRecordStepPartyWhereInput = { AND: [this.tracking.workWhere(user, { kind: filter.kind, role, to: filter.to }, reach, ANY_WORK, asOf, acting), ofAUnit] };

    // `completionClass` against the EARLIER of the two deadlines, written as conditions PostgreSQL judges: "not after the
    // earlier" is "not after either that exists". Written without NOT: a missing deadline is NULL, and NOT of NULL drops the row.
    const column = this.prisma.procRecordStep.fields;
    const hasDeadline: Prisma.ProcRecordStepWhereInput = { OR: [{ regulatoryDueAt: { not: null } }, { internalDueAt: { not: null } }] };
    const classes: Array<{ key: 'doneOnTime' | 'doneLate' | 'openInTime' | 'openOverdue'; of: Prisma.ProcRecordStepPartyWhereInput; step: Prisma.ProcRecordStepWhereInput }> = [
      {
        key: 'doneOnTime',
        of: done,
        step: { AND: [hasDeadline, { OR: [{ regulatoryDueAt: null }, { doneAt: { lte: column.regulatoryDueAt } }] }, { OR: [{ internalDueAt: null }, { doneAt: { lte: column.internalDueAt } }] }] },
      },
      { key: 'doneLate', of: done, step: { OR: [{ doneAt: { gt: column.regulatoryDueAt } }, { doneAt: { gt: column.internalDueAt } }] } },
      {
        key: 'openInTime',
        of: open,
        step: { AND: [hasDeadline, { OR: [{ regulatoryDueAt: null }, { regulatoryDueAt: { gte: asOf } }] }, { OR: [{ internalDueAt: null }, { internalDueAt: { gte: asOf } }] }] },
      },
      { key: 'openOverdue', of: open, step: { OR: [{ regulatoryDueAt: { lt: asOf } }, { internalDueAt: { lt: asOf } }] } },
    ];

    const rows = new Map<string, OnTimeRow & { spent: number; timed: number }>();
    const row = (teamId: string) => {
      let found = rows.get(teamId);
      if (!found) {
        found = { teamId, teamName: '', parentTeamId: null, ...zero(), spent: 0, timed: 0 };
        rows.set(teamId, found);
      }
      return found;
    };
    for (const { key, of, step } of classes) {
      const groups = await this.prisma.procRecordStepParty.groupBy({ by: ['teamId'], where: { AND: [of, { recordStep: step }] }, _count: { _all: true } });
      for (const group of groups) if (group.teamId) row(group.teamId)[key] = group._count._all;
    }

    // The mean duration needs (doneAt - startAt), which a grouped query cannot subtract: the two instants of the work done
    // in the period are read ONE PAGE at a time (by id) and only the sums are kept.
    let after: string | undefined;
    for (;;) {
      const page = await this.prisma.procRecordStepParty.findMany({
        where: { AND: [done, { recordStep: { AND: [hasDeadline, { startAt: { not: null } }] } }, ...(after ? [{ id: { gt: after } }] : [])] },
        select: { id: true, teamId: true, recordStep: { select: { startAt: true, doneAt: true } } },
        orderBy: { id: 'asc' },
        take: DURATION_PAGE_SIZE,
      });
      for (const piece of page) {
        const { startAt, doneAt } = piece.recordStep;
        if (!piece.teamId || !startAt || !doneAt) continue;
        const found = row(piece.teamId);
        found.spent += Math.max(doneAt.getTime() - startAt.getTime(), 0);
        found.timed += 1;
      }
      if (page.length < DURATION_PAGE_SIZE) break;
      after = page[page.length - 1].id;
    }

    const teams = await this.teamsOf([...rows.keys()]);
    const total = { ...zero(), spent: 0, timed: 0 };
    const finish = (found: typeof total) => {
      // Overdue and not done is already a miss: it is judged with the work that was done.
      const judged = found.doneOnTime + found.doneLate + found.openOverdue;
      found.onTimeRate = judged > 0 ? Math.round((found.doneOnTime / judged) * 10_000) / 10_000 : null;
      found.averageDays = found.timed > 0 ? round1(found.spent / found.timed / MS_PER_DAY) : null;
    };
    for (const found of rows.values()) {
      const team = teams.get(found.teamId);
      found.teamName = team?.name ?? '';
      found.parentTeamId = team?.parentId ?? null;
      finish(found);
      for (const key of ['doneOnTime', 'doneLate', 'openInTime', 'openOverdue', 'spent', 'timed'] as const) total[key] += found[key];
    }
    finish(total);
    const strip = <T extends { spent: number; timed: number }>({ spent: _spent, timed: _timed, ...rest }: T) => rest;
    report.rows = [...rows.values()].map(strip).sort((a, b) => a.teamName.localeCompare(b.teamName, 'vi') || a.teamId.localeCompare(b.teamId));
    report.totals = strip(total);
    return report;
  }

  /**
   * The units table as filtered AND as shown (rolled up or not), as an .xlsx: the lines are `backlogSheetLines` of the
   * very table the screen gets. Unit names are escaped against formula injection.
   */
  async unitsWorkbook(user: GatewayUser, filter: BacklogFilter): Promise<{ buffer: Buffer; asOf: string }> {
    const table = await this.units(user, filter);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tồn đọng theo đơn vị');
    sheet.columns = EXPORT_COLUMNS.map((column) => ({ header: column.header, key: column.key, width: column.width }));
    sheet.getRow(1).font = { bold: true };
    for (const line of backlogSheetLines(table, filter.rollup === true)) sheet.addRow(line);
    // The totals: the line after the units.
    sheet.getRow(1 + table.rows.length + 1).font = { bold: true };
    return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), asOf: table.asOf };
  }

  private async teamsOf(ids: string[]): Promise<Map<string, { name: string; parentId: string | null }>> {
    if (ids.length === 0) return new Map();
    const teams = await this.prisma.team.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, parentId: true } });
    return new Map(teams.map((team) => [team.id, { name: team.name, parentId: team.parentId }]));
  }
}
