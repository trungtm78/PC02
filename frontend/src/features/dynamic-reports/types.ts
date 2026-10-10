/**
 * Mirrors backend/src/dynamic-reports/reports.service.ts response shapes
 * exactly, including field names — no renaming at the boundary.
 */
import type { DynReportSubmissionState } from '@/shared/enums/generated';
export type { DynReportSubmissionState };

export type DynReportStatus = 'DRAFT' | 'PUBLISHED' | 'SUSPENDED' | 'ARCHIVED';

export interface ReportSetupSummary {
  id: string;
  code: string;
  name: string;
  status: DynReportStatus;
  reportingUnit: string;
  effectiveFrom: string | null;
  updatedAt: string;
  periodType: string | null;
  nextDueAt: string | null;
  managers: string[];
  teamCount: number;
  latestVersion: number | null;
}

export type SheetVisibility = 'visible' | 'hidden' | 'veryHidden';

export interface SheetInfo {
  name: string;
  state: SheetVisibility;
}

export type ParsedFieldType = 'NUM' | 'TEXT' | 'DATE' | 'TIME';
export type ParsedAggregateType = 'SUM' | 'AVG' | 'MIN' | 'MAX' | 'COUNT' | 'NONE';
export type ParsedFieldSource = 'TOKEN' | 'WEB';

export interface ParsedField {
  sheetKey: string;
  address: string;
  fieldKey: string;
  label: string;
  type: ParsedFieldType;
  format: string;
  aggregate: ParsedAggregateType;
  source: ParsedFieldSource;
}

/** S04 web-marking candidate — see backend template/types.ts MarkableCell. */
export interface MarkableCell {
  sheetKey: string;
  address: string;
  suggestedLabel: string | null;
}

export interface ParsedFormulaCell {
  sheetKey: string;
  address: string;
  expression: string;
}

export interface ParsedIssue {
  sheetKey: string;
  address: string;
  code: string;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

/**
 * Structural layout (backend `layout.ts#Layout`) — sheet order, used
 * range, merges, column/row sizes, freeze panes, print area. Opaque to
 * the frontend wizard: it's only ever passed straight through to publish
 * (`SaveReportConfigPayload.layout`), never interpreted here. PR6 S11's
 * GridRenderer is the first real consumer, reading it back from
 * `DynReportVersion.layout` after publish, not from this preview step.
 */
export type TemplateLayout = Record<string, unknown>;

export interface TemplatePreviewResult {
  dateSystem: '1900' | '1904';
  fields: ParsedField[];
  formulas: ParsedFormulaCell[];
  issues: ParsedIssue[];
  markableCells: MarkableCell[];
  totalCells: number;
  inputCellCount: number;
  sha256: string;
  suggestedRules: unknown[];
  layout: TemplateLayout;
}

/** S09/S10 publish payload — mirrors backend SaveReportConfigDto exactly. */
export interface ReportRoleConfig {
  userId: string;
  role: 'MANAGER' | 'VIEWER';
  teamScopeId?: string;
}

export interface ReportTargetConfig {
  teamId: string;
  editorUserIds: string[];
}

export interface ReportScheduleConfig {
  periodType: string;
  periodStartDay?: number;
  dueRule: Record<string, unknown>;
  openRule: Record<string, unknown>;
  shiftNonWorking?: boolean;
  oneTimeDate?: string;
  timezone?: string;
}

export interface SaveReportConfigPayload {
  code: string;
  name: string;
  description?: string;
  selectedSheets: string[];
  dateSystem: '1900' | '1904';
  fields: ParsedField[];
  layout: TemplateLayout;
  formulas: ParsedFormulaCell[];
  schedule: ReportScheduleConfig;
  roles: ReportRoleConfig[];
  targets: ReportTargetConfig[];
  effectiveFrom: string;
  publish: boolean;
  idempotencyKey: string;
}

export interface SaveReportConfigResult {
  reportId: string;
  versionId: string;
  status: DynReportStatus;
}

export interface AssignmentSummary {
  assignmentId: string;
  reportId: string;
  periodId: string;
  reportName: string;
  teamName: string;
  periodKey: string;
  dueAt: string;
  state: DynReportSubmissionState;
}

export interface SubmissionFieldView {
  fieldKey: string;
  sheetKey: string;
  address: string;
  label: string;
  type: ParsedFieldType;
  format: string | null;
  aggregate: ParsedAggregateType;
  required: boolean;
  min: string | null;
  max: string | null;
  scale: number | null;
  maxLength: number | null;
}

export interface TypedValue {
  t: ParsedFieldType;
  v: string | null;
}

export interface SubmissionView {
  assignmentId: string;
  reportName: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  opensAt: string;
  dueAt: string;
  state: DynReportSubmissionState;
  revision: string;
  values: Record<string, TypedValue>;
  fields: SubmissionFieldView[];
  editable: boolean;
  effectiveLockAt: string | null;
  serverTime: string;
  /** S16 (PR7 slice 3) — only populated on the manager's read. */
  history?: RevisionHistoryEntry[];
  /** S17 (PR7 slice 4) — the currently active grant, if any; only the manager's read. */
  activeGrant?: ActiveGrantView | null;
}

export interface ActiveGrantView {
  id: string;
  expiresAt: string;
  reason: string;
}

export interface RevisionHistoryEntry {
  revision: string;
  kind: string;
  actorName: string;
  reason: string | null;
  committedAt: string;
}

export interface SaveValuesResult {
  revision: string;
  state: DynReportSubmissionState;
  savedAt: string;
  serverTime: string;
  effectiveLockAt: string | null;
}

/** S15 thu nhỏ (PR7 slice 2) — D03's three aggregation modes. */
export type SummaryMode = 'SUBMITTED' | 'APPROVED' | 'ALL_SAVED';

export interface FieldAggregateView {
  fieldKey: string;
  sheetKey: string;
  address: string;
  label: string;
  value: string | null;
  displayNotAggregated: boolean;
  countTotal: number;
  countNonBlank: number;
  /** S18 (PR7 slice 5) — exactly the teams counted above, never more. */
  contributors: FieldContributorView[];
}

export interface FieldContributorView {
  teamName: string;
  value: string | null;
  state: DynReportSubmissionState;
  revision: string;
  updatedAt: string | null;
}

export interface KpiSummaryView {
  requiredCount: number;
  exemptCount: number;
  completedCount: number;
  notStartedCount: number;
  inProgressCount: number;
  overdueNotDoneCount: number;
  reopenedCount: number;
  completionRateLabel: string;
  onTimeRateLabel: string;
  dataCoverageLabel: string;
}

export interface PeriodSummaryView {
  reportId: string;
  reportName: string;
  periodId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueAt: string;
  /** S38 — OPEN shows "Chốt kỳ"; FINALIZED shows "Mở chốt" (admin only, 404 otherwise). */
  status: 'OPEN' | 'FINALIZED';
  mode: SummaryMode;
  kpi: KpiSummaryView;
  fields: FieldAggregateView[];
  serverTime: string;
}

export interface FinalizeResultView {
  periodId: string;
  status: 'FINALIZED';
  finalizedAt: string;
  snapshotId: string;
}

export interface ReopenResultView {
  periodId: string;
  status: 'OPEN';
}

/** S25 (PR7 slice 7) — created by POST .../export, then downloaded via GET .../exports/:exportId/download. */
export interface ExportCreateResultView {
  exportId: string;
  fileName: string;
}

/** S34 (PR7 slice 8) — the manager's reopen-request queue. */
export interface UnlockRequestView {
  id: string;
  assignmentId: string;
  reportName: string;
  periodKey: string;
  teamName: string;
  reason: string;
  requestedAt: string;
  requestedByName: string;
}

/** S34 — one row of a bulk grant attempt; a failure here never blocks the rest of the batch. */
export interface BulkGrantUnlockResult {
  granted: string[];
  skipped: Array<{ assignmentId: string; error: string }>;
}

/** S21 (PR7 slice 8) — whole-period history/audit, every assignment at once. */
export interface AssignmentHistoryEntry {
  revision: string;
  kind: string;
  actorName: string;
  reason: string | null;
  committedAt: string;
}

export interface AssignmentHistoryView {
  assignmentId: string;
  teamName: string;
  state: DynReportSubmissionState;
  currentRevision: string;
  revisions: AssignmentHistoryEntry[];
  changedFieldKeysSinceFirstSubmit: string[] | null;
}

export interface ReportHistoryView {
  periodId: string;
  reportName: string;
  periodKey: string;
  assignments: AssignmentHistoryView[];
}

/** T-VIEWER-NAV — the entry point a VIEWER (who owns no assignment) uses to reach a period. */
export interface ViewablePeriodView {
  reportId: string;
  reportName: string;
  periodId: string;
  periodKey: string;
  dueAt: string;
}

/** S35 (PR6 slice 8) — one field the preview found a real difference on. */
export interface ImportDiffEntry {
  fieldKey: string;
  sheetKey: string;
  address: string;
  label: string;
  current: string | null;
  imported: string | null;
}

export interface ImportPreviewResult {
  values: Record<string, string | null>;
  diff: ImportDiffEntry[];
}

/** S19/S23 (PR8 slice 1) — one row of the cross-report status table. */
export interface AssignmentStatusRow {
  assignmentId: string;
  reportId: string;
  reportName: string;
  periodId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  teamId: string;
  teamName: string;
  parentTeamName: string | null;
  dataCoverageLabel: string;
  state: DynReportSubmissionState;
  accessState: 'NOT_YET_OPEN' | 'OPEN' | 'LOCKED' | 'REOPENED';
  timelinessState: 'NOT_YET_DUE' | 'ON_TIME' | 'LATE' | 'OVERDUE_NOT_DONE';
  exempt: boolean;
  dueAt: string;
  effectiveLockAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  updatedAt: string | null;
  grantCount: number;
  changedSinceReopen: boolean;
}

export interface StatusKpiSummary {
  requiredCount: number;
  exemptCount: number;
  completedCount: number;
  notStartedCount: number;
  inProgressCount: number;
  overdueNotDoneCount: number;
  reopenedCount: number;
  completionRateLabel: string;
  onTimeRateLabel: string;
  dataCoverageLabel: string;
}

export interface StatusListResult {
  items: AssignmentStatusRow[];
  total: number;
  kpi: StatusKpiSummary;
  asOf: string;
}

export interface StatusListFilters {
  reportId?: string;
  periodId?: string;
  teamId?: string;
  state?: DynReportSubmissionState;
  overdue?: boolean;
  reopened?: boolean;
}

/** S20 ma trận (PR8 slice 3) — report picker option. */
export interface ReportOption {
  reportId: string;
  reportName: string;
}

export interface StatusMatrixCell {
  /** `true` → team has no assignment for this period at all ("Không giao"), distinct from `state: 'NOT_STARTED'` ("Chưa nhập"). */
  notAssigned: boolean;
  state: DynReportSubmissionState | null;
  accessState: 'NOT_YET_OPEN' | 'OPEN' | 'LOCKED' | 'REOPENED' | null;
  timelinessState: 'NOT_YET_DUE' | 'ON_TIME' | 'LATE' | 'OVERDUE_NOT_DONE' | null;
  exempt: boolean;
  dueAt: string | null;
}

export interface StatusMatrixView {
  periods: Array<{ periodId: string; periodKey: string; dueAt: string }>;
  teams: Array<{ teamId: string; teamName: string }>;
  cells: Record<string, Record<string, StatusMatrixCell>>;
  asOf: string;
}
