import {
  parseFormula,
  evaluateFormula,
  collectRefs,
  formatFormula,
  rewriteSheetRefs,
  RangeLimitError,
} from './expr';
import type { EvalContext, CellResolution, CellReference } from './expr';

/**
 * G0 — grid-era extensions of the expression engine: string literals and
 * `&`, text comparison, decimal-exact cell values (OV4), error propagation
 * through cell resolutions, range allocation guard (OV9), and the reference
 * utilities the workbook evaluator and the template export build on.
 *
 * Expected values are written by hand from Excel's documented behaviour,
 * never produced by running the code under test.
 */

function ctxOf(
  cells: Record<string, CellResolution>,
  extra: Partial<EvalContext> = {},
): EvalContext {
  return {
    resolveCell: (ref: CellReference) =>
      cells[ref.cell] ?? ({ kind: 'blank' } as CellResolution),
    expandRange: () => [],
    prevValue: () => ({ kind: 'none' }),
    ...extra,
  };
}

function evalOk(source: string, ctx: EvalContext) {
  const r = evaluateFormula(source, ctx);
  if (!r.ok) throw new Error(`expected ok, got ${r.error.code}: ${r.error.message}`);
  return r.value;
}

describe('string literals and concatenation', () => {
  it('parses a double-quoted literal', () => {
    const p = parseFormula('"Đúng"');
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.expr).toEqual({ kind: 'string', value: 'Đúng' });
  });

  it('unescapes a doubled quote inside a literal', () => {
    const p = parseFormula('"a""b"');
    expect(p.ok).toBe(true);
    if (p.ok) expect(p.expr).toEqual({ kind: 'string', value: 'a"b' });
  });

  it('rejects an unterminated literal', () => {
    const p = parseFormula('"abc');
    expect(p.ok).toBe(false);
  });

  it('IF returns the text branch (real HSLN check formula shape)', () => {
    const ctx = ctxOf({
      X19: { kind: 'value', value: 7 },
      Y19: { kind: 'value', value: 7 },
    });
    expect(evalOk('IF(X19=Y19,"Đúng","Sai")', ctx)).toEqual({ type: 'string', value: 'Đúng' });
    const ctx2 = ctxOf({
      X19: { kind: 'value', value: 7 },
      Y19: { kind: 'value', value: 8 },
    });
    expect(evalOk('IF(X19=Y19,"Đúng","Sai")', ctx2)).toEqual({ type: 'string', value: 'Sai' });
  });

  it('& joins text and numbers using General formatting', () => {
    const ctx = ctxOf({
      A1: { kind: 'text', value: 'Tổ ' },
      B1: { kind: 'value', value: 3 },
    });
    expect(evalOk('A1&B1', ctx)).toEqual({ type: 'string', value: 'Tổ 3' });
    expect(evalOk('"x"&1.5', ctx)).toEqual({ type: 'string', value: 'x1.5' });
  });

  it('& treats a blank cell as the empty string', () => {
    const ctx = ctxOf({ A1: { kind: 'text', value: 'a' } });
    expect(evalOk('A1&B1', ctx)).toEqual({ type: 'string', value: 'a' });
  });

  it('text comparison is case-insensitive like Excel', () => {
    const ctx = ctxOf({ A1: { kind: 'text', value: 'Abc' } });
    expect(evalOk('A1="abc"', ctx)).toEqual({ type: 'boolean', value: true });
    expect(evalOk('A1<>"abd"', ctx)).toEqual({ type: 'boolean', value: true });
  });

  it('a blank cell equals both 0 and the empty string', () => {
    const ctx = ctxOf({});
    expect(evalOk('A1=0', ctx)).toEqual({ type: 'boolean', value: true });
    expect(evalOk('A1=""', ctx)).toEqual({ type: 'boolean', value: true });
  });

  it('arithmetic on text is a TYPE_ERROR (#VALUE!)', () => {
    const ctx = ctxOf({ A1: { kind: 'text', value: 'abc' } });
    const r = evaluateFormula('A1+1', ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('TYPE_ERROR');
  });
});

describe('decimal-exact cell values (OV4)', () => {
  it('keeps every digit of a value supplied as a decimal string', () => {
    const ctx = ctxOf({
      A1: { kind: 'value', value: '9007199254740993' },
      B1: { kind: 'value', value: '1' },
    });
    const v = evalOk('A1+B1', ctx);
    expect(v.type).toBe('number');
    if (v.type === 'number') expect(v.value.toFixed()).toBe('9007199254740994');
  });

  it('SUM over a range does not round-trip through double', () => {
    const cells: Record<string, CellResolution> = {
      A1: { kind: 'value', value: '9007199254740993' },
      A2: { kind: 'value', value: '2' },
    };
    const ctx = ctxOf(cells, {
      expandRange: () => [{ cell: 'A1' }, { cell: 'A2' }],
    });
    const v = evalOk('SUM(A1:A2)', ctx);
    if (v.type === 'number') expect(v.value.toFixed()).toBe('9007199254740995');
  });

  it('0.1+0.2 is exactly 0.3', () => {
    const ctx = ctxOf({
      A1: { kind: 'value', value: '0.1' },
      A2: { kind: 'value', value: '0.2' },
    });
    const v = evalOk('A1+A2', ctx);
    if (v.type === 'number') expect(v.value.toFixed()).toBe('0.3');
  });
});

describe('error propagation through cell resolutions', () => {
  it('an upstream error resolution surfaces its own code', () => {
    const ctx = ctxOf({ A1: { kind: 'error', code: 'DIV_BY_ZERO' } });
    const r = evaluateFormula('A1+1', ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('DIV_BY_ZERO');
  });

  it('IF does not evaluate the untaken branch, so its error does not leak', () => {
    const ctx = ctxOf({
      A1: { kind: 'value', value: 1 },
      B1: { kind: 'error', code: 'DIV_BY_ZERO' },
    });
    expect(evalOk('IF(A1=1,5,B1)', ctx)).toMatchObject({ type: 'number' });
  });

  it('an error inside a SUM range propagates (Excel: SUM of a #DIV/0! cell is #DIV/0!)', () => {
    const ctx = ctxOf(
      {
        A1: { kind: 'value', value: 1 },
        A2: { kind: 'error', code: 'NOT_FOUND_REFERENCE' },
      },
      { expandRange: () => [{ cell: 'A1' }, { cell: 'A2' }] },
    );
    const r = evaluateFormula('SUM(A1:A2)', ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('NOT_FOUND_REFERENCE');
  });
});

describe('range allocation guard (OV9)', () => {
  it('maps a RangeLimitError thrown by the context to STEP_LIMIT_EXCEEDED, not a crash', () => {
    const ctx = ctxOf(
      {},
      {
        expandRange: () => {
          throw new RangeLimitError('too big');
        },
      },
    );
    const r = evaluateFormula('SUM(A1:ZZ9999)', ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('STEP_LIMIT_EXCEEDED');
  });
});

describe('collectRefs', () => {
  it('lists every cell and range reference with its sheet', () => {
    const p = parseFormula("SUM(A1:A3)+'Đội 3:Cơ sở 2'!C6+Sheet2!B2");
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const refs = collectRefs(p.expr);
    expect(refs.cells).toEqual([{ sheet: 'Sheet2', cell: 'B2' }]);
    expect(refs.ranges).toEqual([
      { sheetFrom: undefined, sheetTo: undefined, cellFrom: 'A1', cellTo: 'A3' },
      { sheetFrom: 'Đội 3', sheetTo: 'Cơ sở 2', cellFrom: 'C6', cellTo: undefined },
    ]);
  });

  it('descends into IF branches and PREV', () => {
    const p = parseFormula('IF(A1>0,B1,PREV(C1))');
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(collectRefs(p.expr).cells.map((c) => c.cell).sort()).toEqual(['A1', 'B1', 'C1']);
  });
});

describe('formatFormula / rewriteSheetRefs', () => {
  const roundTrip = (src: string) => {
    const p = parseFormula(src);
    if (!p.ok) throw new Error(p.error.message);
    return formatFormula(p.expr);
  };

  it('round-trips the real shapes seen in the fixtures', () => {
    for (const src of [
      'SUM(D11:D12)',
      "SUM('Đội 3:Cơ sở 2'!C6)",
      'IF(X19=Y19,"Đúng","Sai")',
      'ROUND(A1/B1,2)',
      "'Tổ 1'!C6+'Tổ 2'!C6",
      'A1&" - "&B1',
      'IF(AND(A1>0,B1<5),1,0)',
      '-A1+2*(B1-3)',
    ]) {
      expect(roundTrip(src)).toBe(src);
    }
  });

  it('quotes a sheet name only when it needs it', () => {
    expect(roundTrip('Sheet2!A1')).toBe('Sheet2!A1');
    expect(roundTrip("'Sheet 2'!A1")).toBe("'Sheet 2'!A1");
  });

  it('rewrites sheet names through the mapping, including both ends of a 3-D range', () => {
    const p = parseFormula("SUM('Đội 3:Cơ sở 2'!C6)+Tổng!A1");
    if (!p.ok) throw new Error('parse');
    const out = rewriteSheetRefs(p.expr, (name) => `${name}_2`);
    expect(formatFormula(out)).toBe("SUM('Đội 3_2:Cơ sở 2_2'!C6)+Tổng_2!A1");
  });

  it('leaves unqualified refs untouched', () => {
    const p = parseFormula('A1+B2');
    if (!p.ok) throw new Error('parse');
    expect(formatFormula(rewriteSheetRefs(p.expr, (n) => `x${n}`))).toBe('A1+B2');
  });
});
