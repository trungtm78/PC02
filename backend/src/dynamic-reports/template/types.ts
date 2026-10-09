import type { FieldType, AggregateType } from '../engine/token';
import type { CellIssueCode } from './classify';
import type { Layout } from './layout';

export interface ParsedField {
  sheetKey: string;
  address: string;
  fieldKey: string;
  label: string;
  type: FieldType;
  format: string;
  aggregate: AggregateType;
  source: 'TOKEN';
}

export interface ParsedFormulaCell {
  sheetKey: string;
  address: string;
  expression: string;
}

export type ParsedIssueCode =
  | CellIssueCode
  | 'LABEL_REQUIRED'
  | 'EXTERNAL_LINK_DETECTED'
  | 'UNSUPPORTED_FEATURE';

export interface ParsedIssue {
  sheetKey: string;
  /** Empty string for a workbook-level issue (e.g. external link). */
  address: string;
  code: ParsedIssueCode;
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface ParseTemplateResult {
  dateSystem: '1900' | '1904';
  fields: ParsedField[];
  formulas: ParsedFormulaCell[];
  issues: ParsedIssue[];
  totalCells: number;
  inputCellCount: number;
  layout: Layout;
}
