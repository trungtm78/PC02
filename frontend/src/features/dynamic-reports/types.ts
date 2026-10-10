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
  mode: SummaryMode;
  kpi: KpiSummaryView;
  fields: FieldAggregateView[];
  serverTime: string;
}
