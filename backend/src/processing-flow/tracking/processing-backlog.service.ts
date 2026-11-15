import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { escapeXlsxCell } from '../../common/utils/xlsx-formula-escape.util';
import { PrismaService } from '../../prisma/prisma.service';
import { completionClass, remainingDays } from '../engine/bands';
import { BANDS } from '../contract/processing-codes';
import type { Band } from '../engine/types';
import type { GatewayUser, RecordKind } from '../gateway/record-snapshot';
import { earlier } from '../records/record-flow.dto';
import type { WorkRole } from './band-conditions';
import { ANY_WORK, periodOf, ProcessingTrackingService, type TrackingFilter } from './processing-tracking.service';

export type BacklogFilter = Pick<TrackingFilter, 'asOf' | 'kind' | 'role' | 'from' | 'to'>;

type BandCounts = Record<Band, number>;

export interface BacklogUnitRow extends BandCounts {
  teamId: string;
  teamName: string;
  /** The unit above, for the screen to roll up; `null` at the top. */
  parentTeamId: string | null;
  /** How many distinct RECORDS have a step this unit is working. */
  holding: number;
  /** The earliest deadline among the unit's work; `null` when none of it has a deadline. */
  oldestDueAt: string | null;
  /** Civil days (Vietnam) that deadline is past at `asOf`; 0 while it is not past; `null` with `oldestDueAt`. */
  oldestDays: number | null;
}

export interface BacklogUnits {
  /** The instant the table was judged at: pass it back as `asOf` when opening the rows of a cell. */
  asOf: string;
  rows: BacklogUnitRow[];
  /** The band columns add up; `holding` is the number of distinct records over all units (a record two units work is one). */
  totals: BandCounts & { holding: number };
}

export interface OnTimeRow {
  teamId: string;
  teamName: string;
  parentTeamId: string | null;
  doneOnTime: number;
  doneLate: number;
  openInTime: number;
  openOverdue: number;
  /** doneOnTime / (doneOnTime + doneLate), 0..1; `null` when nothing was done in the period. */
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

/** The column titles of the exported sheet are fixed labels of a document, as in the other exports of the system. */
const EXPORT_COLUMNS: Array<{ header: string; key: keyof BacklogUnitRow; width: number }> = [
  { header: 'Đơn vị', key: 'teamName', width: 36 },
  { header: 'Đang giữ (hồ sơ)', key: 'holding', width: 16 },
  { header: 'Quá hạn', key: 'OVERDUE', width: 12 },
  { header: 'Đỏ', key: 'RED', width: 10 },
  { header: 'Vàng', key: 'YELLOW', width: 10 },
  { header: 'Xanh', key: 'GREEN', width: 10 },
  { header: 'Chưa tới ngưỡng', key: 'NONE', width: 16 },
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
 * Units of counting: `holding` counts RECORDS (distinct), the band columns count WORK (step x party of the role).
 */
@Injectable()
export class ProcessingBacklogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracking: ProcessingTrackingService,
  ) {}

  async units(user: GatewayUser, filter: BacklogFilter): Promise<BacklogUnits> {
    const asOf = this.tracking.instant(filter.asOf);
    const empty: BacklogUnits = { asOf: asOf.toISOString(), rows: [], totals: { ...zeroBands(), holding: 0 } };
    const reach = await this.tracking.reach(user, filter.kind);
    if (!reach) return empty;

    const rows = new Map<string, BacklogUnitRow>();
    const row = (teamId: string): BacklogUnitRow => {
      let found = rows.get(teamId);
      if (!found) {
        found = { teamId, teamName: '', parentTeamId: null, holding: 0, ...zeroBands(), oldestDueAt: null, oldestDays: null };
        rows.set(teamId, found);
      }
      return found;
    };
    const ofAUnit = { teamId: { not: null } };

    // The band columns: the count of the SAME condition the list of a cell uses, grouped by unit.
    for (const band of BANDS) {
      const groups = await this.prisma.procRecordStepParty.groupBy({ by: ['teamId'], where: { AND: [this.tracking.workWhere(user, filter, reach, band, asOf), ofAUnit] }, _count: { _all: true } });
      for (const group of groups) if (group.teamId) row(group.teamId)[band] = group._count._all;
    }

    // "Holding" and the oldest deadline: every piece of work of the unit, whatever its band. The distinct records are
    // counted here (a grouped count cannot count distinct values of a related row).
    const work = await this.prisma.procRecordStepParty.findMany({
      where: { AND: [this.tracking.workWhere(user, filter, reach, ANY_WORK, asOf), ofAUnit] },
      select: { teamId: true, recordStep: { select: { recordFlowId: true, internalDueAt: true } } },
    });
    const held = new Map<string, Set<string>>();
    const oldest = new Map<string, Date>();
    const everyRecord = new Set<string>();
    for (const piece of work) {
      if (!piece.teamId) continue;
      row(piece.teamId);
      held.set(piece.teamId, (held.get(piece.teamId) ?? new Set<string>()).add(piece.recordStep.recordFlowId));
      everyRecord.add(piece.recordStep.recordFlowId);
      const due = piece.recordStep.internalDueAt;
      const known = oldest.get(piece.teamId);
      if (due && (!known || due.getTime() < known.getTime())) oldest.set(piece.teamId, due);
    }

    const teams = await this.teamsOf([...rows.keys()]);
    const totals = { ...zeroBands(), holding: everyRecord.size };
    for (const found of rows.values()) {
      const team = teams.get(found.teamId);
      found.teamName = team?.name ?? '';
      found.parentTeamId = team?.parentId ?? null;
      found.holding = held.get(found.teamId)?.size ?? 0;
      const due = oldest.get(found.teamId);
      if (due) {
        found.oldestDueAt = due.toISOString();
        found.oldestDays = due.getTime() < asOf.getTime() ? Math.max(-remainingDays(asOf, due), 0) : 0;
      }
      for (const band of BANDS) totals[band] += found[band];
    }
    // A unit all of whose work vanished between the queries has nothing to show.
    const shown = [...rows.values()].filter((found) => found.holding > 0 || BANDS.some((band) => found[band] > 0));
    shown.sort((a, b) => a.teamName.localeCompare(b.teamName, 'vi') || a.teamId.localeCompare(b.teamId));
    return { asOf: asOf.toISOString(), rows: shown, totals };
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
    const reach = await this.tracking.reach(user, filter.kind);
    if (!reach) return report;

    const select = { teamId: true, recordStep: { select: { startAt: true, doneAt: true, regulatoryDueAt: true, internalDueAt: true } } } as const;
    const kind: { recordKind?: RecordKind } = filter.kind ? { recordKind: filter.kind } : {};
    const role: WorkRole = filter.role ?? 'MAIN';
    const [done, open] = await Promise.all([
      this.prisma.procRecordStepParty.findMany({
        where: { AND: [{ role, teamId: { not: null } }, { recordStep: { status: 'DONE', doneAt: period ?? { not: null }, ...kind } }, reach] },
        select,
      }),
      // Still open: the work of the backlog table, started no later than the end of the period.
      this.prisma.procRecordStepParty.findMany({
        where: { AND: [this.tracking.workWhere(user, { kind: filter.kind, role, to: filter.to }, reach, ANY_WORK, asOf), { teamId: { not: null } }] },
        select,
      }),
    ]);

    const rows = new Map<string, OnTimeRow & { spent: number; timed: number }>();
    const row = (teamId: string) => {
      let found = rows.get(teamId);
      if (!found) {
        found = { teamId, teamName: '', parentTeamId: null, ...zero(), spent: 0, timed: 0 };
        rows.set(teamId, found);
      }
      return found;
    };
    for (const piece of [...done, ...open]) {
      const { startAt, doneAt, regulatoryDueAt, internalDueAt } = piece.recordStep;
      const due = earlier(regulatoryDueAt, internalDueAt);
      if (!piece.teamId || !due) continue;
      const found = row(piece.teamId);
      const outcome = completionClass(doneAt, due, asOf);
      if (outcome === 'DONE_ON_TIME') found.doneOnTime += 1;
      else if (outcome === 'DONE_LATE') found.doneLate += 1;
      else if (outcome === 'OPEN_IN_TIME') found.openInTime += 1;
      else found.openOverdue += 1;
      if (doneAt && startAt) {
        found.spent += Math.max(doneAt.getTime() - startAt.getTime(), 0);
        found.timed += 1;
      }
    }

    const teams = await this.teamsOf([...rows.keys()]);
    const total = { ...zero(), spent: 0, timed: 0 };
    const finish = (found: typeof total) => {
      const judged = found.doneOnTime + found.doneLate;
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

  /** The units table as filtered, as an .xlsx. Every text cell is escaped against formula injection. */
  async unitsWorkbook(user: GatewayUser, filter: BacklogFilter): Promise<{ buffer: Buffer; asOf: string }> {
    const table = await this.units(user, filter);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tồn đọng theo đơn vị');
    sheet.columns = EXPORT_COLUMNS.map((column) => ({ header: column.header, key: column.key, width: column.width }));
    sheet.getRow(1).font = { bold: true };
    const cells = (source: Partial<Record<keyof BacklogUnitRow, string | number | null>>) =>
      Object.fromEntries(EXPORT_COLUMNS.map(({ key }) => [key, typeof source[key] === 'string' ? escapeXlsxCell(source[key]) : (source[key] ?? '')]));
    for (const found of table.rows) sheet.addRow(cells(found));
    sheet.addRow(cells({ ...table.totals, teamName: 'Tổng cộng' })).font = { bold: true };
    return { buffer: Buffer.from(await workbook.xlsx.writeBuffer()), asOf: table.asOf };
  }

  private async teamsOf(ids: string[]): Promise<Map<string, { name: string; parentId: string | null }>> {
    if (ids.length === 0) return new Map();
    const teams = await this.prisma.team.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, parentId: true } });
    return new Map(teams.map((team) => [team.id, { name: team.name, parentId: team.parentId }]));
  }
}
