import { describe, expect, it } from 'vitest';
import { overlayFor, shiftExpr } from '../conditional';
import { evaluateGrid } from '../gridEvaluation';
import { parseFormula } from '../../engine/generated/expr';
import { formatFormula } from '../../engine/generated/expr';
import { makeGrid, makeSheet } from './fixtures';
import type { GridConditionalFormat } from '../../engine/generated/grid-types';

function overlay(cf: GridConditionalFormat[], values: Record<string, string>, address: [number, number]) {
  const grid = makeGrid({}, { conditionalFormats: cf });
  const sheet = grid.sheets[0];
  const fields = [
    { sheetKey: 'Đội 3', address: 'C3', fieldKey: 'Đội 3!C3', type: 'NUM' as const },
    { sheetKey: 'Đội 3', address: 'C4', fieldKey: 'Đội 3!C4', type: 'NUM' as const },
  ];
  const ev = evaluateGrid(grid, fields, Object.fromEntries(Object.entries(values).map(([k, v]) => [`Đội 3!${k}`, { v }])));
  return overlayFor(sheet, address[0], address[1], ev.evaluator.contextFor('Đội 3'));
}

describe('shiftExpr — Excel copies a relative reference, not an anchored one', () => {
  const shifted = (src: string, dr: number, dc: number) => {
    const p = parseFormula(src);
    if (!p.ok) throw new Error('parse');
    return formatFormula(shiftExpr(p.expr, dr, dc));
  };

  it('moves relative references', () => {
    expect(shifted('A1+B2', 2, 1)).toBe('B3+C4');
  });

  it('keeps anchored parts where they are', () => {
    expect(shifted('$A$1+A$1+$A1', 3, 2)).toBe('$A$1+C$1+$A4');
  });

  it('shifts both ends of a range independently', () => {
    expect(shifted('SUM($A1:B$4)', 1, 1)).toBe('SUM($A2:C$4)');
  });

  it('never shifts above row 1 or left of column A', () => {
    expect(shifted('A1', -5, -5)).toBe('A1');
  });
});

describe('cellIs rules', () => {
  const red = { fill: '#ff0000' };
  const rule = (operator: string, formulas: string[], over = {}) =>
    [
      {
        ranges: ['C3:C4'],
        rules: [{ type: 'cellIs' as const, operator: operator as never, formulas, style: red, priority: 1, stopIfTrue: false, ...over }],
      },
    ] as GridConditionalFormat[];

  it('equal FALSE — the PL7 check cell turning red', () => {
    // C5 holds a boolean formula in the real template; here compare a number with a number.
    expect(overlay(rule('equal', ['5']), { C3: '5' }, [2, 2])).toEqual(red);
    expect(overlay(rule('equal', ['5']), { C3: '6' }, [2, 2])).toBeNull();
  });

  it.each([
    ['notEqual', ['5'], '6', true],
    ['notEqual', ['5'], '5', false],
    ['greaterThan', ['5'], '6', true],
    ['greaterThan', ['5'], '5', false],
    ['greaterThanOrEqual', ['5'], '5', true],
    ['lessThan', ['5'], '4', true],
    ['lessThanOrEqual', ['5'], '6', false],
    ['between', ['1', '10'], '5', true],
    ['between', ['1', '10'], '11', false],
    ['notBetween', ['1', '10'], '11', true],
    ['notBetween', ['1', '10'], '5', false],
  ])('%s %j on %s → %s', (op, formulas, value, applies) => {
    expect(overlay(rule(op, formulas), { C3: value }, [2, 2])).toEqual(applies ? red : null);
  });

  it('compares against another cell', () => {
    expect(overlay(rule('greaterThan', ['C4']), { C3: '9', C4: '3' }, [2, 2])).toEqual(red);
    expect(overlay(rule('greaterThan', ['C4']), { C3: '1', C4: '3' }, [2, 2])).toBeNull();
  });

  it('applies only inside its range', () => {
    expect(overlay(rule('equal', ['5']), { C3: '5' }, [4, 2])).toBeNull(); // C5 is outside C3:C4
  });

  it('an unparseable bound never matches (and never throws)', () => {
    expect(overlay(rule('equal', ['SUM(']), { C3: '5' }, [2, 2])).toBeNull();
    expect(overlay(rule('between', ['1']), { C3: '5' }, [2, 2])).toBeNull();
  });
});

describe('expression rules', () => {
  it('is written for the first cell of the range and shifted for each cell below it', () => {
    const cf: GridConditionalFormat[] = [
      { ranges: ['C3:C4'], rules: [{ type: 'expression', formula: 'C3>10', style: { fill: '#00ff00' }, priority: 1, stopIfTrue: false }] },
    ];
    expect(overlay(cf, { C3: '11', C4: '2' }, [2, 2])).toEqual({ fill: '#00ff00' });
    expect(overlay(cf, { C3: '11', C4: '2' }, [3, 2])).toBeNull(); // C4 tested as C4>10
    expect(overlay(cf, { C3: '1', C4: '20' }, [3, 2])).toEqual({ fill: '#00ff00' });
  });

  it('an anchored reference stays on its cell for every row', () => {
    const cf: GridConditionalFormat[] = [
      { ranges: ['C3:C4'], rules: [{ type: 'expression', formula: 'C3>$C$4', style: { fill: '#00ff00' }, priority: 1, stopIfTrue: false }] },
    ];
    expect(overlay(cf, { C3: '9', C4: '5' }, [2, 2])).toEqual({ fill: '#00ff00' });
  });
});

describe('priority and stopIfTrue', () => {
  const base = (stop: boolean): GridConditionalFormat[] => [
    {
      ranges: ['C3:C3'],
      rules: [
        { type: 'cellIs', operator: 'greaterThan', formulas: ['0'], style: { fill: '#aaaaaa' }, priority: 2, stopIfTrue: false },
        { type: 'cellIs', operator: 'greaterThan', formulas: ['5'], style: { fill: '#bbbbbb', bold: true }, priority: 1, stopIfTrue: stop },
      ],
    },
  ];

  it('the lower priority number wins a conflict; both contribute otherwise', () => {
    expect(overlay(base(false), { C3: '9' }, [2, 2])).toEqual({ fill: '#bbbbbb', bold: true });
  });

  it('stopIfTrue ends the walk after a match', () => {
    const o = overlay(
      [
        {
          ranges: ['C3:C3'],
          rules: [
            { type: 'cellIs', operator: 'greaterThan', formulas: ['5'], style: { bold: true }, priority: 1, stopIfTrue: true },
            { type: 'cellIs', operator: 'greaterThan', formulas: ['0'], style: { italic: true }, priority: 2, stopIfTrue: false },
          ],
        },
      ],
      { C3: '9' },
      [2, 2],
    );
    expect(o).toEqual({ bold: true });
  });

  it('a sheet with no rules yields nothing', () => {
    expect(overlayFor(makeSheet(), 2, 2, evaluateGrid(makeGrid(), [], {}).evaluator.contextFor('Đội 3'))).toBeNull();
  });
});

describe('the real PL7 shape: a check formula that returns TRUE/FALSE turns red on FALSE', () => {
  it('equal FALSE matches a boolean formula result and not a TRUE one', () => {
    const cf: GridConditionalFormat[] = [
      { ranges: ['D3'], rules: [{ type: 'cellIs', operator: 'equal', formulas: ['FALSE'], style: { fill: '#ff0000' }, priority: 1, stopIfTrue: false }] },
    ];
    const cells = { ...makeSheet().cells, D3: { k: 'formula' as const, f: 'IF(C3=C4,TRUE,FALSE)', s: 0 } };
    const grid = makeGrid({}, { conditionalFormats: cf, cells });
    const fields = [
      { sheetKey: 'Đội 3', address: 'C3', fieldKey: 'Đội 3!C3', type: 'NUM' as const },
      { sheetKey: 'Đội 3', address: 'C4', fieldKey: 'Đội 3!C4', type: 'NUM' as const },
    ];
    const run = (c3: string, c4: string) => {
      const ev = evaluateGrid(grid, fields, { 'Đội 3!C3': { v: c3 }, 'Đội 3!C4': { v: c4 } });
      return overlayFor(grid.sheets[0], 2, 3, ev.evaluator.contextFor('Đội 3'));
    };
    expect(run('4', '5')).toEqual({ fill: '#ff0000' }); // 4 ≠ 5 → FALSE → red
    expect(run('5', '5')).toBeNull(); // TRUE → plain
  });
});
