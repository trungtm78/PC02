import { describe, expect, it } from 'vitest';
import { addressOf, blockSize, buildSheetIndex, key, spanOf } from '../gridIndex';
import { borderCss, cssForDxf, cssForStyle, fontFamilyFor } from '../styleToCss';
import { evaluateGrid, toWorkbookModel, viewOf } from '../gridEvaluation';
import { FIELDS, makeGrid, makeSheet } from './fixtures';

describe('buildSheetIndex', () => {
  it('lists only visible rows and columns and measures their offsets', () => {
    const idx = buildSheetIndex(makeSheet({ hiddenCols: [1] }));
    expect(idx.visibleRows).toEqual([0, 1, 2, 3, 4, 6]); // row 5 (index) hidden
    expect(idx.visibleCols).toEqual([0, 2, 3, 4]);
    expect(idx.colLeft.get(2)).toBe(40); // A=40, B hidden
    expect(idx.colLeft.get(4)).toBe(40 + 80 + 80);
    expect(idx.rowTop.get(2)).toBe(30 + 20);
    expect(idx.rowTop.get(6)).toBe(30 + 20 * 4); // hidden row contributes nothing
    expect(idx.totalWidth).toBe(40 + 80 + 80 + 50);
  });

  it('finds the anchor of a merge and marks the other cells as covered', () => {
    const idx = buildSheetIndex(makeSheet());
    expect(idx.mergeByAnchor.get(key(0, 0))).toEqual({ top: 0, left: 0, bottom: 0, right: 4 });
    expect(idx.covered.has(key(0, 0))).toBe(false);
    expect(idx.covered.has(key(0, 3))).toBe(true);
    expect(idx.covered.has(key(1, 3))).toBe(false);
  });

  it('a merge shrinks by its hidden rows/columns, and vanishes if all are hidden', () => {
    const sheet = makeSheet({ merges: [{ top: 2, left: 0, bottom: 5, right: 1 }], hiddenRows: [5] });
    const idx = buildSheetIndex(sheet);
    expect(spanOf(idx, sheet.merges[0])).toEqual({ rowSpan: 3, colSpan: 2 });
    const gone = makeSheet({ merges: [{ top: 5, left: 0, bottom: 5, right: 1 }], hiddenRows: [5] });
    expect(spanOf(buildSheetIndex(gone), gone.merges[0]).rowSpan).toBe(0);
  });

  it('measures a merged block in pixels, skipping hidden lines', () => {
    const sheet = makeSheet({ merges: [{ top: 2, left: 0, bottom: 5, right: 1 }] });
    expect(blockSize(buildSheetIndex(sheet), sheet.merges[0])).toEqual({ width: 100, height: 60 });
  });

  it('addressOf converts 0-based indexes to A1', () => {
    expect(addressOf(0, 0)).toBe('A1');
    expect(addressOf(9, 27)).toBe('AB10');
  });
});

describe('cssForStyle', () => {
  const ctx = { defaultFont: { name: 'Times New Roman', sizePt: 11 }, z: 1 };

  it('uses the workbook default font when the cell states none, with a metric-compatible fallback', () => {
    const css = cssForStyle({}, ctx);
    expect(css.fontFamily).toContain('Times New Roman');
    expect(css.fontFamily).toContain('Liberation Serif');
    expect(css.fontSize).toBe(`${11 * (96 / 72)}px`);
    expect(css.verticalAlign).toBe('bottom'); // Excel's default
    expect(css.whiteSpace).toBe('pre');
  });

  it('maps weight, style, decoration, colours, alignment and wrapping', () => {
    const css = cssForStyle(
      { bold: true, italic: true, underline: true, strike: true, color: '#112233', fill: '#ffee00', hAlign: 'center', vAlign: 'middle', wrap: true },
      ctx,
    );
    expect(css).toMatchObject({
      fontWeight: 700, fontStyle: 'italic', textDecoration: 'underline line-through',
      color: '#112233', backgroundColor: '#ffee00', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'pre-wrap',
    });
  });

  it('scales text and indent with the zoom', () => {
    const css = cssForStyle({ fontSizePt: 12, indent: 2 }, { ...ctx, z: 1.25 });
    expect(css.fontSize).toBe(`${12 * (96 / 72) * 1.25}px`);
    expect(css.paddingLeft).toBe(`${2 * 9 * 1.25 + 2}px`);
  });

  it('general alignment sets nothing (the renderer chooses by value type)', () => {
    expect(cssForStyle({}, ctx).textAlign).toBeUndefined();
  });

  it('draws each border side with Excel weights', () => {
    expect(borderCss({ style: 'thin', color: '#000' })).toBe('1px solid #000');
    expect(borderCss({ style: 'medium', color: '#f00' })).toBe('2px solid #f00');
    expect(borderCss({ style: 'thick', color: '#000' })).toBe('3px solid #000');
    expect(borderCss({ style: 'dashed', color: '#000' })).toBe('1px dashed #000');
    expect(borderCss({ style: 'double', color: '#000' })).toBe('3px double #000');
    expect(borderCss(undefined)).toBeUndefined();
    const css = cssForStyle({ borderTop: { style: 'thin', color: '#000' }, borderLeft: { style: 'thick', color: '#00f' } }, ctx);
    expect(css.borderTop).toBe('1px solid #000');
    expect(css.borderLeft).toBe('3px solid #00f');
    expect(css.borderBottom).toBeUndefined();
  });

  it('vertical (stacked) and rotated text', () => {
    expect(cssForStyle({ rotation: 255 }, ctx)).toMatchObject({ writingMode: 'vertical-rl', textOrientation: 'upright' });
    expect(cssForStyle({ rotation: 90 }, ctx)).toMatchObject({ writingMode: 'vertical-rl', transform: 'rotate(180deg)' });
  });

  it('font fallbacks for the common families; unknown names are quoted safely', () => {
    expect(fontFamilyFor('Calibri')).toContain('Carlito');
    expect(fontFamilyFor('Arial')).toContain('Liberation Sans');
    expect(fontFamilyFor('My "Odd" Font')).toBe('"My Odd Font", "Segoe UI", sans-serif');
  });

  it('a conditional-format overlay only carries what the rule sets', () => {
    expect(cssForDxf({ fill: '#ff0000' })).toEqual({ backgroundColor: '#ff0000' });
    expect(cssForDxf({ color: '#fff', bold: true, strike: true })).toEqual({ color: '#fff', fontWeight: 700, textDecoration: 'line-through' });
  });
});

describe('evaluating a grid with a submission', () => {
  const grid = makeGrid();

  it('turns the grid and its fields into a workbook: inputs override the sample the file ships', () => {
    const wb = toWorkbookModel(grid, FIELDS);
    const cells = wb.sheets[0].cells;
    expect(cells['C4']).toEqual({ kind: 'input', type: 'NUM' }); // the file held 99
    expect(cells['C5']).toEqual({ kind: 'formula', source: 'SUM(C3:C4)' });
    expect(cells['B3']).toEqual({ kind: 'text', value: 'Vụ mới' });
    expect(cells['A3']).toEqual({ kind: 'number', value: '1' });
    expect(cells['C7']).toEqual({ kind: 'input', type: 'TEXT' });
  });

  const values = {
    'Đội 3!C3': { v: '1234.5' },
    'Đội 3!C4': { v: '5' },
    'Đội 3!E3': { v: '2026-10-12' },
    'Đội 3!C7': { v: 'xong' },
  };
  const ev = evaluateGrid(grid, FIELDS, values);
  const sheet = grid.sheets[0];
  const at = (a: string) => viewOf(ev, sheet, a, sheet.cells[a], grid.styles[sheet.cells[a]?.s ?? 0] ?? {});

  it('an input shows the SUBMITTED value, never the sample number in the file', () => {
    expect(at('C4').text).toBe('5');
    expect(at('C4').kind).toBe('input');
  });

  it('numbers use the cell number format in vi-VN', () => {
    expect(at('C3').text).toBe('1.235'); // #,##0 rounds 1234.5 half away from zero
    expect(at('C3').align).toBe('right');
  });

  it('formulas are computed from the submitted values and formatted', () => {
    expect(at('C5').text).toBe('1.240'); // 1234.5 + 5 = 1239.5 → #,##0 → 1.240
    expect(at('C5').kind).toBe('formula');
    expect(at('C5').formula).toBe('SUM(C3:C4)');
    expect(at('D3').text).toBe('99,6%'); // 1234.5 / 1239.5 = 0.99597 → 0.0% in vi-VN
  });

  it('dates and text inputs', () => {
    expect(at('E3').text).toBe('12/10/2026');
    expect(at('C7').text).toBe('xong');
    expect(at('C7').align).toBe('left');
  });

  it('an unfilled input is blank, not zero and not the sample', () => {
    const empty = evaluateGrid(grid, FIELDS, {});
    const v = viewOf(empty, sheet, 'C4', sheet.cells['C4'], grid.styles[3]);
    expect(v.text).toBe('');
  });

  it('static cells keep their text and numbers; a missing cell is empty', () => {
    expect(at('B3').text).toBe('Vụ mới');
    expect(at('A3').text).toBe('1');
    expect(viewOf(ev, sheet, 'Z9', undefined, {}).kind).toBe('empty');
  });

  it('a formula error shows Excel\'s literal and a Vietnamese hint', () => {
    const g = makeGrid({}, { cells: { ...makeSheet().cells, D3: { k: 'formula', f: '1/0', s: 0 } } });
    const e = evaluateGrid(g, FIELDS, {});
    const v = viewOf(e, g.sheets[0], 'D3', g.sheets[0].cells['D3'], {});
    expect(v).toMatchObject({ text: '#DIV/0!', isError: true });
    expect(v.hint).toContain('chia cho 0');
  });

  it('"show zeros" off hides numeric zeros, on shows them', () => {
    const cells = { ...makeSheet().cells, C5: { k: 'formula' as const, f: 'SUM(C3:C4)', s: 0 } };
    const off = makeGrid({}, { showZeros: false, cells });
    const evOff = evaluateGrid(off, FIELDS, {});
    expect(viewOf(evOff, off.sheets[0], 'C5', cells['C5'], {}).text).toBe('');
    const on = makeGrid({}, { showZeros: true, cells });
    const evOn = evaluateGrid(on, FIELDS, {});
    expect(viewOf(evOn, on.sheets[0], 'C5', cells['C5'], {}).text).toBe('0');
  });

  it('formulas that reference another sheet use the submitted values of that sheet', () => {
    const two = makeGrid({
      sheetOrder: ['Đội 3', 'TỔNG'],
      sheets: [
        makeSheet(),
        makeSheet({ name: 'TỔNG', cells: { A1: { k: 'formula', f: "'Đội 3'!C3*2", s: 0 } }, hiddenRows: [], merges: [], rows: 1, cols: 1, colWidthsPx: [60], rowHeightsPx: [20] }),
      ],
    });
    const e = evaluateGrid(two, FIELDS, { 'Đội 3!C3': { v: '21' } });
    expect(viewOf(e, two.sheets[1], 'A1', two.sheets[1].cells['A1'], {}).text).toBe('42');
  });
});
