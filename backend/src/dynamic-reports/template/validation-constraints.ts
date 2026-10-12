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

/**
 * What one validation says about one cell: a range, comparisons with other cells, or both ("between 0 and Q50").
 * `partial` says a part of the rule could not be taken over although the rest was.
 */
type Outcome =
  | { kind: 'ok'; constraint?: DerivedConstraints; rules: RuleRight[]; partial?: string }
  | { kind: 'unsupported'; message: string };

const constraintOutcome = (constraint: DerivedConstraints, partial?: string): Outcome => ({
  kind: 'ok',
  constraint,
  rules: [],
  partial,
});

const unsupported = (message: string): Outcome => ({ kind: 'unsupported', message });

/** The database keeps a bound as DECIMAL(18,4): more digits would overflow it or be rounded into a looser rule. */
function storable(n: Decimal): boolean {
  return n.decimalPlaces() <= 4 && n.abs().lessThan('1e14');
}
const NOT_STORABLE =
  'giá trị giới hạn vượt khả năng lưu (tối đa 14 chữ số nguyên và 4 chữ số thập phân) nên chưa được tự động áp dụng.';

/** A bound the way the field keeps it, or null when it cannot be kept exactly. */
function keep(n: Decimal): string | null {
  return storable(n) ? n.toString() : null;
}

/** The smallest / largest value a whole-number field may take under a comparison with `n`. */
const lowestWhole = (n: Decimal, strict: boolean): Decimal => (strict ? n.floor().plus(1) : n.ceil());
const highestWhole = (n: Decimal, strict: boolean): Decimal => (strict ? n.ceil().minus(1) : n.floor());

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
    const whole = v.type === 'whole';
    // A whole-number rule keeps its "no fraction" half even when its bound is another cell.
    const base: DerivedConstraints = whole ? { scale: 0 } : {};

    if (op === 'between') {
      // Each bound is a number (the field's own range) or another cell (a rule): the real templates say
      // "between 0 and Q50", which is both.
      if (!f1 || !f2) return unsupported('khoảng giá trị thiếu một đầu mút.');
      const constraint: DerivedConstraints = { ...base };
      const rules: RuleRight[] = [];
      for (const [text, bound] of [
        [f1, 'min'],
        [f2, 'max'],
      ] as const) {
        if (NUMBER_RE.test(text)) {
          const n = new Decimal(text);
          const kept = keep(whole ? (bound === 'min' ? lowestWhole(n, false) : highestWhole(n, false)) : n);
          if (kept === null) return unsupported(NOT_STORABLE);
          constraint[bound] = kept;
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
      if (right && operator) return { kind: 'ok', constraint: whole ? base : undefined, rules: [{ operator, right }] };
      return unsupported('quy tắc so sánh với biểu thức/công thức nên chưa được tự động áp dụng.');
    }

    const n = new Decimal(f1);
    const bounded = (lo: Decimal | null, hi: Decimal | null): Outcome => {
      const min = lo === null ? undefined : keep(lo);
      const max = hi === null ? undefined : keep(hi);
      if (min === null || max === null) return unsupported(NOT_STORABLE);
      return constraintOutcome({ ...base, ...(min !== undefined ? { min } : {}), ...(max !== undefined ? { max } : {}) });
    };
    switch (op) {
      case 'greaterThanOrEqual':
        return bounded(whole ? lowestWhole(n, false) : n, null);
      case 'lessThanOrEqual':
        return bounded(null, whole ? highestWhole(n, false) : n);
      case 'equal':
        if (whole && !n.isInteger()) {
          return unsupported('quy tắc "bằng" một số thập phân trên ô số nguyên không có giá trị nào thoả.');
        }
        return bounded(n, n);
      case 'greaterThan':
        return whole
          ? bounded(lowestWhole(n, true), null)
          : unsupported('quy tắc "lớn hơn" chặt trên số thập phân chưa được tự động áp dụng.');
      case 'lessThan':
        return whole
          ? bounded(null, highestWhole(n, true))
          : unsupported('quy tắc "nhỏ hơn" chặt trên số thập phân chưa được tự động áp dụng.');
      default:
        return unsupported('quy tắc "khác" chưa được tự động áp dụng.');
    }
  }

  // textLength: the field keeps a longest length only, so a shortest or an exact length is a part left behind.
  if (field.type !== 'TEXT') return unsupported(`quy tắc độ dài chữ không áp dụng cho ô kiểu ${field.type}.`);
  const length = (text: string | undefined): number | null => (text && /^\d+$/.test(text) ? Number(text) : null);
  const EXPRESSION = 'độ dài dùng biểu thức nên chưa được tự động áp dụng.';
  const NO_MINIMUM = 'độ dài tối thiểu/chính xác chưa được áp dụng (ô chỉ bị giới hạn độ dài tối đa).';
  switch (op) {
    case 'lessThanOrEqual': {
      const n = length(f1);
      return n === null ? unsupported(EXPRESSION) : constraintOutcome({ maxLength: n });
    }
    case 'lessThan': {
      const n = length(f1);
      return n === null ? unsupported(EXPRESSION) : constraintOutcome({ maxLength: Math.max(0, n - 1) });
    }
    case 'equal': {
      const n = length(f1);
      return n === null ? unsupported(EXPRESSION) : constraintOutcome({ maxLength: n }, n > 0 ? NO_MINIMUM : undefined);
    }
    case 'between': {
      const lo = length(f1);
      const hi = length(f2);
      return lo === null || hi === null
        ? unsupported(EXPRESSION)
        : constraintOutcome({ maxLength: hi }, lo > 0 ? NO_MINIMUM : undefined);
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

/** How much a hostile or careless workbook can make this do: more is reported, never silently piled up. */
export const MAX_VALIDATIONS_PER_SHEET = 2_000;
export const MAX_RULE_SUGGESTIONS = 1_000;
export const MAX_UNSUPPORTED_REPORTED = 200;

function rectArea(rects: readonly Rect[]): number {
  return rects.reduce((n, r) => n + (r.bottom - r.top + 1) * (r.right - r.left + 1), 0);
}

export function deriveFromValidations(
  sheets: readonly SheetValidations[],
  fields: readonly ConstraintField[],
): ConstraintDerivation {
  const constraints = new Map<string, DerivedConstraints>();
  const ruleSuggestions: DerivedRuleSuggestion[] = [];
  const unsupportedOut: UnsupportedValidation[] = [];
  const fieldByKey = new Map(fields.map((f) => [f.fieldKey, f]));
  let ruleOverflow = false;
  let unsupportedOverflow = false;

  const report = (sheetKey: string, address: string, message: string): void => {
    if (unsupportedOut.length >= MAX_UNSUPPORTED_REPORTED) {
      unsupportedOverflow = true;
      return;
    }
    unsupportedOut.push({ sheetKey, address, message });
  };

  for (const { sheetKey, validations } of sheets) {
    const sheetFields = fields
      .filter((f) => f.sheetKey === sheetKey)
      .map((f) => ({ f, pos: parseAddress(f.address) }));
    const byPosition = new Map(sheetFields.map((x) => [`${x.pos.row},${x.pos.col}`, x]));

    if (validations.length > MAX_VALIDATIONS_PER_SHEET) {
      report(
        sheetKey,
        '',
        `sheet có ${validations.length} quy tắc nhập liệu, chỉ ${MAX_VALIDATIONS_PER_SHEET} quy tắc đầu được xét.`,
      );
    }

    for (const v of validations.slice(0, MAX_VALIDATIONS_PER_SHEET)) {
      const rects = v.ranges.map(rectOf).filter((r): r is Rect => r !== null);
      if (rects.length === 0) continue;
      const first = rects[0];
      const origin = { row: first.top, col: first.left };
      const help = (v.prompt ?? v.errorMessage)?.trim().slice(0, HELP_TEXT_MAX) || undefined;
      let reported = false;

      // Walk whichever is smaller: the cells the validation covers, or the fields of the sheet.
      const covered: Array<{ f: ConstraintField; pos: { row: number; col: number } }> = [];
      if (rectArea(rects) <= sheetFields.length) {
        for (const r of rects) {
          for (let row = r.top; row <= r.bottom; row++) {
            for (let col = r.left; col <= r.right; col++) {
              const hit = byPosition.get(`${row},${col}`);
              if (hit) covered.push(hit);
            }
          }
        }
      } else {
        for (const x of sheetFields) if (inRects(rects, x.pos.row, x.pos.col)) covered.push(x);
      }

      for (const { f, pos } of covered) {
        const outcome = outcomeFor(v, f, origin, { row: pos.row, col: pos.col });
        if (outcome.kind === 'unsupported') {
          if (!reported) {
            reported = true;
            report(sheetKey, f.address, outcome.message);
          }
          continue;
        }
        if (outcome.partial && !reported) {
          reported = true;
          report(sheetKey, f.address, outcome.partial);
        }
        if (outcome.constraint) {
          const into = constraints.get(f.fieldKey) ?? {};
          merge(into, outcome.constraint);
          if (help && into.helpText === undefined) into.helpText = help;
          constraints.set(f.fieldKey, into);
        }
        for (const { operator, right } of outcome.rules) {
          if (ruleSuggestions.length >= MAX_RULE_SUGGESTIONS) {
            ruleOverflow = true;
            continue;
          }
          const left = `${quoteSheet(sheetKey)}!${f.address}`;
          ruleSuggestions.push({
            sheetKey,
            address: f.address,
            // The two sheets of a report may each have a "Q51 <= Q50": the name tells them apart.
            name: `${left} ${SYMBOL[operator]} ${right.qualified}`,
            leftExpr: left,
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

  // Two validations on one cell can leave nothing that satisfies both ("at least 10" and "at most 5"): a field
  // nobody can fill is worse than one with no range, so neither bound is taken over.
  for (const [fieldKey, c] of constraints) {
    if (c.min !== undefined && c.max !== undefined && new Decimal(c.min).greaterThan(c.max)) {
      const f = fieldByKey.get(fieldKey) as ConstraintField;
      constraints.delete(fieldKey);
      report(f.sheetKey, f.address, `các quy tắc nhập liệu mâu thuẫn nhau (từ ${c.min} đến ${c.max}) nên không áp dụng.`);
    }
  }

  if (ruleOverflow) {
    report('', '', `quá ${MAX_RULE_SUGGESTIONS} gợi ý quy tắc, phần còn lại không được liệt kê.`);
  }
  if (unsupportedOverflow) {
    unsupportedOut.push({
      sheetKey: '',
      address: '',
      message: 'còn nhiều quy tắc nhập liệu khác chưa được tiếp quản, không liệt kê hết.',
    });
  }

  return { constraints, ruleSuggestions, unsupported: unsupportedOut };
}
