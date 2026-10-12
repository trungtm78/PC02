import Decimal from 'decimal.js';
import {
  RangeBoundsError,
  RangeLimitError,
  collectRefs,
  evaluateExpr,
  parseFormula,
} from './expr';
import type {
  CellReference,
  CellResolution,
  EvalContext,
  EvalErrorCode,
  Expr,
  RangeReference,
} from './expr';
import { formatAddress, parseAddress } from './paste';

/**
 * Workbook-wide formula evaluation (G0). One dependency graph over every
 * sheet of a report template: single cells, 2-D rectangles, 3-D sheet
 * spans, formulas that feed formulas, errors that propagate, cycles that are
 * detected instead of looping. It is the single calculator behind the live
 * preview in the entry grid, rule validation, submit, aggregation and
 * export, so all of them agree to the digit (review OV1).
 *
 * Pure, no I/O, no Nest/Prisma/fs imports: it is copied verbatim to the
 * frontend by `npm run gen:dr-engine`.
 *
 * Evaluation order is derived once (Kahn's algorithm over formula cells) and
 * every formula is then evaluated in that order from a plain loop, so a long
 * dependency chain never recurses and cannot overflow the call stack.
 */

export type InputType = 'NUM' | 'TEXT' | 'DATE' | 'TIME';

export type WorkbookCell =
  /** Static numeric constant, as a canonical decimal string. */
  | { kind: 'number'; value: string }
  /** Static text (labels, headings). */
  | { kind: 'text'; value: string }
  | { kind: 'formula'; source: string }
  /** An input cell; its value is supplied separately, keyed `Sheet!A1`. */
  | { kind: 'input'; type: InputType };

export interface WorkbookSheetModel {
  name: string;
  cells: Record<string, WorkbookCell>;
}

export interface WorkbookModel {
  /** Tab order — it defines which sheets a 3-D reference spans. */
  sheets: WorkbookSheetModel[];
  /** Sheets the report left out: a reference into one is out of scope, not missing. */
  excludedSheets?: string[];
}

export type CellValue =
  | { type: 'number'; value: string }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean };

export type CellOutcome =
  | { ok: true; value: CellValue }
  | { ok: false; error: { code: EvalErrorCode; message: string } };

export interface WorkbookEvalOptions {
  /**
   * How an input cell with no value reads.
   * - `'blank'` — entry mode: an empty Excel cell (0 in arithmetic, skipped
   *   by SUM/AVERAGE/COUNT).
   * - `'none'` — aggregate mode: missing data, which propagates as an error
   *   rather than silently turning into 0.
   */
  blankAs: 'blank' | 'none';
  /** Largest rectangle (cells × sheets) one reference may expand to. */
  maxRangeCells?: number;
  /** Step budget for one formula. */
  maxSteps?: number;
  /** Previous-period value for `PREV(ref)`; defaults to "no data". */
  prev?: (ref: CellReference) => CellResolution;
}

export const DEFAULT_MAX_RANGE_CELLS = 50_000;
/** Excel's sheet limits: rows 1..1 048 576, columns A..XFD (0-based index 16 383). */
const MAX_ROW = 1_048_576;
const MAX_COL = 16_383;
const DEFAULT_MAX_STEPS = 200_000;

const key = (sheet: string, cell: string): string => `${sheet}!${cell}`;

/**
 * Cells a range reference stands for, row-major per sheet, sheets in tab
 * order. Checks the size BEFORE building the list, so a formula such as
 * SUM(A1:XFD1048576) is refused without allocating (OV9).
 *
 * A sheet that is not in `sheetOrder` is returned as a single reference to
 * that sheet, so resolving it yields the proper "missing sheet" error rather
 * than a silently empty range.
 */
export function expandRangeRefs(
  range: RangeReference,
  defaultSheet: string,
  sheetOrder: readonly string[],
  maxCells: number,
): CellReference[] {
  const fromName = range.sheetFrom ?? defaultSheet;
  const toName = range.sheetTo ?? range.sheetFrom ?? defaultSheet;

  let sheets: string[];
  if (fromName === toName) {
    sheets = [fromName];
  } else {
    const a = sheetOrder.indexOf(fromName);
    const b = sheetOrder.indexOf(toName);
    if (a === -1 || b === -1) {
      // Report whichever end is unknown; resolveCell turns it into #REF!.
      return [{ sheet: a === -1 ? fromName : toName, cell: range.cellFrom }];
    }
    sheets = sheetOrder.slice(Math.min(a, b), Math.max(a, b) + 1);
  }

  const from = parseAddress(range.cellFrom);
  const to = parseAddress(range.cellTo ?? range.cellFrom);
  // A corner beyond the sheet is #REF! in Excel. Checked first: an unsafe row
  // number (> 2^53) makes `row++` a no-op, which would loop forever.
  for (const corner of [from, to]) {
    if (corner.row < 1 || corner.row > MAX_ROW || corner.col > MAX_COL) {
      throw new RangeBoundsError(`Địa chỉ ô nằm ngoài bảng tính (${range.cellFrom}:${range.cellTo ?? range.cellFrom}).`);
    }
  }
  const col0 = Math.min(from.col, to.col);
  const col1 = Math.max(from.col, to.col);
  const row0 = Math.min(from.row, to.row);
  const row1 = Math.max(from.row, to.row);
  const total = sheets.length * (col1 - col0 + 1) * (row1 - row0 + 1);
  if (total > maxCells) {
    throw new RangeLimitError(
      `Vùng ô gồm ${total} ô, vượt giới hạn ${maxCells} ô.`,
    );
  }

  const out: CellReference[] = [];
  for (const sheet of sheets) {
    for (let row = row0; row <= row1; row++) {
      for (let col = col0; col <= col1; col++) {
        out.push({ sheet, cell: formatAddress({ col, row }) });
      }
    }
  }
  return out;
}

interface FormulaNode {
  key: string;
  sheet: string;
  cell: string;
  /** Null when the source failed to parse. */
  expr: Expr | null;
  parseError: string | null;
  /** Formula nodes this one reads (graph edges). */
  deps: Set<string>;
  /** Set when a range could not be expanded: over the cap, or outside the sheet. */
  refError: 'STEP_LIMIT_EXCEEDED' | 'NOT_FOUND_REFERENCE' | null;
  order: number;
}

/** True when a single cell address lies beyond Excel's grid. */
function outsideSheet(address: string): boolean {
  try {
    const a = parseAddress(address);
    return a.row < 1 || a.row > MAX_ROW || a.col > MAX_COL;
  } catch {
    return true;
  }
}

function sameOutcome(a: CellOutcome | undefined, b: CellOutcome): boolean {
  if (!a) return false;
  if (a.ok !== b.ok) return false;
  if (a.ok && b.ok) {
    if (a.value.type !== b.value.type) return false;
    return a.value.value === b.value.value;
  }
  if (!a.ok && !b.ok) return a.error.code === b.error.code;
  return false;
}

export class WorkbookEvaluator {
  private readonly model: WorkbookModel;
  private readonly options: WorkbookEvalOptions;
  private readonly maxCells: number;
  private readonly sheetOrder: string[];
  private readonly sheetIndex = new Map<string, WorkbookSheetModel>();
  private readonly excluded: Set<string>;
  private readonly inputs = new Map<string, string | null>();

  private readonly nodes = new Map<string, FormulaNode>();
  /** cell key → formula nodes that read it (any cell kind, not only formulas). */
  private readonly dependents = new Map<string, Set<string>>();
  private readonly outcomes = new Map<string, CellOutcome>();
  private order: FormulaNode[] = [];

  constructor(
    model: WorkbookModel,
    inputs: Record<string, string | null | undefined>,
    options: WorkbookEvalOptions,
  ) {
    this.model = model;
    this.options = options;
    this.maxCells = options.maxRangeCells ?? DEFAULT_MAX_RANGE_CELLS;
    this.sheetOrder = model.sheets.map((s) => s.name);
    for (const s of model.sheets) this.sheetIndex.set(s.name, s);
    this.excluded = new Set(model.excludedSheets ?? []);
    for (const [k, v] of Object.entries(inputs)) this.inputs.set(k, v ?? null);

    this.buildGraph();
    this.evaluateAll();
  }

  /** Outcome of a formula cell, or `undefined` if that cell is not a formula. */
  get(sheet: string, cell: string): CellOutcome | undefined {
    return this.outcomes.get(key(sheet, cell.toUpperCase()));
  }

  /** Every formula cell's outcome, keyed `Sheet!A1`. */
  results(): Map<string, CellOutcome> {
    return new Map(this.outcomes);
  }

  /**
   * Changes one input and recomputes only what depends on it, in dependency
   * order. Returns the keys of the formula cells whose outcome changed.
   */
  setInput(sheet: string, cell: string, raw: string | null): string[] {
    const k = key(sheet, cell.toUpperCase());
    this.inputs.set(k, raw);

    const affected = new Set<FormulaNode>();
    const queue = [k];
    while (queue.length > 0) {
      const current = queue.pop() as string;
      for (const dependentKey of this.dependents.get(current) ?? []) {
        const node = this.nodes.get(dependentKey);
        if (node && !affected.has(node)) {
          affected.add(node);
          queue.push(dependentKey);
        }
      }
    }
    if (affected.size === 0) return [];

    const changed: string[] = [];
    for (const node of [...affected].sort((a, b) => a.order - b.order)) {
      const before = this.outcomes.get(node.key);
      const after = this.evaluateNode(node);
      this.outcomes.set(node.key, after);
      if (!sameOutcome(before, after)) changed.push(node.key);
    }
    return changed;
  }

  // -------------------------------------------------------------------------

  private buildGraph(): void {
    for (const sheet of this.model.sheets) {
      for (const [cell, def] of Object.entries(sheet.cells)) {
        if (def.kind !== 'formula') continue;
        const address = cell.toUpperCase();
        const parsed = parseFormula(def.source);
        this.nodes.set(key(sheet.name, address), {
          key: key(sheet.name, address),
          sheet: sheet.name,
          cell: address,
          expr: parsed.ok ? parsed.expr : null,
          parseError: parsed.ok ? null : parsed.error.message,
          deps: new Set(),
          refError: null,
          order: 0,
        });
      }
    }

    // Edges. A range is expanded under the cap; an oversized one marks the
    // node, which then fails with STEP_LIMIT_EXCEEDED instead of looping, and
    // a reference outside the sheet fails it with #REF!.
    for (const node of this.nodes.values()) {
      if (!node.expr) continue;
      let refs: ReturnType<typeof collectRefs>;
      try {
        refs = collectRefs(node.expr, { includePrev: false });
      } catch (e) {
        if (e instanceof RangeError) {
          node.refError = 'STEP_LIMIT_EXCEEDED'; // tree too deep to walk
          continue;
        }
        throw e;
      }
      const reads: string[] = [];
      for (const c of refs.cells) {
        if (outsideSheet(c.cell)) {
          node.refError = 'NOT_FOUND_REFERENCE';
          continue;
        }
        reads.push(key(c.sheet ?? node.sheet, c.cell));
      }
      for (const r of refs.ranges) {
        try {
          for (const c of expandRangeRefs(r, node.sheet, this.sheetOrder, this.maxCells)) {
            reads.push(key(c.sheet ?? node.sheet, c.cell));
          }
        } catch (e) {
          if (e instanceof RangeLimitError) {
            node.refError = 'STEP_LIMIT_EXCEEDED';
            continue;
          }
          if (e instanceof RangeBoundsError) {
            node.refError = 'NOT_FOUND_REFERENCE';
            continue;
          }
          throw e;
        }
      }
      for (const readKey of reads) {
        let set = this.dependents.get(readKey);
        if (!set) {
          set = new Set();
          this.dependents.set(readKey, set);
        }
        set.add(node.key);
        if (this.nodes.has(readKey)) node.deps.add(readKey);
      }
    }

    // Kahn's algorithm over formula → formula edges.
    const inDegree = new Map<string, number>();
    for (const node of this.nodes.values()) inDegree.set(node.key, node.deps.size);
    const ready: FormulaNode[] = [];
    for (const node of this.nodes.values()) {
      if (node.deps.size === 0) ready.push(node);
    }
    const sorted: FormulaNode[] = [];
    for (let head = 0; head < ready.length; head++) {
      const node = ready[head];
      node.order = sorted.length;
      sorted.push(node);
      for (const dependentKey of this.dependents.get(node.key) ?? []) {
        const dependent = this.nodes.get(dependentKey);
        if (!dependent || !dependent.deps.has(node.key)) continue;
        const left = (inDegree.get(dependentKey) ?? 0) - 1;
        inDegree.set(dependentKey, left);
        if (left === 0) ready.push(dependent);
      }
    }
    this.order = sorted;

    // Whatever Kahn could not place sits on a cycle or reads one.
    let next = sorted.length;
    const placed = new Set(sorted);
    for (const node of this.nodes.values()) {
      if (!placed.has(node)) {
        node.order = next++;
        this.outcomes.set(node.key, {
          ok: false,
          error: {
            code: 'CYCLE_DETECTED',
            message: 'Công thức tham chiếu vòng lặp.',
          },
        });
      }
    }
  }

  private evaluateAll(): void {
    for (const node of this.order) {
      this.outcomes.set(node.key, this.evaluateNode(node));
    }
  }

  private evaluateNode(node: FormulaNode): CellOutcome {
    const existing = this.outcomes.get(node.key);
    if (existing && !existing.ok && existing.error.code === 'CYCLE_DETECTED') {
      return existing; // cycles are structural: no input change can fix them
    }
    if (node.parseError !== null || node.expr === null) {
      return {
        ok: false,
        error: { code: 'TYPE_ERROR', message: node.parseError ?? 'Công thức không hợp lệ.' },
      };
    }
    if (node.refError !== null) {
      return {
        ok: false,
        error: {
          code: node.refError,
          message:
            node.refError === 'STEP_LIMIT_EXCEEDED'
              ? 'Công thức vượt quá giới hạn bước tính.'
              : 'Địa chỉ ô nằm ngoài bảng tính.',
        },
      };
    }
    const result = evaluateExpr(node.expr, this.contextFor(node.sheet), {
      maxSteps: this.options.maxSteps ?? DEFAULT_MAX_STEPS,
    });
    if (!result.ok) return { ok: false, error: result.error };
    const v = result.value;
    if (v.type === 'number') {
      return { ok: true, value: { type: 'number', value: v.value.toFixed() } };
    }
    if (v.type === 'string') {
      return { ok: true, value: { type: 'string', value: v.value } };
    }
    return { ok: true, value: { type: 'boolean', value: v.value } };
  }

  /** Evaluation context for an expression written on currentSheet (rules, ad-hoc checks). */
  contextFor(currentSheet: string): EvalContext {
    return {
      resolveCell: (ref) =>
        this.resolve(ref.sheet ?? currentSheet, ref.cell.toUpperCase()),
      expandRange: (range) =>
        expandRangeRefs(range, currentSheet, this.sheetOrder, this.maxCells),
      prevValue: (ref) =>
        this.options.prev
          ? this.options.prev({ sheet: ref.sheet ?? currentSheet, cell: ref.cell })
          : { kind: 'none' },
    };
  }

  private resolve(sheetName: string, cell: string): CellResolution {
    if (this.excluded.has(sheetName)) return { kind: 'out_of_scope' };
    const sheet = this.sheetIndex.get(sheetName);
    if (!sheet) return { kind: 'not_found' };

    const def = sheet.cells[cell];
    if (!def) return { kind: 'blank' };

    switch (def.kind) {
      case 'number':
        return { kind: 'value', value: def.value };
      case 'text':
        return { kind: 'text', value: def.value };
      case 'formula': {
        const outcome = this.outcomes.get(key(sheetName, cell));
        if (!outcome) return { kind: 'cycle' };
        if (!outcome.ok) return { kind: 'error', code: outcome.error.code };
        const v = outcome.value;
        if (v.type === 'number') return { kind: 'value', value: v.value };
        if (v.type === 'string') return { kind: 'text', value: v.value };
        return { kind: 'boolean', value: v.value };
      }
      case 'input': {
        const raw = this.inputs.get(key(sheetName, cell));
        if (raw === undefined || raw === null || raw.trim() === '') {
          return this.options.blankAs === 'none' ? { kind: 'none' } : { kind: 'blank' };
        }
        if (def.type === 'NUM') {
          try {
            const d = new Decimal(raw.trim());
            if (!d.isFinite()) return { kind: 'error', code: 'TYPE_ERROR' };
            return { kind: 'value', value: d.toFixed() };
          } catch {
            return { kind: 'error', code: 'TYPE_ERROR' };
          }
        }
        // TEXT, DATE and TIME read as text: formulas over them are string
        // operations; Excel date serials are not modelled.
        return { kind: 'text', value: raw };
      }
    }
  }
}

/** One-shot evaluation: every formula cell's outcome, keyed `Sheet!A1`. */
export function evaluateWorkbook(
  model: WorkbookModel,
  inputs: Record<string, string | null | undefined>,
  options: WorkbookEvalOptions,
): Map<string, CellOutcome> {
  return new WorkbookEvaluator(model, inputs, options).results();
}
