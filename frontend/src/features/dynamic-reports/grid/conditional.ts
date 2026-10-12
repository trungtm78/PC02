import type {
  GridConditionalFormat,
  GridConditionalRule,
  GridDxf,
  GridSheet,
} from '../engine/generated/grid-types';
import { evaluateExpr, formatFormula, parseFormula } from '../engine/generated/expr';
import type { EvalContext, Expr } from '../engine/generated/expr';
import { formatAddress, parseAddress } from '../engine/generated/paste';

/**
 * Conditional formatting (OV8): which look a rule overlays on a cell, given
 * what the cell currently shows. Supports the two rule types the real
 * templates use — `cellIs` and `expression` — and nothing else; the server
 * already reports other types in `GridModel.warnings`.
 *
 * `expression` formulas are written relative to the top-left cell of the
 * rule's range, so they are shifted to the cell being tested (anchored `$`
 * parts stay put), exactly as Excel copies them.
 */

interface Rect {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

function rectOf(range: string): Rect | null {
  const [a, b = a] = range.split(':');
  try {
    const p = parseAddress(a);
    const q = parseAddress(b);
    return {
      r0: Math.min(p.row, q.row),
      c0: Math.min(p.col, q.col),
      r1: Math.max(p.row, q.row),
      c1: Math.max(p.col, q.col),
    };
  } catch {
    return null;
  }
}

function inRect(rect: Rect, row: number, col: number): boolean {
  return row >= rect.r0 && row <= rect.r1 && col >= rect.c0 && col <= rect.c1;
}

/** Shifts the relative parts of every reference by (dRow, dCol). */
export function shiftExpr(expr: Expr, dRow: number, dCol: number): Expr {
  const shiftCell = (cell: string, abs?: { col: boolean; row: boolean }): string => {
    const a = parseAddress(cell);
    return formatAddress({
      col: abs?.col ? a.col : Math.max(0, a.col + dCol),
      row: abs?.row ? a.row : Math.max(1, a.row + dRow),
    });
  };
  const go = (e: Expr): Expr => {
    switch (e.kind) {
      case 'cell':
        return { ...e, cell: shiftCell(e.cell, e.abs) };
      case 'range':
        return {
          ...e,
          cellFrom: shiftCell(e.cellFrom, e.absFrom),
          cellTo: e.cellTo ? shiftCell(e.cellTo, e.absTo) : e.cellTo,
        };
      case 'binary':
        return { ...e, left: go(e.left), right: go(e.right) };
      case 'unary':
        return { ...e, operand: go(e.operand) };
      case 'call':
        return { ...e, args: e.args.map(go) };
      case 'prev':
        return { ...e, ref: go(e.ref) };
      default:
        return e;
    }
  };
  return go(expr);
}

const OPERATOR_SOURCE: Record<string, string> = {
  equal: '=',
  notEqual: '<>',
  greaterThan: '>',
  greaterThanOrEqual: '>=',
  lessThan: '<',
  lessThanOrEqual: '<=',
};

/** True when a formula result is "true" the way a rule needs it. */
function truthy(result: ReturnType<typeof evaluateExpr>): boolean {
  if (!result.ok) return false;
  const v = result.value;
  if (v.type === 'boolean') return v.value;
  if (v.type === 'number') return !v.value.isZero();
  return false;
}

/** A rule with its formulas parsed once, however many cells it is tested on. */
interface CompiledRule {
  rule: GridConditionalRule;
  anchor: Rect;
  rects: Rect[];
  /** `expression`: the formula; `cellIs`: the one or two bounds. Null when unparseable. */
  exprs: Expr[] | null;
}

const compiledBySheet = new WeakMap<GridSheet, CompiledRule[]>();

function compile(sheet: GridSheet): CompiledRule[] {
  const cached = compiledBySheet.get(sheet);
  if (cached) return cached;
  const out: CompiledRule[] = [];
  for (const cf of sheet.conditionalFormats as GridConditionalFormat[]) {
    const rects = cf.ranges.map(rectOf).filter((r): r is Rect => r !== null);
    if (rects.length === 0) continue;
    for (const rule of cf.rules) {
      const sources = rule.type === 'expression' ? [rule.formula] : rule.formulas;
      const exprs: Expr[] = [];
      let ok = true;
      for (const src of sources) {
        const parsed = parseFormula(src);
        if (parsed.ok) exprs.push(parsed.expr);
        else ok = false;
      }
      out.push({ rule, anchor: rects[0], rects, exprs: ok ? exprs : null });
    }
  }
  out.sort((a, b) => a.rule.priority - b.rule.priority);
  compiledBySheet.set(sheet, out);
  return out;
}

function ruleMatches(
  compiled: CompiledRule,
  sheetName: string,
  row: number,
  col: number,
  ctx: EvalContext,
): boolean {
  const { rule, anchor, exprs } = compiled;
  if (!exprs) return false;
  // Every formula in a rule is written for the top-left cell of its range.
  const dRow = row - anchor.r0;
  const dCol = col - anchor.c0;
  const shifted = exprs.map((e) => shiftExpr(e, dRow, dCol));

  if (rule.type === 'expression') {
    return truthy(evaluateExpr(shifted[0], ctx));
  }

  // cellIs: compare the cell itself with one or two bounds, each shifted like
  // an expression (a bound of `A1` on B2 means A2 there, as in Excel).
  const self = `'${sheetName.replace(/'/g, "''")}'!${formatAddress({ col, row })}`;
  const [f1, f2] = shifted.map((e) => formatFormula(e));
  if (rule.operator === 'between' || rule.operator === 'notBetween') {
    if (f1 === undefined || f2 === undefined) return false;
    const src =
      rule.operator === 'between'
        ? `AND(${self}>=(${f1}),${self}<=(${f2}))`
        : `OR(${self}<(${f1}),${self}>(${f2}))`;
    return holds(src, ctx);
  }
  const op = OPERATOR_SOURCE[rule.operator];
  if (!op || f1 === undefined) return false;
  return holds(`${self}${op}(${f1})`, ctx);
}

function holds(src: string, ctx: EvalContext): boolean {
  const parsed = parseFormula(src);
  return parsed.ok && truthy(evaluateExpr(parsed.expr, ctx));
}

/**
 * The merged overlay of every rule that applies to a cell. Rules run in
 * priority order (1 first); a property set by an earlier match is not
 * overridden by a later one, and `stopIfTrue` ends the walk.
 */
export function overlayFor(
  sheet: GridSheet,
  row: number,
  col: number,
  ctx: EvalContext,
): GridDxf | null {
  let merged: GridDxf | null = null;
  for (const compiled of compile(sheet)) {
    if (!compiled.rects.some((r) => inRect(r, row + 1, col))) continue;
    if (!ruleMatches(compiled, sheet.name, row + 1, col, ctx)) continue;
    merged = { ...compiled.rule.style, ...(merged ?? {}) };
    if (compiled.rule.stopIfTrue) break;
  }
  return merged;
}
