import type { GridModel } from '../engine/grid-types';
import { redactGrid, scopeTag } from './redact-grid';

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

describe('scopeTag: two different scopes never share a cached answer', () => {
  it('is the same for the same set in any order, and different for a different set', () => {
    expect(scopeTag(['b', 'a'])).toBe(scopeTag(['a', 'b']));
    expect(scopeTag(['a'])).not.toBe(scopeTag(['a', 'b']));
    expect(scopeTag(['a,b'])).not.toBe(scopeTag(['a', 'b']));
  });
});
