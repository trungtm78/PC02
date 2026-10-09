import { parseFormula, evaluateFormula } from './expr';
import type {
  EvalContext,
  CellResolution,
  CellReference,
  RangeReference,
} from './expr';

/**
 * Expr engine — formula parser/evaluator for cell formulas AND validation
 * rules (FRD §4.5/§10 R2, D05). Pure, no I/O. The engine knows nothing
 * about the workbook's actual layout or data — every cell/range reference
 * is resolved through a caller-supplied `EvalContext`, so these tests use
 * a tiny in-memory fixture context instead of a real grid.
 *
 * Allowed grammar (D05): + - * /, &, comparisons, SUM AVERAGE MIN MAX
 * COUNT IF ROUND AND OR ABS, cell/range/cross-sheet references, PREV(ref).
 * No eval of arbitrary code, no external links, cycle detection, a finite
 * step budget instead of a wall-clock timeout (pure function, no I/O).
 */

function makeContext(overrides: Partial<EvalContext> = {}): EvalContext {
  const cells: Record<string, number | null> = {
    A1: 10,
    A2: 0,
    A3: null as unknown as number, // blank
    B1: 5,
  };
  const sheetOrder = ['Team1', 'Team2', 'Team3'];
  const sheetCells: Record<string, Record<string, number | null>> = {
    Team1: { C6: 10 },
    Team2: { C6: 0 },
    Team3: { C6: null as unknown as number },
  };

  return {
    resolveCell(ref: CellReference): CellResolution {
      if (ref.sheet && sheetCells[ref.sheet]) {
        const v = sheetCells[ref.sheet][ref.cell];
        return v === null || v === undefined
          ? { kind: 'blank' }
          : { kind: 'value', value: v };
      }
      if (!ref.sheet) {
        const v = cells[ref.cell];
        if (v === undefined) return { kind: 'not_found' };
        return v === null ? { kind: 'blank' } : { kind: 'value', value: v };
      }
      return { kind: 'not_found' };
    },
    expandRange(ref: RangeReference): CellReference[] {
      if (ref.sheetFrom && ref.sheetTo) {
        const fromIdx = sheetOrder.indexOf(ref.sheetFrom);
        const toIdx = sheetOrder.indexOf(ref.sheetTo);
        if (fromIdx === -1 || toIdx === -1) return [];
        return sheetOrder
          .slice(fromIdx, toIdx + 1)
          .map((sheet) => ({ sheet, cell: ref.cellFrom }));
      }
      // Simple same-sheet cell range A1:A3 -> [A1, A2, A3] (single column only, enough for these tests).
      const col = ref.cellFrom.replace(/\d+/, '');
      const fromRow = Number(ref.cellFrom.replace(/\D+/, ''));
      const toRow = Number((ref.cellTo ?? ref.cellFrom).replace(/\D+/, ''));
      const out: CellReference[] = [];
      for (let r = fromRow; r <= toRow; r++)
        out.push({ sheet: ref.sheetFrom, cell: `${col}${r}` });
      return out;
    },
    prevValue(): CellResolution {
      return { kind: 'not_found' };
    },
    ...overrides,
  };
}

describe('parseFormula — grammar acceptance', () => {
  it('parses a simple addition', () => {
    const result = parseFormula('A1+B1');
    expect(result.ok).toBe(true);
  });

  it('parses SUM over a range', () => {
    expect(parseFormula('SUM(A1:A3)').ok).toBe(true);
  });

  it('parses a 3-D sheet range', () => {
    expect(parseFormula("SUM('Team1:Team3'!C6)").ok).toBe(true);
  });

  it('parses IF with a comparison', () => {
    expect(parseFormula('IF(A1=B1,1,0)').ok).toBe(true);
  });

  it('parses nested function calls', () => {
    expect(parseFormula('ROUND(AVERAGE(A1:A3),2)').ok).toBe(true);
  });

  it('rejects an unknown function', () => {
    const result = parseFormula('TOTALX(A1:A3)');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNKNOWN_FUNCTION');
  });

  it('rejects a disallowed construct (external file reference)', () => {
    const result = parseFormula("'[Book1.xlsx]Sheet1'!A1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DISALLOWED_CONSTRUCT');
  });

  it('rejects a pathologically deep nested-parenthesis formula at parse time instead of overflowing the call stack', () => {
    let formula = 'A1';
    for (let i = 0; i < 5000; i++) formula = `(${formula}+1)`;
    const result = parseFormula(formula);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORMULA_TOO_DEEP');
  });

  it('rejects a pathologically deep unary-minus chain the same way', () => {
    const formula = '-'.repeat(5000) + 'A1';
    const result = parseFormula(formula);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('FORMULA_TOO_DEEP');
  });

  it('accepts reasonable nesting well under the depth limit', () => {
    let formula = 'A1';
    for (let i = 0; i < 20; i++) formula = `(${formula}+1)`;
    expect(parseFormula(formula).ok).toBe(true);
  });

  it('parses an unquoted single-sheet reference: Sheet1!A1', () => {
    expect(parseFormula('Sheet1!A1').ok).toBe(true);
  });

  it('parses an unquoted single-sheet range: Sheet1!A1:A3', () => {
    expect(parseFormula('Sheet1!A1:A3').ok).toBe(true);
  });

  it('accepts a decimal number literal', () => {
    expect(parseFormula('1.5+A1').ok).toBe(true);
  });

  it('accepts whitespace around tokens', () => {
    expect(parseFormula(' A1 + B1 ').ok).toBe(true);
  });

  it('accepts <> <= >= comparison operators', () => {
    expect(parseFormula('A1<>B1').ok).toBe(true);
    expect(parseFormula('A1<=B1').ok).toBe(true);
    expect(parseFormula('A1>=B1').ok).toBe(true);
  });

  it('rejects an unterminated quoted sheet name', () => {
    const result = parseFormula("'Team1!A1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_A_FORMULA');
  });

  it('rejects a stray unquoted bracket', () => {
    const result = parseFormula('[A1]');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('DISALLOWED_CONSTRUCT');
  });

  it('rejects an invalid character', () => {
    const result = parseFormula('A1 @ B1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_A_FORMULA');
  });

  it('rejects trailing garbage after a complete expression', () => {
    const result = parseFormula('A1 B1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNEXPECTED_TOKEN');
  });

  it('rejects an unclosed parenthesis', () => {
    expect(parseFormula('(A1+B1').ok).toBe(false);
  });

  it('rejects an invalid cell address like "1A"', () => {
    const result = parseFormula('1A+B1');
    // "1A" tokenizes as number "1" then ident "A" — exercised via a
    // different invalid shape: a function-like identifier immediately
    // followed by a malformed cell token.
    expect(result.ok).toBe(false);
  });

  it('rejects a bad cell address on the right side of a range (A1:1B)', () => {
    const result = parseFormula('SUM(A1:1B)');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNEXPECTED_TOKEN');
  });
});

describe('evaluateFormula — additional type/arity/scope errors', () => {
  it('rejects IF with the wrong number of arguments', () => {
    const ctx = makeContext();
    const result = evaluateFormula('IF(A1>0,1)', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TYPE_ERROR');
  });

  it('rejects ROUND with the wrong number of arguments', () => {
    const ctx = makeContext();
    const result = evaluateFormula('ROUND(1.5)', ctx);
    expect(result.ok).toBe(false);
  });

  it('rejects ABS with the wrong number of arguments', () => {
    const ctx = makeContext();
    const result = evaluateFormula('ABS(1,2)', ctx);
    expect(result.ok).toBe(false);
  });

  it('rejects "&" text concatenation (accepted by the grammar, but this numeric engine has no string type)', () => {
    const ctx = makeContext();
    const result = evaluateFormula('A1&B1', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TYPE_ERROR');
  });

  it('rejects a bare range used outside an aggregate function', () => {
    const ctx = makeContext();
    const result = evaluateFormula('A1:A3', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TYPE_ERROR');
  });

  it('rejects PREV() applied to a non-cell expression', () => {
    const ctx = makeContext();
    const result = evaluateFormula('PREV(A1+1)', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TYPE_ERROR');
  });

  it('surfaces NOT_FOUND_REFERENCE for an address the template layout does not recognize', () => {
    const ctx = makeContext({ resolveCell: () => ({ kind: 'not_found' }) });
    const result = evaluateFormula('A1', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_FOUND_REFERENCE');
  });

  it('SUM/AVERAGE/MIN/MAX/COUNT exclude blanks from a 3-D sheet range the same way as a plain range', () => {
    const ctx = makeContext();
    const result = evaluateFormula("COUNT('Team1:Team3'!C6)", ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'number')
      expect(result.value.value.toNumber()).toBe(2);
  });

  it('MIN/MAX/AVERAGE on an all-blank range is MISSING_DATA, not a silent 0', () => {
    const ctx = makeContext({ resolveCell: () => ({ kind: 'blank' }) });
    expect(evaluateFormula('AVERAGE(A1:A3)', ctx).ok).toBe(false);
    expect(evaluateFormula('MIN(A1:A3)', ctx).ok).toBe(false);
    expect(evaluateFormula('MAX(A1:A3)', ctx).ok).toBe(false);
  });

  it('comparing two boolean values with an unsupported operator (e.g. ">") is a type error', () => {
    const ctx = makeContext();
    const result = evaluateFormula('AND(TRUE,FALSE)>OR(TRUE,FALSE)', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('TYPE_ERROR');
  });

  it('a non-zero number used where a boolean is expected (IF condition) is treated as true, matching Excel-like coercion', () => {
    const ctx = makeContext();
    const result = evaluateFormula('IF(A1,1,0)', ctx); // A1 = 10, non-zero
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'number')
      expect(result.value.value.toNumber()).toBe(1);
  });

  it('propagates a parse error through evaluateFormula as a non-ok result', () => {
    const ctx = makeContext();
    const result = evaluateFormula('TOTALX(A1)', ctx);
    expect(result.ok).toBe(false);
  });
});

describe('evaluateFormula — arithmetic and functions', () => {
  it('evaluates A1+B1 = 15', () => {
    const ctx = makeContext();
    const result = evaluateFormula('A1+B1', ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'number')
      expect(result.value.value.toNumber()).toBe(15);
  });

  it('evaluates SUM(A1:A3) ignoring the blank A3', () => {
    const ctx = makeContext();
    const result = evaluateFormula('SUM(A1:A3)', ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'number')
      expect(result.value.value.toNumber()).toBe(10);
  });

  it('evaluates the real-world 3-D SUM pattern: SUM(Team1:Team3!C6) = 10 (ignores the blank Team3)', () => {
    const ctx = makeContext();
    const result = evaluateFormula("SUM('Team1:Team3'!C6)", ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'number')
      expect(result.value.value.toNumber()).toBe(10);
  });

  it('evaluates AVERAGE ignoring blanks, counting the zero', () => {
    const ctx = makeContext();
    const result = evaluateFormula('AVERAGE(A1:A3)', ctx); // 10, 0, blank -> avg of [10,0] = 5
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'number')
      expect(result.value.value.toNumber()).toBe(5);
  });

  it('evaluates COUNT counting only non-blank cells', () => {
    const ctx = makeContext();
    const result = evaluateFormula('COUNT(A1:A3)', ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'number')
      expect(result.value.value.toNumber()).toBe(2);
  });

  it('evaluates MIN/MAX', () => {
    const ctx = makeContext();
    expect(
      (
        evaluateFormula('MIN(A1:A3)', ctx) as {
          ok: true;
          value: { type: 'number'; value: { toNumber(): number } };
        }
      ).value.value.toNumber(),
    ).toBe(0);
    expect(
      (
        evaluateFormula('MAX(A1:A3)', ctx) as {
          ok: true;
          value: { type: 'number'; value: { toNumber(): number } };
        }
      ).value.value.toNumber(),
    ).toBe(10);
  });

  it('evaluates ROUND', () => {
    const ctx = makeContext();
    const result = evaluateFormula('ROUND(1.567,2)', ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'number')
      expect(result.value.value.toNumber()).toBe(1.57);
  });

  it('evaluates ABS', () => {
    const ctx = makeContext();
    const result = evaluateFormula('ABS(0-A1)', ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'number')
      expect(result.value.value.toNumber()).toBe(10);
  });

  it('evaluates IF/AND/OR with comparisons', () => {
    const ctx = makeContext();
    const r1 = evaluateFormula('IF(A1>B1,1,0)', ctx);
    expect(r1.ok).toBe(true);
    if (r1.ok && r1.value.type === 'number')
      expect(r1.value.value.toNumber()).toBe(1);

    const r2 = evaluateFormula('AND(A1>B1,B1>0)', ctx);
    expect(r2.ok).toBe(true);
    if (r2.ok && r2.value.type === 'boolean') expect(r2.value.value).toBe(true);

    const r3 = evaluateFormula('OR(A1<B1,B1>0)', ctx);
    expect(r3.ok).toBe(true);
    if (r3.ok && r3.value.type === 'boolean') expect(r3.value.value).toBe(true);
  });

  it('rejects a reference to an out-of-scope sheet', () => {
    const ctx = makeContext({
      resolveCell: () => ({ kind: 'out_of_scope' }),
    });
    const result = evaluateFormula('A1', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('OUT_OF_SCOPE_REFERENCE');
  });

  it('division by zero returns a clear error, not Infinity/NaN', () => {
    const ctx = makeContext();
    const result = evaluateFormula('A1/0', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DIV_BY_ZERO');
      expect(result.error.message).toContain('Không tính được');
    }
  });

  it('a reference to a cell holding NONE-aggregate data yields MISSING_DATA, never silently 0 (FRD §4.5)', () => {
    const ctx = makeContext({
      resolveCell: () => ({ kind: 'none' }),
    });
    const result = evaluateFormula('A1+1', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_DATA');
      expect(result.error.message).toContain('Thiếu dữ liệu để tính');
    }
  });

  it('detects a cycle reported by the context and does not loop forever', () => {
    const ctx = makeContext({
      resolveCell: () => ({ kind: 'cycle' }),
    });
    const result = evaluateFormula('A1', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CYCLE_DETECTED');
  });

  it('enforces a finite step budget instead of evaluating an unbounded expression forever', () => {
    const ctx = makeContext();
    // Wide, not deep: a single SUM() with many comma-separated args is
    // parsed as a flat loop (no recursion-per-arg), so this exercises the
    // EVALUATOR's step budget specifically, without also tripping the
    // parser's own nesting-depth guard (see the FORMULA_TOO_DEEP test below).
    const formula = `SUM(${Array(2000).fill('A1').join(',')})`;
    const result = evaluateFormula(formula, ctx, { maxSteps: 500 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('STEP_LIMIT_EXCEEDED');
  });

  it('a normal-sized formula stays comfortably within the default step budget', () => {
    const ctx = makeContext();
    const result = evaluateFormula(
      'SUM(A1:A3)+AVERAGE(A1:A3)*2-ABS(0-B1)',
      ctx,
    );
    expect(result.ok).toBe(true);
  });

  it("PREV(ref) resolves through the context's prevValue hook", () => {
    const ctx = makeContext({
      prevValue: () => ({ kind: 'value', value: 42 }),
    });
    const result = evaluateFormula('PREV(A1)', ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'number')
      expect(result.value.value.toNumber()).toBe(42);
  });

  it('PREV(ref) surfaces MISSING_DATA when there is no previous period (per context)', () => {
    const ctx = makeContext({
      prevValue: () => ({ kind: 'none' }),
    });
    const result = evaluateFormula('PREV(A1)+1', ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('MISSING_DATA');
  });

  it('a blank (empty, non-NONE) cell behaves as 0 in direct arithmetic, same as Excel (distinct from the NONE-aggregate MISSING_DATA case above)', () => {
    const ctx = makeContext(); // A3 is blank
    const result = evaluateFormula('A1+A3', ctx);
    expect(result.ok).toBe(true);
    if (result.ok && result.value.type === 'number')
      expect(result.value.value.toNumber()).toBe(10);
  });
});
