/**
 * Mirrors backend/src/dynamic-reports/reports.service.ts response shapes
 * exactly, including field names — no renaming at the boundary.
 */
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
