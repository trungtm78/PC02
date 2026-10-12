import type { GridCell, GridModel, GridSheet, GridStyle } from '../engine/generated/grid-types';
import { evaluateGridWorkbook, toWorkbookModel } from '../engine/generated/grid-workbook';
import type { WorkbookEvaluator } from '../engine/generated/workbook-eval';
import type { CellOutcome, InputType } from '../engine/generated/workbook-eval';
import {
  describeFormulaError,
  formatForDisplay,
} from '../engine/generated/numfmt';
import type { DisplayValue } from '../engine/generated/numfmt';
import type { FieldAggregateView, FormulaCellView } from '../types';

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

/**
 * The aggregate (S15) view: formula cells show what the SERVER worked out, never what this browser would
 * calculate, so the screen, the exported file and a closed period's snapshot cannot disagree.
 */
export interface OfficialFigures {
  /** `Sheet!A1` → the server's figure; null when the server has none for this view. */
  cells: Readonly<Record<string, FormulaCellView>> | null;
  /** Fields that are deliberately not aggregated (shown as a dash, not as an empty total). */
  notAggregated: ReadonlySet<string>;
}

export interface GridEvaluation {
  grid: GridModel;
  evaluator: WorkbookEvaluator;
  /** Fields by "Sheet!A1". */
  fieldAt: Map<string, GridField>;
  inputs: Record<string, string | null>;
  /** Present on the aggregate view only. */
  official?: OfficialFigures;
}

const cellKey = (sheet: string, address: string) => `${sheet}!${address}`;

export { toWorkbookModel };

export function evaluateGrid(
  grid: GridModel,
  fields: readonly GridField[],
  values: SubmittedValues,
  blankAs: 'blank' | 'none' = 'blank',
): GridEvaluation {
  // The same calculation the server and the exported file use (engine/grid-workbook).
  const { evaluator, inputs } = evaluateGridWorkbook(
    grid,
    fields,
    Object.fromEntries(fields.map((f) => [f.fieldKey, values[f.fieldKey]?.v ?? null])),
    blankAs,
  );
  return {
    grid,
    evaluator,
    fieldAt: new Map(fields.map((f) => [cellKey(f.sheetKey, f.address), f])),
    inputs,
  };
}

/** The grid of a period's aggregate: input cells carry the aggregated figures, formula cells the server's. */
export function evaluateAggregate(
  grid: GridModel,
  fields: readonly FieldAggregateView[],
  formulaValues: Readonly<Record<string, FormulaCellView>> | null,
): GridEvaluation {
  const gridFields: GridField[] = fields.map((f) => ({
    sheetKey: f.sheetKey,
    address: f.address,
    fieldKey: f.fieldKey,
    type: f.type,
    label: f.label,
  }));
  const values: SubmittedValues = Object.fromEntries(
    fields.map((f) => [f.fieldKey, { t: f.type, v: f.displayNotAggregated ? null : f.value }]),
  );
  return {
    ...evaluateGrid(grid, gridFields, values, 'none'),
    official: {
      cells: formulaValues,
      notAggregated: new Set(fields.filter((f) => f.displayNotAggregated).map((f) => f.fieldKey)),
    },
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
    if (ev.official?.notAggregated.has(field.fieldKey)) {
      return {
        kind,
        text: '—',
        align: 'center',
        isError: false,
        hint: 'Chỉ tiêu này không tổng hợp.',
        field,
      };
    }
    value = inputDisplayValue(field, ev.inputs[field.fieldKey] ?? null);
  } else if (cell?.k === 'formula' && ev.official) {
    kind = 'formula';
    formula = cell.f;
    const figure = ev.official.cells?.[cellKey(sheet.name, address)];
    if (!figure) {
      // Nothing from the server: a dash that says so, never a number worked out here.
      return { kind, text: '—', align: 'center', isError: false, hint: 'Chưa có số công thức cho kỳ này.', formula };
    }
    if (!figure.ok) {
      const d = describeFormulaError(figure.code as Parameters<typeof describeFormulaError>[0]);
      return { kind, text: figure.text, align: 'center', isError: true, hint: d.hint, formula };
    }
    value =
      figure.type === 'boolean'
        ? { type: 'boolean', value: figure.value }
        : figure.type === 'string'
          ? { type: 'text', value: figure.value }
          : { type: 'number', value: figure.value };
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
