/**
 * Shapes of `/api/v1/processing/backlog/...` as the backend answers them
 * (`backend/src/processing-flow/tracking/processing-backlog.service.ts`).
 */
import raw from '@/shared/processing/processing-codes.generated.json';
import type { RecordKind } from '../types';

/** Every band of the contract, `NONE` (not near its deadline yet) included: each is a column of the table. */
export type BacklogBand = 'OVERDUE' | 'RED' | 'YELLOW' | 'GREEN' | 'NONE';
export const BACKLOG_BANDS = raw.bands as readonly BacklogBand[];

/** The part a unit plays in a step that makes the step its work. */
export type WorkRole = 'MAIN' | 'CHECK' | 'COORDINATE';
export const WORK_ROLES: readonly WorkRole[] = ['MAIN', 'CHECK', 'COORDINATE'];
/** What the server uses when no role is sent. */
export const DEFAULT_ROLE: WorkRole = 'MAIN';

/** The filters the table, the rows of a cell and the export share. `from`/`to`: `YYYY-MM-DD`, on the start of the step. */
export interface BacklogFilters {
  kind: RecordKind | null;
  role: WorkRole;
  from: string | null;
  to: string | null;
  /** Only this unit (with the roll-up: and every unit under it). Sent as `teamId`. */
  unitId: string | null;
}

export type BandCounts = Record<BacklogBand, number>;

export interface BacklogUnitRow extends BandCounts {
  teamId: string;
  teamName: string;
  parentTeamId: string | null;
  /** Distinct RECORDS this unit is working. Two units may hold the same record, so it does not add up across units. */
  holding: number;
  /**
   * Open records this unit HOLDS that have no flow yet, in all and per kind. A record is held by one unit, so these DO
   * add up across units. Absent in the answer of an older server.
   */
  unapplied?: number;
  unappliedByKind?: Partial<Record<RecordKind, number>>;
  oldestDueAt: string | null;
  oldestDays: number | null;
  /** Only on a rolled-up table: the units summed into this row besides itself. */
  descendants?: number;
  /** Only on a rolled-up table: `holding` is a lower bound of the group (records do not add up across units). */
  holdingIsLowerBound?: boolean;
}

export interface BacklogUnitsDto {
  /** The instant the table was judged at: passed back when the rows of a cell are opened, so the two agree. */
  asOf: string;
  rows: BacklogUnitRow[];
  totals: BandCounts & { holding: number; unapplied?: number };
}

/** A record with no flow yet, of the list behind a number of the column "Chưa áp quy trình". */
export interface UnappliedRecordDto {
  recordKind: RecordKind;
  recordId: string;
  recordCode: string | null;
  recordLabel: string | null;
  /** The record's own deadline; `null` without one, and for a case. */
  deadline: string | null;
}

export interface UnappliedRecordsDto {
  kind: RecordKind;
  teamId: string;
  items: UnappliedRecordDto[];
  total: number;
  page: number;
  pageSize: number;
}

/** The number of the column "Chưa áp quy trình" that was clicked: one unit, one kind of record. */
export interface UnappliedCell {
  teamId: string;
  kind: RecordKind;
}

export interface OnTimeFigures {
  doneOnTime: number;
  doneLate: number;
  openInTime: number;
  openOverdue: number;
  /** doneOnTime / (doneOnTime + doneLate + openOverdue), 0..1; `null` when that denominator is 0. */
  onTimeRate: number | null;
  averageDays: number | null;
}

export interface OnTimeRow extends OnTimeFigures {
  teamId: string;
  teamName: string;
  parentTeamId: string | null;
}

export interface OnTimeReportDto {
  asOf: string;
  from: string | null;
  to: string | null;
  rows: OnTimeRow[];
  totals: OnTimeFigures;
}

/** The period of the on-time report, with the kind and the role of the table above it. */
export interface OnTimeQuery {
  kind: RecordKind | null;
  role: WorkRole;
  from: string;
  to: string;
  /** The unit filter of the table above, and whether it reaches the units under it. */
  unitId: string | null;
  rolledUp: boolean;
}

/** The cell of the table that was clicked: one unit, one band. */
export interface BacklogCell {
  teamId: string;
  band: BacklogBand;
}
