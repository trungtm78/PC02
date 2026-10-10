import type { FieldType, AggregateType } from '../engine/token';
import type { CellIssueCode } from './classify';
import type { Layout } from './layout';

export type FieldSource = 'TOKEN' | 'WEB';

export interface ParsedField {
  sheetKey: string;
  address: string;
  fieldKey: string;
  label: string;
  type: FieldType;
  format: string;
  aggregate: AggregateType;
  source: FieldSource;
}

/**
 * A cell eligible for S04 web-marking: unlocked, no formula, not a merge
 * non-anchor, not hidden, and not already a token-sourced field (it
 * produced an `UNLOCKED_NO_TOKEN` warning — spec §3's "cảnh báo + gợi ý
 * đặt làm ô nhập"). `suggestedLabel` is null when `label.ts` could not
 * infer one; the marking UI must then require an explicit label.
 */
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
  markableCells: MarkableCell[];
  totalCells: number;
  inputCellCount: number;
  layout: Layout;
}
