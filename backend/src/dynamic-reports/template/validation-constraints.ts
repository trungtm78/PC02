import Decimal from 'decimal.js';
import { formatAddress, parseAddress } from '../engine/paste';
import type { GridValidation } from '../engine/grid-types';

/**
 * Takes over the data validation a template already carries (review OV7).
 *
 * Officers have always been held to it in Excel ("whole number ≥ 0", "Q51 ≤ Q50"); the web form must hold them to
 * the same thing without the author typing it a second time:
 *  - a bound made of constants becomes the field's own range (min / max / integer / text length) and the prompt of
 *    the template becomes its help text;
 *  - a comparison with another cell becomes a validation rule over the two cells;
 *  - everything else (a drop-down list, dates, custom formulas, "not between") is reported as not taken over —
 *    said, never dropped quietly.
 *
 * Pure: reads the extracted validations and the declared fields, nothing else.
 */

export interface ConstraintField {
  sheetKey: string;
  address: string;
  fieldKey: string;
  type: 'NUM' | 'TEXT' | 'DATE' | 'TIME';
}

export interface SheetValidations {
  sheetKey: string;
  validations: readonly GridValidation[];
}

export interface DerivedConstraints {
  min?: string;
  max?: string;
  scale?: number;
  maxLength?: number;
  helpText?: string;
}

export type DerivedRuleOperator = 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE';

export interface DerivedRuleSuggestion {
  sheetKey: string;
  address: string;
  name: string;
  leftExpr: string;
  operator: DerivedRuleOperator;
  rightExpr: string;
  message: string;
  origin: 'DATA_VALIDATION';
}

export interface UnsupportedValidation {
  sheetKey: string;
  address: string;
  message: string;
}

export interface ConstraintDerivation {
  /** Field key → what the template says about its value. Only fields with something to say are present. */
  constraints: Map<string, DerivedConstraints>;
  ruleSuggestions: DerivedRuleSuggestion[];
  unsupported: UnsupportedValidation[];
}

const NUMBER_RE = /^-?\d+(?:\.\d+)?$/;
const REF_RE = /^(?:(?:'((?:[^']|'')+)'|([^'!\s]+))!)?(\$?)([A-Za-z]{1,3})(\$?)(\d+)$/;
const HELP_TEXT_MAX = 500;

const OPERATOR_OF: Record<string, DerivedRuleOperator | undefined> = {
  greaterThan: 'GT',
  greaterThanOrEqual: 'GTE',
  lessThan: 'LT',
  lessThanOrEqual: 'LTE',
  equal: 'EQ',
  notEqual: 'NEQ',
};

const WORDING: Record<DerivedRuleOperator, string> = {
  GT: 'lớn hơn',
  GTE: 'lớn hơn hoặc bằng',
  LT: 'nhỏ hơn',
  LTE: 'nhỏ hơn hoặc bằng',
  EQ: 'bằng',
  NEQ: 'khác',
};

const SYMBOL: Record<DerivedRuleOperator, string> = {
  GT: '>',
  GTE: '>=',
  LT: '<',
  LTE: '<=',
  EQ: '=',
  NEQ: '<>',
};

interface Rect {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

function rectOf(range: string): Rect | null {
  const [a, b] = range.replace(/\$/g, '').split(':');
  try {
    const p = parseAddress(a);
    const q = parseAddress(b ?? a);
    return {
      top: Math.min(p.row, q.row),
      left: Math.min(p.col, q.col),
      bottom: Math.max(p.row, q.row),
      right: Math.max(p.col, q.col),
    };
  } catch {
    return null;
  }
}

function inRects(rects: readonly Rect[], row: number, col: number): boolean {
  return rects.some((r) => row >= r.top && row <= r.bottom && col >= r.left && col <= r.right);
}

/** A sheet name written the way the formula engine prints it: bare when that is unambiguous, quoted otherwise. */
const quoteSheet = (name: string): string =>
  /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`;

/**
 * A reference as Excel applies it to `target`: the formula is written for the first cell of the validated block,
 * and a part that is not anchored with `$` moves with the cell.
 */
function resolveRef(
  text: string,
  origin: { row: number; col: number },
  target: { row: number; col: number },
  ownSheet: string,
): { qualified: string; address: string } | null {
  const m = REF_RE.exec(text.trim());
  if (!m) return null;
  const sheet = m[1] !== undefined ? m[1].replace(/''/g, "'") : (m[2] ?? ownSheet);
  const base = parseAddress(`${m[4]}${m[6]}`);
  const col = m[3] === '$' ? base.col : base.col + (target.col - origin.col);
  const row = m[5] === '$' ? base.row : base.row + (target.row - origin.row);
  if (col < 0 || row < 1) return null;
  const address = formatAddress({ col, row });
  return { qualified: `${quoteSheet(sheet)}!${address}`, address };
}

interface RuleRight {
  operator: DerivedRuleOperator;
  right: { qualified: string; address: string };
}

/** What one validation says about one cell: a range, comparisons with other cells, or both ("between 0 and Q50"). */
type Outcome =
  | { kind: 'ok'; constraint?: DerivedConstraints; rules: RuleRight[] }
  | { kind: 'unsupported'; message: string };

const constraintOutcome = (constraint: DerivedConstraints): Outcome => ({ kind: 'ok', constraint, rules: [] });

const unsupported = (message: string): Outcome => ({ kind: 'unsupported', message });

function outcomeFor(
  v: GridValidation,
  field: ConstraintField,
  origin: { row: number; col: number },
  cell: { row: number; col: number },
): Outcome {
  const op = v.operator ?? 'between';
  const f1 = v.formula1?.trim();
  const f2 = v.formula2?.trim();

  if (v.type === 'list') return unsupported('quy tắc chọn từ danh sách (drop-down) chưa được tự động áp dụng.');
  if (v.type === 'date' || v.type === 'time') return unsupported('quy tắc về ngày/giờ chưa được tự động áp dụng.');
  if (v.type === 'custom') return unsupported('quy tắc dùng công thức tuỳ chỉnh chưa được tự động áp dụng.');

  if (v.type === 'whole' || v.type === 'decimal') {
    if (field.type !== 'NUM') return unsupported(`quy tắc số không áp dụng cho ô kiểu ${field.type}.`);
    if (op === 'notBetween') return unsupported('quy tắc "ngoài khoảng" chưa được tự động áp dụng.');
    if (op === 'between') {
      // Each bound is a number (the field's own range) or another cell (a rule): the real templates say
      // "between 0 and Q50", which is both.
      if (!f1 || !f2) return unsupported('khoảng giá trị thiếu một đầu mút.');
      const constraint: DerivedConstraints = v.type === 'whole' ? { scale: 0 } : {};
      const rules: RuleRight[] = [];
      for (const [text, bound] of [
        [f1, 'min'],
        [f2, 'max'],
      ] as const) {
        if (NUMBER_RE.test(text)) {
          constraint[bound] = new Decimal(text).toString();
          continue;
        }
        const right = resolveRef(text, origin, cell, field.sheetKey);
        if (!right) return unsupported('khoảng giá trị dùng biểu thức/công thức nên chưa được tự động áp dụng.');
        rules.push({ operator: bound === 'min' ? 'GTE' : 'LTE', right });
      }
      return { kind: 'ok', constraint, rules };
    }
    if (!f1) return unsupported('quy tắc thiếu giá trị so sánh.');
    if (!NUMBER_RE.test(f1)) {
      const right = resolveRef(f1, origin, cell, field.sheetKey);
      const operator = OPERATOR_OF[op];
      if (right && operator) return { kind: 'ok', rules: [{ operator, right }] };
      return unsupported('quy tắc so sánh với biểu thức/công thức nên chưa được tự động áp dụng.');
    }
    const n = new Decimal(f1);
    const whole = v.type === 'whole';
    const base = whole ? { scale: 0 } : {};
    switch (op) {
      case 'greaterThanOrEqual':
        return constraintOutcome({ ...base, min: n.toString() });
      case 'lessThanOrEqual':
        return constraintOutcome({ ...base, max: n.toString() });
      case 'equal':
        return constraintOutcome({ ...base, min: n.toString(), max: n.toString() });
      case 'greaterThan':
        return whole
          ? constraintOutcome({ ...base, min: n.plus(1).toString() })
          : unsupported('quy tắc "lớn hơn" chặt trên số thập phân chưa được tự động áp dụng.');
      case 'lessThan':
        return whole
          ? constraintOutcome({ ...base, max: n.minus(1).toString() })
          : unsupported('quy tắc "nhỏ hơn" chặt trên số thập phân chưa được tự động áp dụng.');
      default:
        return unsupported('quy tắc "khác" chưa được tự động áp dụng.');
    }
  }

  // textLength
  if (field.type !== 'TEXT') return unsupported(`quy tắc độ dài chữ không áp dụng cho ô kiểu ${field.type}.`);
  const length = (text: string | undefined): number | null =>
    text && /^\d+$/.test(text) ? Number(text) : null;
  switch (op) {
    case 'lessThanOrEqual':
    case 'equal': {
      const n = length(f1);
      return n === null ? unsupported('độ dài dùng biểu thức nên chưa được tự động áp dụng.') : constraintOutcome({ maxLength: n });
    }
    case 'lessThan': {
      const n = length(f1);
      return n === null ? unsupported('độ dài dùng biểu thức nên chưa được tự động áp dụng.') : constraintOutcome({ maxLength: Math.max(0, n - 1) });
    }
    case 'between': {
      const n = length(f2);
      return n === null ? unsupported('độ dài dùng biểu thức nên chưa được tự động áp dụng.') : constraintOutcome({ maxLength: n });
    }
    default:
      return unsupported('quy tắc độ dài này chưa được tự động áp dụng.');
  }
}

/** Two bounds on one cell: the tighter wins. */
function merge(into: DerivedConstraints, next: DerivedConstraints): void {
  if (next.min !== undefined && (into.min === undefined || new Decimal(next.min).greaterThan(into.min))) into.min = next.min;
  if (next.max !== undefined && (into.max === undefined || new Decimal(next.max).lessThan(into.max))) into.max = next.max;
  if (next.scale !== undefined) into.scale = into.scale === undefined ? next.scale : Math.min(into.scale, next.scale);
  if (next.maxLength !== undefined) {
    into.maxLength = into.maxLength === undefined ? next.maxLength : Math.min(into.maxLength, next.maxLength);
  }
}

export function deriveFromValidations(
  sheets: readonly SheetValidations[],
  fields: readonly ConstraintField[],
): ConstraintDerivation {
  const constraints = new Map<string, DerivedConstraints>();
  const ruleSuggestions: DerivedRuleSuggestion[] = [];
  const unsupportedOut: UnsupportedValidation[] = [];

  for (const { sheetKey, validations } of sheets) {
    const sheetFields = fields
      .filter((f) => f.sheetKey === sheetKey)
      .map((f) => ({ f, pos: parseAddress(f.address) }));

    for (const v of validations) {
      const rects = v.ranges.map(rectOf).filter((r): r is Rect => r !== null);
      if (rects.length === 0) continue;
      const first = rects[0];
      const origin = { row: first.top, col: first.left };
      const help = (v.prompt ?? v.errorMessage)?.trim().slice(0, HELP_TEXT_MAX) || undefined;
      let reported = false;

      for (const { f, pos } of sheetFields) {
        if (!inRects(rects, pos.row, pos.col)) continue;
        const outcome = outcomeFor(v, f, origin, { row: pos.row, col: pos.col });
        if (outcome.kind === 'unsupported') {
          if (!reported) {
            reported = true;
            unsupportedOut.push({ sheetKey, address: f.address, message: outcome.message });
          }
          continue;
        }
        if (outcome.constraint) {
          const into = constraints.get(f.fieldKey) ?? {};
          merge(into, outcome.constraint);
          if (help && into.helpText === undefined) into.helpText = help;
          constraints.set(f.fieldKey, into);
        }
        for (const { operator, right } of outcome.rules) {
          ruleSuggestions.push({
            sheetKey,
            address: f.address,
            name: `${f.address} ${SYMBOL[operator]} ${right.address}`,
            leftExpr: `${quoteSheet(sheetKey)}!${f.address}`,
            operator,
            rightExpr: right.qualified,
            message:
              [v.errorMessage?.trim(), v.prompt?.trim()].filter(Boolean).join(' ') ||
              `Ô ${f.address} phải ${WORDING[operator]} ô ${right.address}.`,
            origin: 'DATA_VALIDATION',
          });
        }
      }
    }
  }

  return { constraints, ruleSuggestions, unsupported: unsupportedOut };
}
