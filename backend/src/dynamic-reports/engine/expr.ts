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
  | { kind: 'string'; value: string }
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
  | 'string'
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
    if (c === '"') {
      // String literal; a doubled quote inside stands for one literal quote.
      let j = i + 1;
      let text = '';
      let closed = false;
      while (j < s.length) {
        if (s[j] === '"') {
          if (s[j + 1] === '"') {
            text += '"';
            j += 2;
            continue;
          }
          closed = true;
          j++;
          break;
        }
        text += s[j];
        j++;
      }
      if (!closed) {
        throw new ParseFailure(
          'NOT_A_FORMULA',
          `Thiếu dấu nháy kép đóng trong "${source}".`,
        );
      }
      tokens.push({ type: 'string', text });
      i = j;
      continue;
    }
    if (c === "'") {
      // Quoted sheet name or 3-D sheet range, e.g. 'Team1:Team3' or 'Sheet 1'.
      // A doubled single quote inside stands for one literal quote (Excel).
      let end = i + 1;
      while (end < s.length) {
        if (s[end] === "'") {
          if (s[end + 1] === "'") {
            end += 2;
            continue;
          }
          break;
        }
        end++;
      }
      if (end >= s.length)
        throw new ParseFailure(
          'NOT_A_FORMULA',
          `Thiếu dấu nháy đơn đóng trong "${source}".`,
        );
      const quoted = s.slice(i + 1, end).replace(/''/g, "'");
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
    if (/[\p{L}_]/u.test(c)) {
      // Unicode letters allowed: Excel accepts an unquoted sheet name such as Tổng!A1.
      let j = i;
      while (j < s.length && /[\p{L}\p{M}\p{N}_]/u.test(s[j])) j++;
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
      const value = Number(t.text);
      if (Number.isNaN(value)) {
        throw new ParseFailure('UNEXPECTED_TOKEN', `Số không hợp lệ: "${t.text}".`);
      }
      return { kind: 'number', value };
    }

    if (t.type === 'string') {
      this.next();
      return { kind: 'string', value: t.text };
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

/** Excel refuses a formula longer than this; so do we, which also bounds the depth of a left-leaning chain. */
export const MAX_FORMULA_LENGTH = 8192;

export function parseFormula(source: string): ParseResult {
  const normalized = source.trim().replace(/^=/, '');
  if (normalized.length > MAX_FORMULA_LENGTH) {
    return {
      ok: false,
      error: {
        code: 'FORMULA_TOO_DEEP',
        message: `Công thức dài quá ${MAX_FORMULA_LENGTH} ký tự.`,
      },
    };
  }
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
  // A number or a canonical decimal string. Pass a string for anything that
  // can carry more than 15 significant digits: it is parsed by decimal.js
  // without ever passing through a double (OV4).
  | { kind: 'value'; value: Decimal.Value }
  | { kind: 'text'; value: string } // text cell: ignored by range aggregates, #VALUE! in arithmetic
  | { kind: 'boolean'; value: boolean } // a formula cell that returned TRUE/FALSE: ignored by range aggregates
  | { kind: 'blank' } // empty cell — behaves as 0 in direct arithmetic (Excel convention), excluded from AVERAGE/COUNT's denominator
  | { kind: 'none' } // NONE-aggregate field, or genuinely missing data (e.g. no previous period) — always an error in arithmetic
  | { kind: 'not_found' }
  | { kind: 'out_of_scope' }
  | { kind: 'cycle' }
  // An upstream formula cell that itself failed: its error propagates (Excel).
  | { kind: 'error'; code: EvalErrorCode };

/**
 * Thrown by an `EvalContext.expandRange` implementation that refuses to
 * allocate a reference list above its cap. Checked BEFORE allocating, so a
 * formula such as SUM(A1:XFD1048576) cannot exhaust memory ahead of the step
 * budget (OV9). The evaluator reports it as STEP_LIMIT_EXCEEDED.
 */
export class RangeLimitError extends Error {}

/** Thrown by `expandRange` when a corner lies outside the sheet (row 1..1048576, column A..XFD): Excel's #REF!. */
export class RangeBoundsError extends Error {}

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
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean };

/** Internal only: an empty cell stays distinct until a consumer decides if it is 0 or "". */
type Scalar = EvalValue | { type: 'blank' };

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

const ERROR_MESSAGES: Record<EvalErrorCode, string> = {
  DIV_BY_ZERO: 'Không tính được: chia cho 0.',
  MISSING_DATA: 'Thiếu dữ liệu để tính.',
  OUT_OF_SCOPE_REFERENCE: 'Ô tham chiếu nằm ngoài phạm vi báo cáo.',
  CYCLE_DETECTED: 'Công thức tham chiếu vòng lặp.',
  NOT_FOUND_REFERENCE: 'Địa chỉ ô không tồn tại trong mẫu.',
  STEP_LIMIT_EXCEEDED: 'Công thức vượt quá giới hạn bước tính.',
  TYPE_ERROR: 'Mong đợi giá trị số.',
};

/**
 * Number a resolution stands for, `null` for a blank, and — for a text cell —
 * `'text'` so each caller picks its own rule (aggregates skip it, arithmetic
 * rejects it). Every failure kind throws its own code, which is what lets an
 * upstream formula error propagate unchanged.
 */
function resolutionToNumberOrNull(
  resolution: CellResolution,
): Decimal | null | 'text' {
  switch (resolution.kind) {
    case 'value':
      return new Decimal(resolution.value);
    case 'text':
    case 'boolean':
      return 'text'; // not a number: aggregates skip it, arithmetic rejects it
    case 'error':
      throw new EvalFailure(resolution.code, ERROR_MESSAGES[resolution.code]);
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

function asNumber(value: Scalar): Decimal {
  if (value.type === 'blank') return new Decimal(0);
  if (value.type !== 'number') {
    throw new EvalFailure('TYPE_ERROR', 'Mong đợi giá trị số.');
  }
  return value.value;
}

function asBoolean(value: Scalar): boolean {
  if (value.type === 'blank') return false;
  if (value.type === 'boolean') return value.value;
  if (value.type === 'number') return !value.value.isZero();
  throw new EvalFailure('TYPE_ERROR', 'Mong đợi giá trị đúng/sai.');
}

/** Text a value contributes to `&` and to text comparison (General format, Excel TRUE/FALSE). */
function asText(value: Scalar): string {
  switch (value.type) {
    case 'blank':
      return '';
    case 'string':
      return value.value;
    case 'boolean':
      return value.value ? 'TRUE' : 'FALSE';
    case 'number':
      return value.value.toFixed();
  }
}

function num(n: Decimal.Value): EvalValue {
  return { type: 'number', value: new Decimal(n) };
}
function bool(b: boolean): EvalValue {
  return { type: 'boolean', value: b };
}
function str(s: string): EvalValue {
  return { type: 'string', value: s };
}

class Evaluator {
  private ctx: EvalContext;
  private budget: Budget;
  constructor(ctx: EvalContext, budget: Budget) {
    this.ctx = ctx;
    this.budget = budget;
  }

  /** A referenced cell as a scalar: blank stays blank, text stays text. */
  evalCell(ref: CellReference): Scalar {
    const resolution = this.ctx.resolveCell(ref);
    if (resolution.kind === 'boolean') return bool(resolution.value);
    const n = resolutionToNumberOrNull(resolution);
    if (n === null) return { type: 'blank' };
    if (n === 'text') {
      return str(resolution.kind === 'text' ? resolution.value : '');
    }
    return num(n);
  }

  /**
   * Flattens a range to the numbers it contains, the way SUM/AVERAGE/MIN/
   * MAX/COUNT see it: blanks and text cells are skipped (Excel), a failed
   * cell propagates its own error.
   */
  flattenRangeValues(range: Extract<Expr, { kind: 'range' }>): Decimal[] {
    let refs: CellReference[];
    try {
      refs = this.ctx.expandRange({
        sheetFrom: range.sheetFrom,
        sheetTo: range.sheetTo,
        cellFrom: range.cellFrom,
        cellTo: range.cellTo,
      });
    } catch (e) {
      if (e instanceof RangeLimitError) {
        throw new EvalFailure('STEP_LIMIT_EXCEEDED', ERROR_MESSAGES.STEP_LIMIT_EXCEEDED);
      }
      if (e instanceof RangeBoundsError) {
        throw new EvalFailure('NOT_FOUND_REFERENCE', ERROR_MESSAGES.NOT_FOUND_REFERENCE);
      }
      throw e;
    }
    return this.numbersOf(refs);
  }

  private numbersOf(refs: CellReference[]): Decimal[] {
    const values: Decimal[] = [];
    for (const ref of refs) {
      this.budget.consume();
      const n = resolutionToNumberOrNull(this.ctx.resolveCell(ref));
      if (n !== null && n !== 'text') values.push(n);
    }
    return values;
  }

  /** Public entry: a formula never yields "blank" — Excel shows 0 for `=A1` over an empty A1. */
  evalFinal(expr: Expr): EvalValue {
    const v = this.eval(expr);
    return v.type === 'blank' ? num(0) : v;
  }

  eval(expr: Expr): Scalar {
    this.budget.consume();

    switch (expr.kind) {
      case 'number':
        return num(expr.value);
      case 'string':
        return str(expr.value);
      case 'boolean':
        return bool(expr.value);
      case 'cell':
        return this.evalCell({ sheet: expr.sheet, cell: expr.cell });
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
        if (n === 'text') {
          throw new EvalFailure('TYPE_ERROR', 'Mong đợi giá trị số.');
        }
        return num(n ?? 0);
      }
    }
  }

  private evalBinary(expr: Extract<Expr, { kind: 'binary' }>): Scalar {
    const left = this.eval(expr.left);
    const right = this.eval(expr.right);

    if (expr.op === '&') {
      return str(asText(left) + asText(right));
    }

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

  private compare(op: BinaryOp, left: Scalar, right: Scalar): boolean {
    if (left.type === 'string' || right.type === 'string') {
      // A number or boolean never equals text and sorts before it (Excel);
      // a blank is the empty string against text. Text compares
      // case-insensitively.
      const leftIsText = left.type === 'string' || left.type === 'blank';
      const rightIsText = right.type === 'string' || right.type === 'blank';
      if (!leftIsText || !rightIsText) {
        const order = leftIsText ? 1 : -1; // text sorts after numbers
        switch (op) {
          case '=':
            return false;
          case '<>':
            return true;
          case '<':
          case '<=':
            return order < 0;
          default:
            return order > 0;
        }
      }
      const l = asText(left).toLowerCase();
      const r = asText(right).toLowerCase();
      switch (op) {
        case '=':
          return l === r;
        case '<>':
          return l !== r;
        case '<':
          return l < r;
        case '<=':
          return l <= r;
        case '>':
          return l > r;
        default:
          return l >= r;
      }
    }
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

  private evalCall(expr: Extract<Expr, { kind: 'call' }>): Scalar {
    const collectRangeNumbers = (arg: Expr): Decimal[] => {
      if (arg.kind === 'range') return this.flattenRangeValues(arg);
      // A lone cell reference behaves like a one-cell range (Excel): a
      // blank or text cell is skipped rather than counted as 0.
      if (arg.kind === 'cell') {
        this.budget.consume();
        return this.numbersOf([{ sheet: arg.sheet, cell: arg.cell }]);
      }
      return [asNumber(this.eval(arg))];
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
        return num(all.reduce((a, b) => (b.lessThan(a) ? b : a)));
      }
      case 'MAX': {
        const all = expr.args.flatMap(collectRangeNumbers);
        if (all.length === 0)
          throw new EvalFailure('MISSING_DATA', 'Thiếu dữ liệu để tính.');
        return num(all.reduce((a, b) => (b.greaterThan(a) ? b : a)));
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
        const digits = asNumber(this.eval(expr.args[1])).trunc().toNumber();
        if (!Number.isFinite(digits) || Math.abs(digits) > 1000) {
          throw new EvalFailure('TYPE_ERROR', 'ROUND: số chữ số làm tròn không hợp lệ.');
        }
        if (digits >= 0) {
          return num(value.toDecimalPlaces(digits, Decimal.ROUND_HALF_UP));
        }
        // Excel: ROUND(1250,-2) = 1300 — round to tens/hundreds, half away from zero.
        const unit = new Decimal(10).pow(-digits);
        return num(
          value.dividedBy(unit).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).times(unit),
        );
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

/** Evaluates an already-parsed tree — the workbook evaluator parses each formula once and re-runs it many times. */
export function evaluateExpr(
  expr: Expr,
  ctx: EvalContext,
  options: EvalOptions = {},
): EvalResult {
  const budget = new Budget(options.maxSteps ?? DEFAULT_MAX_STEPS);
  const evaluator = new Evaluator(ctx, budget);
  try {
    const value = evaluator.evalFinal(expr);
    return { ok: true, value };
  } catch (e) {
    if (e instanceof EvalFailure) {
      return { ok: false, error: { code: e.code, message: e.message } };
    }
    // A user formula must never take the evaluator down: a runaway tree is a
    // stack overflow, a bad argument surfaces as a decimal.js error.
    if (e instanceof RangeError) {
      return {
        ok: false,
        error: { code: 'STEP_LIMIT_EXCEEDED', message: ERROR_MESSAGES.STEP_LIMIT_EXCEEDED },
      };
    }
    if (e instanceof Error && e.message.startsWith('[DecimalError]')) {
      return { ok: false, error: { code: 'TYPE_ERROR', message: ERROR_MESSAGES.TYPE_ERROR } };
    }
    throw e;
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
  return evaluateExpr(parsed.expr, ctx, options);
}

// ---------------------------------------------------------------------------
// Reference utilities (workbook graph, template export)
// ---------------------------------------------------------------------------

export interface FormulaRefs {
  cells: CellReference[];
  ranges: RangeReference[];
}

/**
 * Every cell and range a formula mentions, in source order. `PREV(ref)`
 * points at the previous PERIOD, not at this workbook, so a dependency graph
 * passes `includePrev: false`.
 */
export function collectRefs(
  expr: Expr,
  options: { includePrev?: boolean } = {},
): FormulaRefs {
  const includePrev = options.includePrev ?? true;
  const out: FormulaRefs = { cells: [], ranges: [] };
  const visit = (e: Expr): void => {
    switch (e.kind) {
      case 'cell':
        out.cells.push({ sheet: e.sheet, cell: e.cell });
        return;
      case 'range':
        out.ranges.push({
          sheetFrom: e.sheetFrom,
          sheetTo: e.sheetTo,
          cellFrom: e.cellFrom,
          cellTo: e.cellTo,
        });
        return;
      case 'binary':
        visit(e.left);
        visit(e.right);
        return;
      case 'unary':
        visit(e.operand);
        return;
      case 'call':
        e.args.forEach(visit);
        return;
      case 'prev':
        if (includePrev) visit(e.ref);
        return;
      default:
        return;
    }
  };
  visit(expr);
  return out;
}

const BARE_SHEET_RE = /^[\p{L}_][\p{L}\p{M}\p{N}_]*$/u;
// Excel only quotes a name that could be read as a cell address (columns run A..XFD, so at most 3 letters).
const CELL_LIKE_RE = /^[A-Za-z]{1,3}[0-9]+$/;

function sheetPrefix(name: string): string {
  const bare =
    BARE_SHEET_RE.test(name) &&
    !CELL_LIKE_RE.test(name) &&
    !['TRUE', 'FALSE', 'PREV'].includes(name.toUpperCase());
  return bare ? `${name}!` : `'${name.replace(/'/g, "''")}'!`;
}

const BINARY_PRECEDENCE: Record<BinaryOp, number> = {
  '=': 1,
  '<>': 1,
  '<': 1,
  '<=': 1,
  '>': 1,
  '>=': 1,
  '&': 2,
  '+': 3,
  '-': 3,
  '*': 4,
  '/': 4,
};
const UNARY_PRECEDENCE = 5;

function precedenceOf(e: Expr): number {
  if (e.kind === 'binary') return BINARY_PRECEDENCE[e.op];
  if (e.kind === 'unary') return UNARY_PRECEDENCE;
  return 99;
}

/**
 * Inverse of `parseFormula`: canonical formula text (no leading "="), with
 * parentheses only where precedence requires them. The template export
 * writes this back into cells after sheet names are rewritten.
 */
export function formatFormula(expr: Expr): string {
  const wrap = (child: Expr, minPrecedence: number): string => {
    const text = formatFormula(child);
    return precedenceOf(child) < minPrecedence ? `(${text})` : text;
  };
  switch (expr.kind) {
    case 'number':
      return new Decimal(expr.value).toFixed(); // never exponent notation: 1e+21 would not parse back
    case 'string':
      return `"${expr.value.replace(/"/g, '""')}"`;
    case 'boolean':
      return expr.value ? 'TRUE' : 'FALSE';
    case 'cell':
      return `${expr.sheet ? sheetPrefix(expr.sheet) : ''}${expr.cell}`;
    case 'range': {
      const body = expr.cellTo ? `${expr.cellFrom}:${expr.cellTo}` : expr.cellFrom;
      if (!expr.sheetFrom) return body;
      if (expr.sheetTo && expr.sheetTo !== expr.sheetFrom) {
        const joined = `${expr.sheetFrom}:${expr.sheetTo}`.replace(/'/g, "''");
        return `'${joined}'!${body}`;
      }
      return `${sheetPrefix(expr.sheetFrom)}${body}`;
    }
    case 'unary':
      return `-${wrap(expr.operand, UNARY_PRECEDENCE)}`;
    case 'binary': {
      const p = BINARY_PRECEDENCE[expr.op];
      // All binary operators here are left-associative: a same-precedence
      // right operand needs parentheses, a same-precedence left one does not.
      return `${wrap(expr.left, p)}${expr.op}${wrap(expr.right, p + 1)}`;
    }
    case 'call':
      return `${expr.name}(${expr.args.map(formatFormula).join(',')})`;
    case 'prev':
      return `PREV(${formatFormula(expr.ref)})`;
  }
}

/**
 * New tree with every explicit sheet name passed through `rename`. An
 * unqualified reference keeps meaning "this sheet", so it is left alone —
 * which is exactly what a sheet clone needs.
 */
export function rewriteSheetRefs(
  expr: Expr,
  rename: (sheet: string) => string,
): Expr {
  const go = (e: Expr): Expr => {
    switch (e.kind) {
      case 'cell':
        return e.sheet ? { ...e, sheet: rename(e.sheet) } : e;
      case 'range':
        return {
          ...e,
          sheetFrom: e.sheetFrom ? rename(e.sheetFrom) : e.sheetFrom,
          sheetTo: e.sheetTo ? rename(e.sheetTo) : e.sheetTo,
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
