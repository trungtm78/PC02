import type { GridCell, GridModel, GridSheet, GridStyle } from '../engine/generated/grid-types';
import { WorkbookEvaluator } from '../engine/generated/workbook-eval';
import type {
  CellOutcome,
  InputType,
  WorkbookCell,
  WorkbookModel,
} from '../engine/generated/workbook-eval';
import {
  describeFormulaError,
  formatForDisplay,
} from '../engine/generated/numfmt';
import type { DisplayValue } from '../engine/generated/numfmt';

/**
 * Glue between the render model and the formula engine: turns a GridModel
 * plus the submission's values into a WorkbookModel, evaluates it, and gives
 * the renderer one answer per cell — what text to show, how to align it,
 * whether it is an input / a formula / an error.
 *
 * Input cells are identified by the report's FIELDS, never by the model (the
 * model deliberately does not know which cells are inputs): a template's
 * unlocked cells often hold a sample number, and an input cell must show the
 * submitted value, not that sample.
 */

export interface GridField {
  sheetKey: string;
  address: string;
  fieldKey: string;
  type: InputType;
  required?: boolean;
  label?: string;
}

export type SubmittedValues = Record<string, { t?: string; v: string | null } | undefined>;

export interface GridEvaluation {
  grid: GridModel;
  evaluator: WorkbookEvaluator;
  /** Fields by "Sheet!A1". */
  fieldAt: Map<string, GridField>;
  inputs: Record<string, string | null>;
}

const cellKey = (sheet: string, address: string) => `${sheet}!${address}`;

function toWorkbookCell(cell: GridCell): WorkbookCell | null {
  switch (cell.k) {
    case 'num':
      return { kind: 'number', value: cell.v };
    case 'bool':
      return { kind: 'number', value: cell.v ? '1' : '0' };
    case 'text':
      return { kind: 'text', value: cell.v };
    case 'formula':
      return { kind: 'formula', source: cell.f };
    case 'empty':
      return null;
  }
}

export function toWorkbookModel(grid: GridModel, fields: readonly GridField[]): WorkbookModel {
  return {
    sheets: grid.sheets.map((sheet) => {
      const cells: Record<string, WorkbookCell> = {};
      for (const [address, cell] of Object.entries(sheet.cells)) {
        const wc = toWorkbookCell(cell);
        if (wc) cells[address] = wc;
      }
      // An input overrides whatever the file holds there (a sample value, a label…).
      for (const f of fields) {
        if (f.sheetKey === sheet.name) cells[f.address] = { kind: 'input', type: f.type };
      }
      return { name: sheet.name, cells };
    }),
    excludedSheets: grid.excludedSheets,
  };
}

export function evaluateGrid(
  grid: GridModel,
  fields: readonly GridField[],
  values: SubmittedValues,
  blankAs: 'blank' | 'none' = 'blank',
): GridEvaluation {
  const inputs: Record<string, string | null> = {};
  for (const f of fields) inputs[f.fieldKey] = values[f.fieldKey]?.v ?? null;
  const evaluator = new WorkbookEvaluator(toWorkbookModel(grid, fields), inputs, { blankAs });
  return {
    grid,
    evaluator,
    fieldAt: new Map(fields.map((f) => [cellKey(f.sheetKey, f.address), f])),
    inputs,
  };
}

export interface CellView {
  kind: 'input' | 'formula' | 'static' | 'empty';
  text: string;
  align: 'left' | 'right' | 'center';
  /** Colour from a [Red]-style number format. */
  color?: string;
  isError: boolean;
  /** Tooltip for an error. */
  hint?: string;
  /** Formula source, for the formula bar / tooltip. */
  formula?: string;
  /** The field behind an input cell. */
  field?: GridField;
}

function inputDisplayValue(field: GridField, raw: string | null): DisplayValue {
  if (raw === null || raw.trim() === '') return { type: 'blank' };
  switch (field.type) {
    case 'NUM':
      return { type: 'number', value: raw.trim() };
    case 'DATE':
      return { type: 'date', value: raw.trim() };
    case 'TIME':
      return { type: 'time', value: raw.trim() };
    case 'TEXT':
      return { type: 'text', value: raw };
  }
}

function outcomeDisplayValue(outcome: Extract<CellOutcome, { ok: true }>): DisplayValue {
  const v = outcome.value;
  if (v.type === 'number') return { type: 'number', value: v.value };
  if (v.type === 'string') return { type: 'text', value: v.value };
  return { type: 'boolean', value: v.value };
}

function isZero(v: DisplayValue): boolean {
  if (v.type !== 'number') return false;
  const n = Number(v.value);
  return n === 0;
}

/**
 * Everything the renderer needs to draw one cell. `style` is the cell's
 * resolved style (for its number format and explicit alignment).
 */
export function viewOf(
  ev: GridEvaluation,
  sheet: GridSheet,
  address: string,
  cell: GridCell | undefined,
  style: GridStyle,
  locale: 'vi' | 'en' = 'vi',
): CellView {
  const opts = { locale, dateSystem: ev.grid.dateSystem } as const;
  const field = ev.fieldAt.get(cellKey(sheet.name, address));

  let value: DisplayValue;
  let kind: CellView['kind'];
  let formula: string | undefined;

  if (field) {
    kind = 'input';
    value = inputDisplayValue(field, ev.inputs[field.fieldKey] ?? null);
  } else if (cell?.k === 'formula') {
    kind = 'formula';
    formula = cell.f;
    const outcome = ev.evaluator.get(sheet.name, address);
    if (!outcome || !outcome.ok) {
      const code = outcome && !outcome.ok ? outcome.error.code : 'CYCLE_DETECTED';
      const d = describeFormulaError(code);
      return { kind, text: d.text, align: 'center', isError: true, hint: d.hint, formula };
    }
    value = outcomeDisplayValue(outcome);
  } else if (cell?.k === 'num') {
    kind = 'static';
    value = { type: 'number', value: cell.v };
  } else if (cell?.k === 'text') {
    kind = 'static';
    value = { type: 'text', value: cell.v };
  } else if (cell?.k === 'bool') {
    kind = 'static';
    value = { type: 'boolean', value: cell.v };
  } else {
    return { kind: 'empty', text: '', align: 'left', isError: false };
  }

  // Excel's "show a zero in cells that have zero value" switch.
  if (!sheet.showZeros && isZero(value)) {
    return { kind, text: '', align: 'right', isError: false, formula, field };
  }

  const shown = formatForDisplay(value, style.numFmt, opts);
  return {
    kind,
    text: shown.text,
    align: shown.align,
    color: shown.color,
    isError: false,
    formula,
    field,
  };
}
