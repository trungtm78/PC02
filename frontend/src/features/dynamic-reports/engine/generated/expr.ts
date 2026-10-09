import Decimal from 'decimal.js';

/**
 * Expr engine — formula parser/evaluator shared by cell formulas AND
 * validation rules (FRD §4.5, D05). Pure, no I/O (spec §10 R2). This engine
 * has zero knowledge of any real workbook: every cell/range/previous-period
 * reference goes through a caller-supplied `EvalContext`, so it stays
 * testable in isolation and shareable with the frontend's live fx preview.
 *
 * Allowed grammar (D05): `+ - * /`, `&`, comparisons (`=`,`<>`,`<`,`<=`,
 * `>`,`>=`), `SUM AVERAGE MIN MAX COUNT IF ROUND AND OR ABS`, cell/range/
 * cross-sheet references, `PREV(ref)`. No `eval`, no external links. The
 * evaluator never runs unboundedly: every node visit consumes one unit of
 * a finite step budget (a synchronous stand-in for a wall-clock timeout,
 * appropriate for a pure function with no I/O) and cycles are detected via
 * the context (which owns the dependency graph), surfaced as a resolution
 * kind this engine simply propagates as an error.
 */

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '&'
  | '='
  | '<>'
  | '<'
  | '<='
  | '>'
  | '>=';

export type Expr =
  | { kind: 'number'; value: number }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'cell'; sheet?: string; cell: string }
  | {
      kind: 'range';
      sheetFrom?: string;
      sheetTo?: string;
      cellFrom: string;
      cellTo?: string;
    }
  | { kind: 'binary'; op: BinaryOp; left: Expr; right: Expr }
  | { kind: 'unary'; op: '-'; operand: Expr }
  | { kind: 'call'; name: FunctionName; args: Expr[] }
  | { kind: 'prev'; ref: Expr };

export const ALLOWED_FUNCTIONS = [
  'SUM',
  'AVERAGE',
  'MIN',
  'MAX',
  'COUNT',
  'IF',
  'ROUND',
  'AND',
  'OR',
  'ABS',
] as const;
export type FunctionName = (typeof ALLOWED_FUNCTIONS)[number];

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokenType =
  | 'number'
  | 'ident'
  | 'quotedSheetRange'
  | 'op'
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'colon'
  | 'bang'
  | 'eof';

interface Token {
  type: TokenType;
  text: string;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = source;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      i++;
      continue;
    }
    if (c === "'") {
      // Quoted sheet name or 3-D sheet range, e.g. 'Team1:Team3' or 'Sheet 1'.
      const end = s.indexOf("'", i + 1);
      if (end === -1)
        throw new ParseFailure(
          'NOT_A_FORMULA',
          `Thiếu dấu nháy đơn đóng trong "${source}".`,
        );
      const quoted = s.slice(i + 1, end);
      if (quoted.includes('[') || quoted.includes(']')) {
        // Excel external-workbook reference, e.g. '[Book1.xlsx]Sheet1' — never allowed, quoted or not.
        throw new ParseFailure(
          'DISALLOWED_CONSTRUCT',
          'Tham chiếu workbook ngoài không được phép.',
        );
      }
      tokens.push({ type: 'quotedSheetRange', text: quoted });
      i = end + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] ?? ''))) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      tokens.push({ type: 'number', text: s.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      tokens.push({ type: 'ident', text: s.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '<' && s[i + 1] === '>') {
      tokens.push({ type: 'op', text: '<>' });
      i += 2;
      continue;
    }
    if ((c === '<' || c === '>') && s[i + 1] === '=') {
      tokens.push({ type: 'op', text: c + '=' });
      i += 2;
      continue;
    }
    if ('+-*/&=<>'.includes(c)) {
      tokens.push({ type: 'op', text: c });
      i++;
      continue;
    }
    if (c === '(') {
      tokens.push({ type: 'lparen', text: c });
      i++;
      continue;
    }
    if (c === ')') {
      tokens.push({ type: 'rparen', text: c });
      i++;
      continue;
    }
    if (c === ',') {
      tokens.push({ type: 'comma', text: c });
      i++;
      continue;
    }
    if (c === ':') {
      tokens.push({ type: 'colon', text: c });
      i++;
      continue;
    }
    if (c === '!') {
      tokens.push({ type: 'bang', text: c });
      i++;
      continue;
    }
    if (c === '[') {
      // External workbook reference, e.g. '[Book1.xlsx]Sheet1'!A1 — never allowed.
      throw new ParseFailure(
        'DISALLOWED_CONSTRUCT',
        'Tham chiếu workbook ngoài không được phép.',
      );
    }
    throw new ParseFailure(
      'NOT_A_FORMULA',
      `Ký tự không hợp lệ "${c}" trong công thức.`,
    );
  }
  tokens.push({ type: 'eof', text: '' });
  return tokens;
}

// ---------------------------------------------------------------------------
// Parser (recursive descent, precedence climbing for binary ops)
// ---------------------------------------------------------------------------

export type ParseErrorCode =
  | 'NOT_A_FORMULA'
  | 'UNKNOWN_FUNCTION'
  | 'DISALLOWED_CONSTRUCT'
  | 'UNEXPECTED_TOKEN'
  | 'FORMULA_TOO_DEEP';

/**
 * Recursive-descent parsing recurses once per nesting level (each `(`, each
 * binary operand chain). An attacker- or mistake-supplied formula with
 * thousands of nested parentheses would otherwise blow the JS call stack
 * before the evaluator's step budget ever gets a chance to run — this is a
 * parse-time guard, independent of (and checked before) that budget.
 */
const MAX_PARSE_DEPTH = 200;

export interface ParseError {
  code: ParseErrorCode;
  message: string;
}

class ParseFailure extends Error {
  // Explicit field (not a constructor parameter-property shorthand): the
  // frontend copy of this engine is type-checked with
  // `erasableSyntaxOnly`, which forbids parameter-property modifiers
  // because they require emitting an assignment the "type-only erasure"
  // transpile mode can't produce.
  code: ParseErrorCode;
  constructor(code: ParseErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export type ParseResult =
  | { ok: true; expr: Expr }
  | { ok: false; error: ParseError };

class Parser {
  private pos = 0;
  private depth = 0;
  private tokens: Token[];
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /** Call at the top of every method that can be re-entered through nesting (parens, function args, unary chains). */
  private enterDepth(): void {
    this.depth++;
    if (this.depth > MAX_PARSE_DEPTH) {
      throw new ParseFailure(
        'FORMULA_TOO_DEEP',
        `Công thức lồng quá sâu (vượt quá ${MAX_PARSE_DEPTH} cấp).`,
      );
    }
  }
  private exitDepth(): void {
    this.depth--;
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType): Token {
    const t = this.next();
    if (t.type !== type) {
      throw new ParseFailure(
        'UNEXPECTED_TOKEN',
        `Mong đợi ${type} nhưng gặp "${t.text}".`,
      );
    }
    return t;
  }

  parseExpr(): Expr {
    const expr = this.parseComparison();
    if (this.peek().type !== 'eof') {
      throw new ParseFailure(
        'UNEXPECTED_TOKEN',
        `Còn dư ký tự sau công thức: "${this.peek().text}".`,
      );
    }
    return expr;
  }

  private parseComparison(): Expr {
    this.enterDepth();
    try {
      let left = this.parseConcat();
      while (
        this.peek().type === 'op' &&
        ['=', '<>', '<', '<=', '>', '>='].includes(this.peek().text)
      ) {
        const op = this.next().text as BinaryOp;
        const right = this.parseConcat();
        left = { kind: 'binary', op, left, right };
      }
      return left;
    } finally {
      this.exitDepth();
    }
  }

  private parseConcat(): Expr {
    let left = this.parseAdditive();
    while (this.peek().type === 'op' && this.peek().text === '&') {
      this.next();
      const right = this.parseAdditive();
      left = { kind: 'binary', op: '&', left, right };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (
      this.peek().type === 'op' &&
      (this.peek().text === '+' || this.peek().text === '-')
    ) {
      const op = this.next().text as '+' | '-';
      const right = this.parseMultiplicative();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (
      this.peek().type === 'op' &&
      (this.peek().text === '*' || this.peek().text === '/')
    ) {
      const op = this.next().text as '*' | '/';
      const right = this.parseUnary();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.peek().type === 'op' && this.peek().text === '-') {
      this.enterDepth();
      try {
        this.next();
        return { kind: 'unary', op: '-', operand: this.parseUnary() };
      } finally {
        this.exitDepth();
      }
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Expr {
    const t = this.peek();

    if (t.type === 'number') {
      this.next();
      return { kind: 'number', value: Number(t.text) };
    }

    if (t.type === 'lparen') {
      this.next();
      const inner = this.parseComparison();
      this.expect('rparen');
      return inner;
    }

    if (t.type === 'quotedSheetRange') {
      this.next();
      this.expect('bang');
      const cellTok = this.expect('ident');
      const cellRef = this.parseCellOrRange(cellTok.text, undefined);
      if (t.text.includes(':')) {
        const [sheetFrom, sheetTo] = t.text.split(':');
        if (cellRef.kind === 'range') {
          return {
            kind: 'range',
            sheetFrom,
            sheetTo,
            cellFrom: cellRef.cellFrom,
            cellTo: cellRef.cellTo,
          };
        }
        return { kind: 'range', sheetFrom, sheetTo, cellFrom: cellRef.cell };
      }
      if (cellRef.kind === 'range') {
        return {
          kind: 'range',
          sheetFrom: t.text,
          sheetTo: t.text,
          cellFrom: cellRef.cellFrom,
          cellTo: cellRef.cellTo,
        };
      }
      return { kind: 'cell', sheet: t.text, cell: cellRef.cell };
    }

    if (t.type === 'ident') {
      this.next();
      const upper = t.text.toUpperCase();

      if (upper === 'TRUE' || upper === 'FALSE') {
        return { kind: 'boolean', value: upper === 'TRUE' };
      }

      if (upper === 'PREV') {
        this.expect('lparen');
        const ref = this.parseComparison();
        this.expect('rparen');
        return { kind: 'prev', ref };
      }

      if (this.peek().type === 'bang') {
        // Sheet1!A1 — single unquoted sheet name.
        this.next();
        const cellTok = this.expect('ident');
        const cellRef = this.parseCellOrRange(cellTok.text, t.text);
        if (cellRef.kind === 'range') {
          return {
            kind: 'range',
            sheetFrom: t.text,
            sheetTo: t.text,
            cellFrom: cellRef.cellFrom,
            cellTo: cellRef.cellTo,
          };
        }
        return cellRef;
      }

      if (this.peek().type === 'lparen') {
        if (!(ALLOWED_FUNCTIONS as readonly string[]).includes(upper)) {
          throw new ParseFailure(
            'UNKNOWN_FUNCTION',
            `Hàm "${t.text}" không được phép. Dùng ${ALLOWED_FUNCTIONS.join(', ')}.`,
          );
        }
        this.next();
        const args: Expr[] = [];
        if (this.peek().type !== 'rparen') {
          args.push(this.parseComparison());
          while (this.peek().type === 'comma') {
            this.next();
            args.push(this.parseComparison());
          }
        }
        this.expect('rparen');
        return { kind: 'call', name: upper as FunctionName, args };
      }

      // Bare cell reference like A1, or a same-sheet range A1:A10.
      return this.parseCellOrRange(t.text, undefined);
    }

    throw new ParseFailure(
      'UNEXPECTED_TOKEN',
      `Không đọc được "${t.text}" trong công thức.`,
    );
  }

  private parseCellOrRange(
    cellText: string,
    sheet: string | undefined,
  ): Extract<Expr, { kind: 'cell' } | { kind: 'range' }> {
    if (!/^[A-Za-z]+[0-9]+$/.test(cellText)) {
      throw new ParseFailure(
        'UNEXPECTED_TOKEN',
        `"${cellText}" không phải địa chỉ ô hợp lệ.`,
      );
    }
    if (this.peek().type === 'colon') {
      this.next();
      const toTok = this.expect('ident');
      if (!/^[A-Za-z]+[0-9]+$/.test(toTok.text)) {
        throw new ParseFailure(
          'UNEXPECTED_TOKEN',
          `"${toTok.text}" không phải địa chỉ ô hợp lệ.`,
        );
      }
      return {
        kind: 'range',
        sheetFrom: sheet,
        sheetTo: sheet,
        cellFrom: cellText.toUpperCase(),
        cellTo: toTok.text.toUpperCase(),
      };
    }
    return { kind: 'cell', sheet, cell: cellText.toUpperCase() };
  }
}

export function parseFormula(source: string): ParseResult {
  const normalized = source.trim().replace(/^=/, '');
  try {
    const tokens = tokenize(normalized);
    const parser = new Parser(tokens);
    const expr = parser.parseExpr();
    return { ok: true, expr };
  } catch (e) {
    if (e instanceof ParseFailure) {
      return { ok: false, error: { code: e.code, message: e.message } };
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Evaluation context (supplied by the caller — aggregate.ts / access.ts)
// ---------------------------------------------------------------------------

export interface CellReference {
  sheet?: string;
  cell: string;
}

export interface RangeReference {
  sheetFrom?: string;
  sheetTo?: string;
  cellFrom: string;
  cellTo?: string;
}

export type CellResolution =
  | { kind: 'value'; value: number }
  | { kind: 'blank' } // empty cell — behaves as 0 in direct arithmetic (Excel convention), excluded from AVERAGE/COUNT's denominator
  | { kind: 'none' } // NONE-aggregate field, or genuinely missing data (e.g. no previous period) — always an error in arithmetic
  | { kind: 'not_found' }
  | { kind: 'out_of_scope' }
  | { kind: 'cycle' };

export interface EvalContext {
  resolveCell(ref: CellReference): CellResolution;
  expandRange(ref: RangeReference): CellReference[];
  prevValue(ref: CellReference): CellResolution;
}

export interface EvalOptions {
  maxSteps?: number;
}

const DEFAULT_MAX_STEPS = 100_000;

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

export type EvalValue =
  | { type: 'number'; value: Decimal }
  | { type: 'boolean'; value: boolean };

export type EvalErrorCode =
  | 'DIV_BY_ZERO'
  | 'MISSING_DATA'
  | 'OUT_OF_SCOPE_REFERENCE'
  | 'CYCLE_DETECTED'
  | 'NOT_FOUND_REFERENCE'
  | 'STEP_LIMIT_EXCEEDED'
  | 'TYPE_ERROR';

export interface EvalError {
  code: EvalErrorCode;
  message: string;
}

export type EvalResult =
  | { ok: true; value: EvalValue }
  | { ok: false; error: EvalError };

class EvalFailure extends Error {
  code: EvalErrorCode;
  constructor(code: EvalErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

class Budget {
  private remaining: number;
  constructor(remaining: number) {
    this.remaining = remaining;
  }
  consume(): void {
    this.remaining--;
    if (this.remaining < 0) {
      throw new EvalFailure(
        'STEP_LIMIT_EXCEEDED',
        'Công thức vượt quá giới hạn bước tính.',
      );
    }
  }
}

function resolutionToNumberOrNull(resolution: CellResolution): number | null {
  switch (resolution.kind) {
    case 'value':
      return resolution.value;
    case 'blank':
      return null; // caller decides: 0 for direct arithmetic, excluded for aggregates
    case 'none':
      throw new EvalFailure('MISSING_DATA', 'Thiếu dữ liệu để tính.');
    case 'not_found':
      throw new EvalFailure(
        'NOT_FOUND_REFERENCE',
        'Địa chỉ ô không tồn tại trong mẫu.',
      );
    case 'out_of_scope':
      throw new EvalFailure(
        'OUT_OF_SCOPE_REFERENCE',
        'Ô tham chiếu nằm ngoài phạm vi báo cáo.',
      );
    case 'cycle':
      throw new EvalFailure('CYCLE_DETECTED', 'Công thức tham chiếu vòng lặp.');
  }
}

function asNumber(value: EvalValue): Decimal {
  if (value.type !== 'number') {
    throw new EvalFailure('TYPE_ERROR', 'Mong đợi giá trị số.');
  }
  return value.value;
}

function asBoolean(value: EvalValue): boolean {
  if (value.type === 'boolean') return value.value;
  if (value.type === 'number') return !value.value.isZero();
  throw new EvalFailure('TYPE_ERROR', 'Mong đợi giá trị đúng/sai.');
}

function num(n: Decimal.Value): EvalValue {
  return { type: 'number', value: new Decimal(n) };
}
function bool(b: boolean): EvalValue {
  return { type: 'boolean', value: b };
}

class Evaluator {
  private ctx: EvalContext;
  private budget: Budget;
  constructor(ctx: EvalContext, budget: Budget) {
    this.ctx = ctx;
    this.budget = budget;
  }

  evalCellForArithmetic(ref: CellReference): Decimal {
    const n = resolutionToNumberOrNull(this.ctx.resolveCell(ref));
    return new Decimal(n ?? 0);
  }

  /** Flattens a range reference to its contained numbers, dropping blanks. Used by SUM/AVERAGE/MIN/MAX/COUNT. */
  flattenRangeValues(range: Extract<Expr, { kind: 'range' }>): number[] {
    const refs = this.ctx.expandRange({
      sheetFrom: range.sheetFrom,
      sheetTo: range.sheetTo,
      cellFrom: range.cellFrom,
      cellTo: range.cellTo,
    });
    const values: number[] = [];
    for (const ref of refs) {
      this.budget.consume();
      const n = resolutionToNumberOrNull(this.ctx.resolveCell(ref));
      if (n !== null) values.push(n);
    }
    return values;
  }

  eval(expr: Expr): EvalValue {
    this.budget.consume();

    switch (expr.kind) {
      case 'number':
        return num(expr.value);
      case 'boolean':
        return bool(expr.value);
      case 'cell':
        return num(
          this.evalCellForArithmetic({ sheet: expr.sheet, cell: expr.cell }),
        );
      case 'range': {
        // A bare range used outside an aggregate function (e.g. "=A1:A3")
        // has no single scalar value in this grammar.
        throw new EvalFailure(
          'TYPE_ERROR',
          'Vùng ô chỉ dùng được trong SUM/AVERAGE/MIN/MAX/COUNT.',
        );
      }
      case 'unary': {
        const operand = asNumber(this.eval(expr.operand));
        return num(operand.negated());
      }
      case 'binary':
        return this.evalBinary(expr);
      case 'call':
        return this.evalCall(expr);
      case 'prev': {
        if (expr.ref.kind !== 'cell') {
          throw new EvalFailure(
            'TYPE_ERROR',
            'PREV chỉ nhận tham chiếu một ô.',
          );
        }
        const resolution = this.ctx.prevValue({
          sheet: expr.ref.sheet,
          cell: expr.ref.cell,
        });
        const n = resolutionToNumberOrNull(resolution);
        return num(n ?? 0);
      }
    }
  }

  private evalBinary(expr: Extract<Expr, { kind: 'binary' }>): EvalValue {
    if (expr.op === '&') {
      // Text concatenation is accepted by the grammar but this engine's
      // scalar values are number/boolean only (TEXT fields never feed
      // formulas, FRD §4.5) — treat '&' as string-forming for completeness
      // but callers that need a TEXT result read raw cell values directly.
      throw new EvalFailure(
        'TYPE_ERROR',
        'Nối chuỗi "&" chưa hỗ trợ trong engine số.',
      );
    }

    const left = this.eval(expr.left);
    const right = this.eval(expr.right);

    if (['=', '<>', '<', '<=', '>', '>='].includes(expr.op)) {
      return bool(this.compare(expr.op, left, right));
    }

    const l = asNumber(left);
    const r = asNumber(right);
    switch (expr.op) {
      case '+':
        return num(l.plus(r));
      case '-':
        return num(l.minus(r));
      case '*':
        return num(l.times(r));
      case '/':
        if (r.isZero()) {
          throw new EvalFailure('DIV_BY_ZERO', 'Không tính được: chia cho 0.');
        }
        return num(l.dividedBy(r));
      default:
        throw new EvalFailure(
          'TYPE_ERROR',
          `Toán tử "${expr.op}" không hợp lệ.`,
        );
    }
  }

  private compare(op: BinaryOp, left: EvalValue, right: EvalValue): boolean {
    if (left.type === 'boolean' || right.type === 'boolean') {
      const l = asBoolean(left);
      const r = asBoolean(right);
      switch (op) {
        case '=':
          return l === r;
        case '<>':
          return l !== r;
        default:
          throw new EvalFailure(
            'TYPE_ERROR',
            'Chỉ so sánh = hoặc <> trên giá trị đúng/sai.',
          );
      }
    }
    const l = asNumber(left);
    const r = asNumber(right);
    switch (op) {
      case '=':
        return l.equals(r);
      case '<>':
        return !l.equals(r);
      case '<':
        return l.lessThan(r);
      case '<=':
        return l.lessThanOrEqualTo(r);
      case '>':
        return l.greaterThan(r);
      case '>=':
        return l.greaterThanOrEqualTo(r);
      default:
        throw new EvalFailure(
          'TYPE_ERROR',
          `Toán tử so sánh "${op}" không hợp lệ.`,
        );
    }
  }

  private evalCall(expr: Extract<Expr, { kind: 'call' }>): EvalValue {
    const collectRangeNumbers = (arg: Expr): number[] => {
      if (arg.kind === 'range') return this.flattenRangeValues(arg);
      const v = asNumber(this.eval(arg));
      return [v.toNumber()];
    };

    switch (expr.name) {
      case 'SUM': {
        const all = expr.args.flatMap(collectRangeNumbers);
        return num(all.reduce((acc, n) => acc.plus(n), new Decimal(0)));
      }
      case 'AVERAGE': {
        const all = expr.args.flatMap(collectRangeNumbers);
        if (all.length === 0)
          throw new EvalFailure('MISSING_DATA', 'Thiếu dữ liệu để tính.');
        const sum = all.reduce((acc, n) => acc.plus(n), new Decimal(0));
        return num(sum.dividedBy(all.length));
      }
      case 'MIN': {
        const all = expr.args.flatMap(collectRangeNumbers);
        if (all.length === 0)
          throw new EvalFailure('MISSING_DATA', 'Thiếu dữ liệu để tính.');
        return num(Decimal.min(...all));
      }
      case 'MAX': {
        const all = expr.args.flatMap(collectRangeNumbers);
        if (all.length === 0)
          throw new EvalFailure('MISSING_DATA', 'Thiếu dữ liệu để tính.');
        return num(Decimal.max(...all));
      }
      case 'COUNT': {
        const all = expr.args.flatMap(collectRangeNumbers);
        return num(all.length);
      }
      case 'IF': {
        if (expr.args.length !== 3)
          throw new EvalFailure('TYPE_ERROR', 'IF cần đúng 3 tham số.');
        const cond = asBoolean(this.eval(expr.args[0]));
        return this.eval(cond ? expr.args[1] : expr.args[2]);
      }
      case 'ROUND': {
        if (expr.args.length !== 2)
          throw new EvalFailure('TYPE_ERROR', 'ROUND cần đúng 2 tham số.');
        const value = asNumber(this.eval(expr.args[0]));
        const digits = asNumber(this.eval(expr.args[1])).toNumber();
        return num(value.toDecimalPlaces(digits));
      }
      case 'AND': {
        const values = expr.args.map((a) => asBoolean(this.eval(a)));
        return bool(values.every(Boolean));
      }
      case 'OR': {
        const values = expr.args.map((a) => asBoolean(this.eval(a)));
        return bool(values.some(Boolean));
      }
      case 'ABS': {
        if (expr.args.length !== 1)
          throw new EvalFailure('TYPE_ERROR', 'ABS cần đúng 1 tham số.');
        return num(asNumber(this.eval(expr.args[0])).abs());
      }
    }
  }
}

export function evaluateFormula(
  source: string,
  ctx: EvalContext,
  options: EvalOptions = {},
): EvalResult {
  const parsed = parseFormula(source);
  if (!parsed.ok) {
    return {
      ok: false,
      error: {
        code: 'TYPE_ERROR' as EvalErrorCode,
        message: parsed.error.message,
      },
    };
  }
  const budget = new Budget(options.maxSteps ?? DEFAULT_MAX_STEPS);
  const evaluator = new Evaluator(ctx, budget);
  try {
    const value = evaluator.eval(parsed.expr);
    return { ok: true, value };
  } catch (e) {
    if (e instanceof EvalFailure) {
      return { ok: false, error: { code: e.code, message: e.message } };
    }
    throw e;
  }
}
