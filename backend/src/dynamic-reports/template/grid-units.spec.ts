import {
  columnWidthToPx,
  defaultColumnWidthPx,
  defaultRowHeightPt,
  maxDigitWidth,
  rowHeightToPx,
} from './grid-units';

describe('maxDigitWidth', () => {
  it.each([
    ['Calibri', 11, 7],
    ['Times New Roman', 11, 7],
    ['Arial', 10, 7],
    ['Arial', 11, 8],
    ['Tahoma', 11, 8],
  ])('%s %spt → %s px', (font, size, expected) => {
    expect(maxDigitWidth(font, size)).toBe(expected);
  });

  it('falls back to the Excel default font (11pt) when nothing is stated', () => {
    expect(maxDigitWidth(undefined, undefined)).toBe(8); // 11pt × 96/72 × 0.52
    expect(maxDigitWidth('Calibri', undefined)).toBe(7);
  });
});

describe('columnWidthToPx — worked from the ECMA-376 formula', () => {
  // px = trunc(((256·w + trunc(128/mdw)) / 256) · mdw)
  it.each([
    [9.140625, 7, 64], // Excel's default 8.43-character column
    [4.5703125, 7, 32],
    [27.0703125, 7, 189],
    [10, 7, 70], // (2560+18)/256·7 = 70.49
    [10, 8, 80], // (2560+16)/256·8 = 80.5
    [0, 7, 0],
    [-1, 7, 0],
  ])('width %s at mdw %s → %s px', (w, mdw, px) => {
    expect(columnWidthToPx(w, mdw)).toBe(px);
  });
});

describe('defaults', () => {
  it('a column no <col> mentions is 64 px at mdw 7', () => {
    expect(defaultColumnWidthPx(7)).toBe(64);
  });

  it("the sheet's own defaultColWidth wins", () => {
    expect(defaultColumnWidthPx(7, 9.140625)).toBe(64);
    expect(defaultColumnWidthPx(7, 12)).toBe(columnWidthToPx(12, 7));
  });

  it('points to pixels at 96 dpi', () => {
    expect(rowHeightToPx(15)).toBe(20);
    expect(rowHeightToPx(12.75)).toBe(17);
    expect(rowHeightToPx(0)).toBe(0);
  });

  it('default row height tracks the font size', () => {
    expect(defaultRowHeightPt(11)).toBe(15);
    expect(defaultRowHeightPt(10)).toBe(13.75);
    expect(defaultRowHeightPt(undefined)).toBe(15);
  });
});
