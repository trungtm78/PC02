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
}

export type BandCounts = Record<BacklogBand, number>;

export interface BacklogUnitRow extends BandCounts {
  teamId: string;
  teamName: string;
  parentTeamId: string | null;
  /** Distinct RECORDS this unit is working. Two units may hold the same record, so it does not add up across units. */
  holding: number;
  oldestDueAt: string | null;
  oldestDays: number | null;
}

export interface BacklogUnitsDto {
  /** The instant the table was judged at: passed back when the rows of a cell are opened, so the two agree. */
  asOf: string;
  rows: BacklogUnitRow[];
  totals: BandCounts & { holding: number };
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
}

/** The cell of the table that was clicked: one unit, one band. */
export interface BacklogCell {
  teamId: string;
  band: BacklogBand;
}
