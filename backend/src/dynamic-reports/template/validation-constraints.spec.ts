import {
  deriveFromValidations,
  MAX_RULE_SUGGESTIONS,
  MAX_VALIDATIONS_PER_SHEET,
  MAX_UNSUPPORTED_REPORTED,
} from './validation-constraints';
import * as fs from 'fs';
import * as path from 'path';
import type { GridValidation } from '../engine/grid-types';
import { parseTemplate } from './parser';

/**
 * Excel's own data validation says what a cell may hold ("a whole number ≥ 0", "Q51 ≤ Q50"). The system takes it
 * over (review OV7) so the rule the officers always lived with still binds them in the web form, and the template
 * author does not have to type it a second time: constants become the field's range, a comparison with another
 * cell becomes a validation rule, anything else is said out loud instead of being silently dropped.
 */

const field = (address: string, type: 'NUM' | 'TEXT' | 'DATE' | 'TIME' = 'NUM', sheetKey = 'A10') => ({
  sheetKey,
  address,
  fieldKey: `${sheetKey}!${address}`,
  type,
});

function dv(over: Partial<GridValidation>): GridValidation {
  return {
    ranges: ['C9:V26'],
    type: 'whole',
    operator: 'greaterThanOrEqual',
    formula1: '0',
    allowBlank: true,
    showErrorMessage: true,
    ...over,
  };
}

const derive = (validations: GridValidation[], fields = [field('D10')]) =>
  deriveFromValidations([{ sheetKey: 'A10', validations }], fields);

describe('deriveFromValidations — constants become the field\'s range', () => {
  it('a whole number >= 0 is an integer with a minimum of 0', () => {
    const { constraints } = derive([dv({})]);
    expect(constraints.get('A10!D10')).toMatchObject({ min: '0', scale: 0 });
    expect(constraints.get('A10!D10')?.max).toBeUndefined();
  });

  it('only cells inside the validated ranges are touched', () => {
    const { constraints } = derive([dv({})], [field('D10'), field('A1'), field('W10'), field('C27')]);
    expect([...constraints.keys()]).toEqual(['A10!D10']);
  });

  it('a validation may cover several blocks', () => {
    const { constraints } = derive([dv({ ranges: ['A1:A3', 'C5:D6'] })], [field('A2'), field('D5'), field('B2')]);
    expect([...constraints.keys()].sort()).toEqual(['A10!A2', 'A10!D5']);
  });

  it.each([
    ['between', '1', '9', { min: '1', max: '9' }],
    ['greaterThanOrEqual', '5', undefined, { min: '5' }],
    ['lessThanOrEqual', '5', undefined, { max: '5' }],
    ['equal', '7', undefined, { min: '7', max: '7' }],
  ] as const)('decimal %s', (operator, f1, f2, expected) => {
    const { constraints } = derive([dv({ type: 'decimal', operator, formula1: f1, formula2: f2 })]);
    expect(constraints.get('A10!D10')).toMatchObject(expected);
    expect(constraints.get('A10!D10')?.scale).toBeUndefined(); // decimals keep the field's own scale
  });

  it('a strict comparison on a whole number moves the bound by one', () => {
    expect(derive([dv({ operator: 'greaterThan', formula1: '0' })]).constraints.get('A10!D10')?.min).toBe('1');
    expect(derive([dv({ operator: 'lessThan', formula1: '10' })]).constraints.get('A10!D10')?.max).toBe('9');
  });

  it('a strict comparison on a decimal cannot be a range and is said so', () => {
    const r = derive([dv({ type: 'decimal', operator: 'greaterThan', formula1: '0' })]);
    expect(r.constraints.get('A10!D10')?.min).toBeUndefined();
    expect(r.unsupported[0].message).toMatch(/lớn hơn|nhỏ hơn|chặt/);
  });

  it('with two validations on one cell the tighter bounds win', () => {
    const { constraints } = derive([
      dv({ operator: 'greaterThanOrEqual', formula1: '0' }),
      dv({ operator: 'between', formula1: '2', formula2: '50' }),
    ]);
    expect(constraints.get('A10!D10')).toMatchObject({ min: '2', max: '50' });
  });

  it('a text length bound becomes the field\'s maximum length', () => {
    const { constraints } = derive(
      [dv({ type: 'textLength', operator: 'lessThanOrEqual', formula1: '200' })],
      [field('D10', 'TEXT')],
    );
    expect(constraints.get('A10!D10')).toMatchObject({ maxLength: 200 });
  });

  it('the prompt of the template, else its error text, becomes the field\'s help', () => {
    expect(derive([dv({ prompt: 'Nhập số vụ', errorMessage: 'Sai' })]).constraints.get('A10!D10')?.helpText).toBe('Nhập số vụ');
    expect(derive([dv({ errorMessage: 'Chỉ nhập số nguyên không âm' })]).constraints.get('A10!D10')?.helpText).toBe(
      'Chỉ nhập số nguyên không âm',
    );
  });

  it('a number rule on a text or date field is not forced onto it', () => {
    const r = derive([dv({})], [field('D10', 'DATE')]);
    expect(r.constraints.size).toBe(0);
    expect(r.unsupported.length).toBe(1);
  });
});

describe('deriveFromValidations — a comparison with another cell becomes a rule', () => {
  it('Q51 <= Q50 is a validation rule over the two fields', () => {
    const r = deriveFromValidations(
      [
        {
          sheetKey: 'A09',
          validations: [
            dv({
              ranges: ['Q51'],
              type: 'whole',
              operator: 'lessThanOrEqual',
              formula1: 'Q50',
              errorMessage: 'Số bị can đã khởi tố không vượt quá số đã xác minh',
            }),
          ],
        },
      ],
      [field('Q51', 'NUM', 'A09')],
    );
    // The comparison is a rule, and the whole-number half of the validation stays on the field.
    expect(r.constraints.get('A09!Q51')).toEqual({ scale: 0, helpText: 'Số bị can đã khởi tố không vượt quá số đã xác minh' });
    expect(r.ruleSuggestions).toEqual([
      expect.objectContaining({
        leftExpr: "A09!Q51",
        operator: 'LTE',
        rightExpr: "A09!Q50",
        message: 'Số bị can đã khởi tố không vượt quá số đã xác minh',
        sheetKey: 'A09',
        address: 'Q51',
      }),
    ]);
  });

  it('a relative reference shifts with the cell, as Excel applies it down a range', () => {
    const r = deriveFromValidations(
      [{ sheetKey: 'A09', validations: [dv({ ranges: ['C5:C6'], operator: 'lessThanOrEqual', formula1: 'D5' })] }],
      [field('C5', 'NUM', 'A09'), field('C6', 'NUM', 'A09')],
    );
    expect(r.ruleSuggestions.map((s) => [s.leftExpr, s.rightExpr])).toEqual([
      ["A09!C5", "A09!D5"],
      ["A09!C6", "A09!D6"],
    ]);
  });

  it('an absolute reference stays put', () => {
    const r = deriveFromValidations(
      [{ sheetKey: 'A09', validations: [dv({ ranges: ['C5:C6'], operator: 'lessThanOrEqual', formula1: '$D$1' })] }],
      [field('C5', 'NUM', 'A09'), field('C6', 'NUM', 'A09')],
    );
    expect(r.ruleSuggestions.map((s) => s.rightExpr)).toEqual(["A09!D1", "A09!D1"]);
  });

  it('a reference to another sheet is kept qualified', () => {
    const r = derive([dv({ ranges: ['D10'], operator: 'equal', formula1: "'Tổng'!B2" })]);
    expect(r.ruleSuggestions[0]).toMatchObject({ operator: 'EQ', rightExpr: "'Tổng'!B2" });
  });

  it.each([
    ['greaterThan', 'GT'],
    ['greaterThanOrEqual', 'GTE'],
    ['lessThan', 'LT'],
    ['lessThanOrEqual', 'LTE'],
    ['equal', 'EQ'],
    ['notEqual', 'NEQ'],
  ] as const)('%s maps to %s', (operator, engine) => {
    const r = derive([dv({ ranges: ['D10'], operator, formula1: 'D9' })]);
    expect(r.ruleSuggestions[0].operator).toBe(engine);
  });

  it('with no message of its own the rule says what it compares', () => {
    const r = derive([dv({ ranges: ['D10'], operator: 'lessThanOrEqual', formula1: 'D9', errorMessage: undefined })]);
    expect(r.ruleSuggestions[0].message).toContain('D10');
    expect(r.ruleSuggestions[0].message).toContain('D9');
    expect(r.ruleSuggestions[0].name).toBeTruthy();
  });
});

describe('deriveFromValidations — what it cannot take over is said, never dropped quietly', () => {
  it.each([
    [{ type: 'list' as const, operator: undefined, formula1: '"a,b"' }, /danh sách/],
    [{ type: 'date' as const, operator: 'greaterThan' as const, formula1: '1' }, /ngày/],
    [{ type: 'custom' as const, operator: undefined, formula1: 'A1>0' }, /tuỳ chỉnh|công thức/],
    [{ type: 'whole' as const, operator: 'notBetween' as const, formula1: '1', formula2: '2' }, /ngoài|khác/],
    [{ type: 'whole' as const, operator: 'between' as const, formula1: 'A1+1', formula2: '9' }, /biểu thức|công thức/],
  ])('%j', (over, pattern) => {
    const r = derive([dv({ ranges: ['D10'], ...over })]);
    expect(r.constraints.size).toBe(0);
    expect(r.ruleSuggestions).toHaveLength(0);
    expect(r.unsupported).toHaveLength(1);
    expect(r.unsupported[0]).toMatchObject({ sheetKey: 'A10', address: 'D10' });
    expect(r.unsupported[0].message).toMatch(pattern);
  });

  it('a validation that touches no input cell says nothing', () => {
    const r = derive([dv({ type: 'list', operator: undefined, formula1: '"a,b"', ranges: ['Z99'] })]);
    expect(r.unsupported).toHaveLength(0);
  });

  it('says it once per validation, not once per cell it covers', () => {
    const r = derive(
      [dv({ type: 'list', operator: undefined, formula1: '"a,b"', ranges: ['D10:D12'] })],
      [field('D10'), field('D11'), field('D12')],
    );
    expect(r.unsupported).toHaveLength(1);
  });
});

describe('deriveFromValidations — "between 0 and <cell>", the usual shape in the real templates', () => {
  it('is a range on the constant bound and a rule on the cell bound', () => {
    const r = deriveFromValidations(
      [
        {
          sheetKey: 'A09',
          validations: [
            dv({ ranges: ['Q51', 'S51:V51'], type: 'whole', operator: 'between', formula1: '0', formula2: 'Q50', errorMessage: 'Bạn đã nhập sai.', prompt: 'Hàng 43 =< hàng 42' }),
          ],
        },
      ],
      [field('Q51', 'NUM', 'A09'), field('S51', 'NUM', 'A09')],
    );
    expect(r.constraints.get('A09!Q51')).toMatchObject({ min: '0', scale: 0 });
    // Q50 belongs to Q51; S51 sits two columns further right in the block, so its bound is S50.
    expect(r.ruleSuggestions.map((x) => [x.address, x.rightExpr, x.operator])).toEqual([
      ['Q51', "A09!Q50", 'LTE'],
      ['S51', "A09!S50", 'LTE'],
    ]);
    expect(r.ruleSuggestions[0].message).toBe('Bạn đã nhập sai. Hàng 43 =< hàng 42');
  });

  it('a bound that is neither a number nor a cell is not guessed', () => {
    const r = derive([dv({ ranges: ['D10'], operator: 'between', formula1: '0', formula2: 'SUM(A1:A3)' })]);
    expect(r.constraints.size).toBe(0);
    expect(r.unsupported).toHaveLength(1);
  });
});

describe('the real templates, end to end (parser → derivation)', () => {
  const REAL = path.join(__dirname, '../../../test/fixtures/dynamic-reports/real');
  jest.setTimeout(30_000);

  async function derivedFor(file: string, sheet: string) {
    const parsed = await parseTemplate(fs.readFileSync(path.join(REAL, file)), [sheet]);
    const fields = parsed.markableCells.map((c) => ({
      sheetKey: c.sheetKey,
      address: c.address,
      fieldKey: `${c.sheetKey}!${c.address}`,
      type: 'NUM' as const,
    }));
    return { parsed, derived: deriveFromValidations(parsed.dataValidations, fields) };
  }

  it('A10: the whole sheet block is "a whole number, not negative"', async () => {
    const { derived } = await derivedFor('a10_99_formulas.xlsx', 'A10');
    expect(derived.constraints.size).toBeGreaterThan(50);
    for (const c of derived.constraints.values()) expect(c).toMatchObject({ min: '0', scale: 0 });
    expect(derived.unsupported).toEqual([]);
  });

  it('A09: every row-43-at-most-row-42 comparison becomes a rule over the right two cells', async () => {
    const { derived } = await derivedFor('a09_1034_unlocked.xlsx', 'A09');
    const q51 = derived.ruleSuggestions.find((x) => x.address === 'Q51');
    expect(q51).toMatchObject({ leftExpr: "A09!Q51", operator: 'LTE', rightExpr: "A09!Q50" });
    expect(q51?.message).toContain('Hàng 43');
    // S51:V51 share Q51's rule: each column compares with the cell above it.
    expect(derived.ruleSuggestions.find((x) => x.address === 'V51')?.rightExpr).toBe("A09!V50");
    expect(derived.constraints.get('A09!Q51')).toMatchObject({ min: '0', scale: 0 });
  });
});

/** Found by review (Codex, OV7): each of these used to publish a rule looser or stricter than Excel's, or fail. */
describe('deriveFromValidations — exactness', () => {
  const one = (over: Partial<GridValidation>, f = field('D10')) =>
    deriveFromValidations([{ sheetKey: 'A10', validations: [dv({ ranges: ['D10'], ...over })] }], [f]);

  it('a strict comparison with a fractional bound on a whole number rounds the right way', () => {
    expect(one({ operator: 'greaterThan', formula1: '1.5' }).constraints.get('A10!D10')?.min).toBe('2');
    expect(one({ operator: 'lessThan', formula1: '1.5' }).constraints.get('A10!D10')?.max).toBe('1');
    expect(one({ operator: 'greaterThanOrEqual', formula1: '1.5' }).constraints.get('A10!D10')?.min).toBe('2');
    expect(one({ operator: 'lessThanOrEqual', formula1: '1.5' }).constraints.get('A10!D10')?.max).toBe('1');
    expect(one({ operator: 'between', formula1: '0.5', formula2: '9.5' }).constraints.get('A10!D10')).toMatchObject({
      min: '1',
      max: '9',
    });
  });

  it('"equal to a fraction" on a whole-number cell has no value that satisfies it and is said so', () => {
    const r = one({ operator: 'equal', formula1: '2.5' });
    expect(r.constraints.size).toBe(0);
    expect(r.unsupported[0].message).toMatch(/không có giá trị nào/);
  });

  it('a bound the database cannot keep exactly is not rounded into a looser rule', () => {
    for (const [type, formula1] of [
      ['decimal', '0.00006'],
      ['decimal', '100000000000000'],
      ['whole', '100000000000000'],
    ] as const) {
      const r = one({ type, operator: 'lessThanOrEqual', formula1 });
      expect(r.constraints.get('A10!D10')?.max).toBeUndefined();
      expect(r.unsupported[0].message).toMatch(/khả năng lưu/);
    }
    expect(
      one({ type: 'decimal', operator: 'lessThanOrEqual', formula1: '99999999999999.9999' }).constraints.get('A10!D10')?.max,
    ).toBe('99999999999999.9999');
  });

  it('a whole-number comparison with another cell still forbids fractions', () => {
    const r = one({ operator: 'lessThanOrEqual', formula1: 'D9' });
    expect(r.constraints.get('A10!D10')).toMatchObject({ scale: 0 });
    expect(r.ruleSuggestions).toHaveLength(1);
    // a decimal one has no such half
    expect(one({ type: 'decimal', operator: 'lessThanOrEqual', formula1: 'D9' }).constraints.size).toBe(0);
  });

  it('a shortest or exact text length is reported as the part that was not taken over', () => {
    const f = field('D10', 'TEXT');
    const exact = one({ type: 'textLength', operator: 'equal', formula1: '5' }, f);
    expect(exact.constraints.get('A10!D10')).toMatchObject({ maxLength: 5 });
    expect(exact.unsupported[0].message).toMatch(/tối thiểu|chính xác/);
    const between = one({ type: 'textLength', operator: 'between', formula1: '3', formula2: '5' }, f);
    expect(between.constraints.get('A10!D10')).toMatchObject({ maxLength: 5 });
    expect(between.unsupported).toHaveLength(1);
    // "up to 5" (and "between 0 and 5") loses nothing
    expect(one({ type: 'textLength', operator: 'between', formula1: '0', formula2: '5' }, f).unsupported).toEqual([]);
  });

  it('validations that contradict each other on one cell take neither bound, and say so', () => {
    const r = deriveFromValidations(
      [
        {
          sheetKey: 'A10',
          validations: [
            dv({ ranges: ['D10'], operator: 'greaterThanOrEqual', formula1: '10' }),
            dv({ ranges: ['D10'], operator: 'lessThanOrEqual', formula1: '5' }),
          ],
        },
      ],
      [field('D10')],
    );
    expect(r.constraints.has('A10!D10')).toBe(false);
    expect(r.unsupported[0].message).toMatch(/mâu thuẫn/);
  });

  it('the same comparison on two sheets gets two different names', () => {
    const r = deriveFromValidations(
      [
        { sheetKey: 'S1', validations: [dv({ ranges: ['Q51'], operator: 'lessThanOrEqual', formula1: 'Q50' })] },
        { sheetKey: 'S2', validations: [dv({ ranges: ['Q51'], operator: 'lessThanOrEqual', formula1: 'Q50' })] },
      ],
      [field('Q51', 'NUM', 'S1'), field('Q51', 'NUM', 'S2')],
    );
    expect(new Set(r.ruleSuggestions.map((x) => x.name)).size).toBe(2);
  });

  describe('a workbook cannot make it do unbounded work', () => {
    it('many overlapping validations over many fields stop at the cap and say so', () => {
      const fields = Array.from({ length: 1000 }, (_, i) => field(`D${i + 1}`));
      const validations = Array.from({ length: 100 }, () =>
        dv({ ranges: ['D1:D1000'], operator: 'lessThanOrEqual', formula1: 'E1' }),
      );
      const r = deriveFromValidations([{ sheetKey: 'A10', validations }], fields);
      expect(r.ruleSuggestions.length).toBe(MAX_RULE_SUGGESTIONS);
      expect(r.unsupported.some((u) => /quá/.test(u.message))).toBe(true);
    });

    it('only the first validations of a sheet are looked at, and the rest is reported', () => {
      const validations = Array.from({ length: MAX_VALIDATIONS_PER_SHEET + 5 }, (_, i) =>
        dv({ ranges: [`Z${i + 1}`], type: 'list', operator: undefined, formula1: '"a"' }),
      );
      const fields = Array.from({ length: 10 }, (_, i) => field(`Z${i + 1}`));
      const r = deriveFromValidations([{ sheetKey: 'A10', validations }], fields);
      expect(r.unsupported.some((u) => /chỉ 2000 quy tắc đầu/.test(u.message))).toBe(true);
    });

    it('a flood of unsupported validations is cut off with one closing note', () => {
      const fields = Array.from({ length: 500 }, (_, i) => field(`D${i + 1}`));
      const validations = fields.map((f) => dv({ ranges: [f.address], type: 'list', operator: undefined, formula1: '"a"' }));
      const r = deriveFromValidations([{ sheetKey: 'A10', validations }], fields);
      expect(r.unsupported.length).toBeLessThanOrEqual(MAX_UNSUPPORTED_REPORTED + 1);
      expect(r.unsupported[r.unsupported.length - 1].message).toMatch(/không liệt kê hết/);
    });

    it('a validation over a huge block touches only the fields, not every cell of the block', () => {
      const started = Date.now();
      const r = deriveFromValidations(
        [{ sheetKey: 'A10', validations: [dv({ ranges: ['A1:XFD1048576'] })] }],
        [field('D10'), field('E11')],
      );
      expect(r.constraints.size).toBe(2);
      expect(Date.now() - started).toBeLessThan(1000);
    });
  });
});
