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

export interface ParsedField {
  sheetKey: string;
  address: string;
  fieldKey: string;
  label: string;
  type: ParsedFieldType;
  format: string;
  aggregate: ParsedAggregateType;
  source: 'TOKEN';
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
  totalCells: number;
  inputCellCount: number;
  sha256: string;
  suggestedRules: unknown[];
}
