/**
 * "Báo cáo tuỳ chọn" (custom reports, "views" on the server): the shapes of
 * `backend/src/dynamic-reports/views/*`. A selection of `null` always means "everything".
 */
import type { SummaryMode } from '../types';

export interface ViewDefinitionInput {
  title?: string | null;
  showFilterLine?: boolean;
  /** null / absent = every criterion. */
  itemKeys?: string[] | null;
  /** null / absent = every team of the period. */
  teamIds?: string[] | null;
  teamColumns?: boolean;
}

export type ViewCreateInput = ViewDefinitionInput & { name: string };
/** Only the fields sent are changed; `null` is a value. */
export type ViewUpdateInput = ViewDefinitionInput & { name?: string; expectedRevision: number };

export interface ReportViewDto {
  id: string;
  reportId: string;
  name: string;
  title: string | null;
  showFilterLine: boolean;
  itemKeys: string[] | null;
  teamIds: string[] | null;
  teamColumns: boolean;
  revision: number;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
  updatedBy: { id: string; name: string } | null;
}

export type CellMark = 'NOT_ASSIGNED' | 'EXEMPT' | 'NOT_COUNTED' | 'BLANK' | 'NOT_AGGREGATED';

export interface CustomSummaryCell {
  value: string | null;
  mark: CellMark | null;
}

export interface CustomSummaryRow {
  kind: 'CRITERION' | 'GROUP';
  itemKey: string;
  code: string | null;
  label: string;
  unit: string | null;
  depth: number;
  type: 'NUM' | 'TEXT' | 'DATE' | 'TIME';
  total: string | null;
  totalMark: 'NOT_AGGREGATED' | null;
  /** One per team column, in the order of the preview's `teams`; empty when the report has no team columns. */
  cells: CustomSummaryCell[];
  /** A heading whose number includes criteria that are not listed. */
  partial?: true;
}

export type CustomNote =
  | { code: 'PERIOD_OPEN'; params: { mode: SummaryMode } }
  | { code: 'GROUP_INCLUDES_UNLISTED'; params: { code: string | null; label: string; listed: number; total: number } }
  | { code: 'ITEM_KEYS_IGNORED'; params: { count: number } }
  | { code: 'TEAMS_IGNORED'; params: { count: number } };

export interface CustomReportPreview {
  periodId: string;
  reportId: string;
  viewId: string | null;
  title: string;
  mode: SummaryMode;
  periodStatus: 'OPEN' | 'FINALIZED';
  /** The line of the FILE; the screen words its own from `counts`, `teams` and `mode`. Null when switched off. */
  filterLine: string | null;
  columns: { key: string; label: string }[];
  teams: { teamId: string; name: string }[];
  rows: CustomSummaryRow[];
  notes: CustomNote[];
  ignored: { itemKeys: string[]; teamIds: string[]; teams: { teamId: string; name: string | null }[] };
  newCriteria: number;
  counts: { criteria: { selected: number; total: number }; teams: { selected: number; total: number } };
}

/** `definition`, when present, wins over the saved view (it is the builder's unsaved state). */
export interface CustomReportBody {
  viewId?: string | null;
  definition?: ViewDefinitionInput | null;
  mode?: SummaryMode | null;
}

export interface CustomReportExportResult {
  exportId: string;
  fileName: string;
}

/** A team as the directory knows it: only what the team picker needs to draw parents above children. */
export interface TeamDirectoryEntry {
  id: string;
  name: string;
  parentId: string | null;
}
