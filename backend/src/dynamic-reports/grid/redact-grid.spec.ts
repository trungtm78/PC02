import type { GridModel } from '../engine/grid-types';
import { criteriaRowsOf, redactGrid, scopeTag } from './redact-grid';

const text = (v: string) => ({ k: 'text', v }) as never;

function model(): GridModel {
  return {
    engineVersion: 1,
    dateSystem: 1900,
    sheetOrder: ['S', 'Other'],
    excludedSheets: [],
    styles: [],
    defaultFont: { name: 'Arial', sizePt: 10 },
    warnings: [],
    sheets: [
      {
        name: 'S',
        rows: 4,
        cols: 4,
        colWidthsPx: [],
        rowHeightsPx: [],
        hiddenRows: [],
        hiddenCols: [],
        merges: [],
        freeze: { rows: 1, cols: 0 },
        showGridlines: true,
        showZeros: true,
        zoom: 100,
        cells: {
          A1: text('Mã'), B1: text('Tiêu chí'), C1: text('Giá trị'), D1: text('ĐVT'),
          A2: text('1'), B2: text('Của tổ'), C2: text('{NUM}'), D2: text('vụ'),
          A3: text('2'), B3: text('Của tổ khác'), C3: text('{NUM}'), D3: text('người'),
          A4: text('3'), B4: text('Cũng của tổ khác'), C4: text('{NUM}'), D4: text('tin'),
        },
        colStyles: [],
        rowStyles: {},
        conditionalFormats: [],
        validations: [],
      },
      {
        name: 'Other', rows: 1, cols: 1, colWidthsPx: [], rowHeightsPx: [], hiddenRows: [], hiddenCols: [], merges: [],
        freeze: { rows: 0, cols: 0 }, showGridlines: true, showZeros: true, zoom: 100,
        cells: { A1: text('untouched') }, colStyles: [], rowStyles: {}, conditionalFormats: [], validations: [],
      },
    ],
  };
}

const fields = [
  { sheetKey: 'S', address: 'C2', fieldKey: 'S!C2' },
  { sheetKey: 'S', address: 'C3', fieldKey: 'S!C3' },
  { sheetKey: 'S', address: 'C4', fieldKey: 'S!C4' },
];

describe('redactGrid: the grid an editor of one team may see', () => {
  it('a criteria workbook: the whole row of a criterion of another team is removed and hidden', () => {
    const out = redactGrid(model(), fields, ['S!C2'], true);
    const s = out.sheets[0];

    expect(Object.keys(s.cells).sort()).toEqual(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2']);
    expect(s.hiddenRows).toEqual([2, 3]);
    expect(JSON.stringify(out)).not.toContain('Của tổ khác');
  });

  it('an ordinary template: only the input cell of another team is removed (labels are the template\'s own layout)', () => {
    const out = redactGrid(model(), fields, ['S!C2'], false);
    const s = out.sheets[0];

    expect(s.cells.C3).toBeUndefined();
    expect(s.cells.C4).toBeUndefined();
    expect(s.cells.B3).toBeDefined();
    expect(s.hiddenRows).toEqual([]);
  });

  it('never changes the cached model it was given, nor a sheet it has nothing to remove from', () => {
    const original = model();
    const before = JSON.stringify(original);

    const out = redactGrid(original, fields, ['S!C2'], true);

    expect(JSON.stringify(original)).toBe(before);
    expect(out.sheets[1]).toBe(original.sheets[1]);
  });

  it('a team that owns every field gets the very same model back', () => {
    const original = model();
    expect(redactGrid(original, fields, ['S!C2', 'S!C3', 'S!C4'], true)).toBe(original);
  });

  it('keeps rows that were already hidden, without listing a row twice', () => {
    const original = model();
    original.sheets[0].hiddenRows = [3];
    expect(redactGrid(original, fields, ['S!C2'], true).sheets[0].hiddenRows).toEqual([2, 3]);
  });
});

describe('criteriaRowsOf: the rows a list of fields stands on (shared by the grid and the team\'s own file)', () => {
  it('names each row once, sheet by sheet, in row order', () => {
    expect(
      criteriaRowsOf([
        { sheetKey: 'S', address: 'C10' },
        { sheetKey: 'S', address: 'C3' },
        { sheetKey: 'S', address: 'D3' },
        { sheetKey: 'T', address: 'AB7' },
      ]),
    ).toEqual([
      { sheetKey: 'S', row: 3 },
      { sheetKey: 'S', row: 10 },
      { sheetKey: 'T', row: 7 },
    ]);
  });

  it('no field, no row', () => {
    expect(criteriaRowsOf([])).toEqual([]);
  });

  describe('a group heading (a row that adds its children up, with no field of its own)', () => {
    const formula = (f: string) => ({ k: 'formula', f, s: 0 }) as never;
    /**
     * 2  "1"      = C3 + C4          3 "1.1"   4 "1.2"
     * 5  "2"      = C6 + C7          6 "2.1"   7 "2.2" = C8 + C9     8 "2.2.1"   9 "2.2.2"
     * 10 "3" (a criterion with no group)
     */
    function grouped(): GridModel {
      const base = model();
      const cells: Record<string, never> = { A1: text('Mã'), B1: text('Tiêu chí'), C1: text('Giá trị') };
      const row = (r: number, code: string, value: never) => {
        cells[`A${r}`] = text(code);
        cells[`B${r}`] = text(`Tiêu chí ${code}`);
        cells[`C${r}`] = value;
      };
      row(2, '1', formula('SUM(C3,C4)'));
      row(3, '1.1', text('{NUM}'));
      row(4, '1.2', text('{NUM}'));
      row(5, '2', formula('SUM(C6,C7)'));
      row(6, '2.1', text('{NUM}'));
      row(7, '2.2', formula('SUM(C8,C9)'));
      row(8, '2.2.1', text('{NUM}'));
      row(9, '2.2.2', text('{NUM}'));
      row(10, '3', text('{NUM}'));
      return { ...base, sheets: [{ ...base.sheets[0], rows: 10, cells }, base.sheets[1]] };
    }
    const leaf = (row: number) => ({ sheetKey: 'S', address: `C${row}`, fieldKey: `S!C${row}` });
    const leaves = [3, 4, 6, 8, 9, 10].map(leaf);
    const rowsWithout = (ownedRows: number[]) =>
      criteriaRowsOf(leaves.filter((f) => !ownedRows.includes(Number(f.address.slice(1)))), grouped()).map((r) => r.row);

    it('goes with its children when the team was given none of them', () => {
      // Nothing of group "1": its heading (row 2) goes too.
      expect(rowsWithout([6, 8, 9, 10])).toEqual([2, 3, 4]);
    });

    it('stays when the team was given at least one of its children', () => {
      expect(rowsWithout([3, 6, 8, 9, 10])).toEqual([4]);
    });

    it('a heading of headings follows the same rule: gone only when everything under it is gone', () => {
      // Nothing under "2.2" (rows 8, 9): "2.2" goes; "2" still has "2.1".
      expect(rowsWithout([3, 4, 6, 10])).toEqual([7, 8, 9]);
      // Nothing under "2" at all: "2", "2.1", "2.2" and its children go.
      expect(rowsWithout([3, 4, 10])).toEqual([5, 6, 7, 8, 9]);
    });

    it('without the model only the rows of the fields are known (an authored template has no such headings)', () => {
      expect(criteriaRowsOf([leaf(3), leaf(4)]).map((r) => r.row)).toEqual([3, 4]);
    });

    it('the grid sent to the team has neither the children nor the heading, and keeps a heading it still has a child of', () => {
      const out = redactGrid(grouped(), leaves, ['S!C6', 'S!C10'], true);
      const texts = JSON.stringify(out.sheets[0].cells);

      for (const gone of ['Tiêu chí 1"', 'Tiêu chí 1.1', 'Tiêu chí 1.2', 'Tiêu chí 2.2"', 'Tiêu chí 2.2.1', 'Tiêu chí 2.2.2']) {
        expect(texts).not.toContain(gone);
      }
      expect(texts).toContain('Tiêu chí 2"');
      expect(texts).toContain('Tiêu chí 2.1');
      expect(texts).toContain('Tiêu chí 3');
      // 0-based: rows 2, 3, 4 and 7, 8, 9.
      expect(out.sheets[0].hiddenRows).toEqual([1, 2, 3, 6, 7, 8]);
    });
  });
});

describe('scopeTag: two different scopes never share a cached answer', () => {
  it('is the same for the same set in any order, and different for a different set', () => {
    expect(scopeTag(['b', 'a'])).toBe(scopeTag(['a', 'b']));
    expect(scopeTag(['a'])).not.toBe(scopeTag(['a', 'b']));
    expect(scopeTag(['a,b'])).not.toBe(scopeTag(['a', 'b']));
  });
});
