/**
 * Mirrors backend/src/dynamic-reports/reports.service.ts response shapes
 * exactly, including field names — no renaming at the boundary.
 */
import type { GridModel } from './engine/generated/grid-types';
import type { DynReportSubmissionState, DynReportPeriodType, DynReportVersionStatus, DynReportRuleOperator, DynReportRuleSeverity } from '@/shared/enums/generated';
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
  suggestedRules: SuggestedRuleView[];
  layout: TemplateLayout;
  /**
   * The template drawn as the officer will see it (null when the server could not build it: the wizard then
   * marks cells from the list alone, as it always could).
   */
  grid?: GridModel | null;
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

/** S36 (PR9 slice 1) — manually-authored validation rule, part of the save payload. */
/**
 * A validation rule the template itself suggests: a check written into a formula cell (`IF(a=b,TRUE,FALSE)`) or
 * Excel's own data validation comparing a cell with another (`Q51 <= Q50`). Expressions are sheet-qualified.
 */
export interface SuggestedRuleView {
  sheetKey: string;
  address: string;
  name: string;
  leftExpr: string;
  operator: 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE';
  rightExpr: string;
  message: string;
  origin: 'IF_FORMULA' | 'DATA_VALIDATION';
}

export interface ReportRuleConfig {
  name: string;
  leftExpr: string;
  operator: DynReportRuleOperator;
  rightExpr: string;
  severity: DynReportRuleSeverity;
  message: string;
  missingStrategy?: string;
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
  rules?: ReportRuleConfig[];
  effectiveFrom: string;
  publish: boolean;
  idempotencyKey: string;
}

export interface SaveReportConfigResult {
  reportId: string;
  versionId: string;
  status: DynReportStatus;
}

/** "Cập nhật mẫu": the body of a new template version (`POST /bao-cao-dong/reports/:id/versions`). */
export interface SaveReportVersionPayload {
  selectedSheets: string[];
  dateSystem: '1900' | '1904';
  fields: Array<ParsedField & Partial<Pick<ReportDetailField, 'required' | 'blankPolicy' | 'scale' | 'maxLength' | 'helpText'>>>;
  layout: TemplateLayout;
  formulas: ParsedFormulaCell[];
  rules?: ReportRuleConfig[];
  publish: boolean;
  idempotencyKey: string;
}

export interface CreateVersionResult {
  reportId: string;
  versionId: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED';
  /** Open periods that moved to the new version at once (nobody had entered anything there). */
  appliedToPeriods: string[];
  /** Open periods that keep the version their teams typed into; the new one applies from the next period. */
  keptOnOldVersionPeriods: string[];
}

/** S22 "Danh sách phiên bản" — every version + which periods used it. */
export interface VersionListItem {
  versionId: string;
  version: number;
  status: DynReportVersionStatus;
  publishedAt: string | null;
  createdAt: string;
  periodKeys: string[];
}

/** S01 "Xem" — the whole configuration of one report (`GET /bao-cao-dong/reports/:id`). */
export interface ReportDetailField {
  sheetKey: string;
  address: string;
  fieldKey: string;
  label: string;
  type: string;
  format: string | null;
  aggregate: string;
  blankPolicy: string;
  required: boolean;
  min: string | null;
  max: string | null;
  scale: number | null;
  maxLength: number | null;
  helpText: string | null;
  source: string;
}

export interface ReportDetailRule {
  name: string;
  leftExpr: string;
  operator: string;
  rightExpr: string;
  severity: string;
  message: string;
  missingStrategy: string | null;
  origin: string;
}

export interface ReportDetailVersion {
  versionId: string;
  version: number;
  status: DynReportVersionStatus;
  fileName: string;
  selectedSheets: string[];
  dateSystem: string;
  publishedAt: string | null;
  createdAt: string;
  fields: ReportDetailField[];
  rules: ReportDetailRule[];
}

export interface ReportDetailPeriod {
  periodId: string;
  periodKey: string;
  status: string;
  startDate: string;
  endDate: string;
  opensAt: string;
  dueAt: string;
  version: number;
  teamCount: number;
  submittedCount: number;
}

export interface ReportDetailView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: DynReportStatus;
  reportingUnit: string;
  effectiveFrom: string | null;
  configVersion: number;
  createdAt: string;
  updatedAt: string;
  schedule: {
    periodType: DynReportPeriodType;
    periodStartDay: number | null;
    dueRule: Record<string, unknown>;
    openRule: Record<string, unknown>;
    shiftNonWorking: boolean;
    oneTimeDate: string | null;
    timezone: string;
    effectiveFrom: string;
  } | null;
  roles: Array<{ userId: string; name: string; role: 'MANAGER' | 'VIEWER'; teamScopeId: string | null }>;
  targets: Array<{
    teamId: string;
    teamCode: string;
    teamName: string;
    editors: Array<{ userId: string; name: string }>;
  }>;
  currentVersion: ReportDetailVersion | null;
  versionCount: number;
  periods: ReportDetailPeriod[];
  periodTotal: number;
}

/** What deleting a report would destroy — shown before anyone confirms. */
export interface ReportDeletionImpact {
  reportId: string;
  code: string;
  name: string;
  versions: number;
  periods: number;
  finalizedPeriods: number;
  assignments: number;
  submissionsWithData: number;
  revisions: number;
  comments: number;
  unlocks: number;
  hasData: boolean;
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

/** S37 (PR9 slice 2) — "Ghi chú/giải trình". `fieldKey` null = ghi chú cho cả bản nộp. */
export interface CommentView {
  id: string;
  fieldKey: string | null;
  body: string;
  authorName: string;
  createdAt: string;
}

export interface SubmissionView {
  assignmentId: string;
  /** Template version of this period; the key for the grid model endpoint. */
  versionId: string;
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
  /** S16 — "lưu lần cuối". `null` when nothing has ever been saved. */
  updatedAt: string | null;
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

/** S36 (PR9 slice 1) — one violated rule, returned by both validate-before-submit and submit()'s VALIDATION_RULE_FAILED error. */
export interface RuleViolation {
  ruleId: string;
  name: string;
  severity: DynReportRuleSeverity;
  message: string;
}

export interface ValidateForSubmitResult {
  errors: RuleViolation[];
  warnings: RuleViolation[];
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
  type: 'NUM' | 'TEXT' | 'DATE' | 'TIME';
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

/** What the server worked out for one formula cell (numbers stay decimal text — no digit lost). */
export type FormulaCellView =
  | { ok: true; type: 'number' | 'string'; value: string }
  | { ok: true; type: 'boolean'; value: boolean }
  | { ok: false; code: string; text: string };

/**
 * Where the formula figures of a summary came from: `LIVE` worked out now from the totals shown, `FROZEN`
 * the figures a closed period was closed with (never recalculated), `UNAVAILABLE` could not be had.
 */
export type FormulaSource = 'LIVE' | 'FROZEN' | 'UNAVAILABLE';

export interface PeriodSummaryView {
  reportId: string;
  /** Template version of this period; the key for the grid model endpoint. */
  versionId: string;
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
  /** Keyed `Sheet!Address`; null when `formulaSource` is UNAVAILABLE. */
  formulaValues: Record<string, FormulaCellView> | null;
  formulaSource: FormulaSource;
  /** The calculator that produced `formulaValues` (a closed period keeps the one of its closing day). */
  calcEngineVersion: number | null;
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

/** S30 (PR4 slice 6) — 1 dòng trong danh sách tổ của kỳ, để chọn tổ thêm/miễn nộp. */
export interface AssignmentListItemView {
  assignmentId: string;
  teamId: string;
  teamName: string;
  obligation: 'REQUIRED' | 'EXEMPT';
  state: DynReportSubmissionState;
}

/** S30 — "trước/sau" cho 1 field khi thêm tổ hoặc miễn nộp giữa kỳ. */
export interface MidPeriodFieldImpact {
  fieldKey: string;
  label: string;
  beforeCountTotal: number;
  afterCountTotal: number;
  beforeValue: string | null;
  afterValue: string | null;
}

/** S30 (D09) — xem trước tác động lên mẫu số trước khi xác nhận thêm tổ/miễn nộp. */
export interface MidPeriodImpactPreview {
  periodId: string;
  teamId: string;
  teamName: string;
  requiredCountBefore: number;
  requiredCountAfter: number;
  contributingCountBefore: number;
  contributingCountAfter: number;
  fields: MidPeriodFieldImpact[];
}

export interface MidPeriodAssignmentView {
  assignmentId: string;
  teamId: string;
  teamName: string;
  obligation: 'REQUIRED' | 'EXEMPT';
}

/** S25 (PR7 slice 7) — created by POST .../export, then downloaded via GET .../exports/:exportId/download. */
export interface ExportCreateResultView {
  exportId: string;
  fileName: string;
  /**
   * TEMPLATE: the report's own sheets, once for the totals and once for every team. LIST: the plain
   * "Sheet / Chỉ tiêu / Giá trị" workbook, when the template could not be drawn or the file would be too large.
   */
  format: 'TEMPLATE' | 'LIST';
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
  /** S27 "người nhập" (PR8 slice 8). */
  editorUserId?: string;
  /** S27 "quản lý". */
  managerUserId?: string;
  /** S27 "loại kỳ". */
  periodType?: DynReportPeriodType;
}

/** S20 ma trận (PR8 slice 3) — report picker option. */
export interface ReportOption {
  reportId: string;
  reportName: string;
}

/** S27 "đơn vị" filter (PR8 slice 7) — flat team picker option. */
export interface TeamFilterOption {
  teamId: string;
  teamName: string;
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
