import type { GridModel, GridSheet } from '../../engine/generated/grid-types';

/**
 * A small template shaped like the real ones: a merged title, a header row
 * (frozen), a label column, three input cells (one with a stale sample number
 * the file ships), a SUM formula, a percentage and a date. 5 columns × 7 rows.
 *
 *        A(40)      B(60)        C(80)        D(80)     E(50)
 *  1   [ TITLE merged A1:E1 ]
 *  2   STT        Chỉ tiêu     Số vụ        Tỷ lệ     Ngày          <- frozen header
 *  3   1          Vụ mới       [input C3]   =C3/C5    [input E3 date]
 *  4   2          Đã giải quyết[input C4 *sample 99*]
 *  5   3          Tổng         =SUM(C3:C4)
 *  6   (hidden row)
 *  7   4          Ghi chú      [input C7 text]
 */
export function makeSheet(over: Partial<GridSheet> = {}): GridSheet {
  return {
    name: 'Đội 3',
    rows: 7,
    cols: 5,
    colWidthsPx: [40, 60, 80, 80, 50],
    rowHeightsPx: [30, 20, 20, 20, 20, 20, 20],
    hiddenRows: [5],
    hiddenCols: [],
    merges: [{ top: 0, left: 0, bottom: 0, right: 4 }],
    freeze: { rows: 2, cols: 0 },
    showGridlines: true,
    showZeros: true,
    zoom: 100,
    cells: {
      A1: { k: 'text', v: 'THỐNG KÊ', s: 1 },
      A2: { k: 'text', v: 'STT', s: 2 },
      B2: { k: 'text', v: 'Chỉ tiêu', s: 2 },
      C2: { k: 'text', v: 'Số vụ', s: 2 },
      D2: { k: 'text', v: 'Tỷ lệ', s: 2 },
      E2: { k: 'text', v: 'Ngày', s: 2 },
      A3: { k: 'num', v: '1', s: 0 },
      B3: { k: 'text', v: 'Vụ mới', s: 0 },
      C3: { k: 'empty', s: 3 },
      D3: { k: 'formula', f: 'IF(C5=0,0,C3/C5)', s: 4 },
      E3: { k: 'empty', s: 5 },
      A4: { k: 'num', v: '2', s: 0 },
      B4: { k: 'text', v: 'Đã giải quyết', s: 0 },
      C4: { k: 'num', v: '99', s: 3 },
      A5: { k: 'num', v: '3', s: 0 },
      B5: { k: 'text', v: 'Tổng', s: 0 },
      C5: { k: 'formula', f: 'SUM(C3:C4)', s: 3 },
      A7: { k: 'num', v: '4', s: 0 },
      B7: { k: 'text', v: 'Ghi chú', s: 0 },
      C7: { k: 'empty', s: 0 },
    },
    colStyles: [],
    rowStyles: {},
    conditionalFormats: [],
    validations: [],
    ...over,
  };
}

export function makeGrid(over: Partial<GridModel> = {}, sheet: Partial<GridSheet> = {}): GridModel {
  return {
    engineVersion: 1,
    dateSystem: 1900,
    sheetOrder: ['Đội 3'],
    excludedSheets: [],
    styles: [
      {},
      { bold: true, hAlign: 'center', fontSizePt: 14, fill: '#ffff00', borderBottom: { style: 'medium', color: '#ff0000' } },
      { bold: true, hAlign: 'center', fill: '#dddddd' },
      { numFmt: '#,##0' },
      { numFmt: '0.0%' },
      { numFmt: 'dd/mm/yyyy' },
    ],
    defaultFont: { name: 'Times New Roman', sizePt: 11 },
    sheets: [makeSheet(sheet)],
    warnings: [],
    ...over,
  };
}

export const FIELDS = [
  { sheetKey: 'Đội 3', address: 'C3', fieldKey: 'Đội 3!C3', type: 'NUM' as const, label: 'Số vụ mới' },
  { sheetKey: 'Đội 3', address: 'C4', fieldKey: 'Đội 3!C4', type: 'NUM' as const, label: 'Đã giải quyết' },
  { sheetKey: 'Đội 3', address: 'E3', fieldKey: 'Đội 3!E3', type: 'DATE' as const, label: 'Ngày' },
  { sheetKey: 'Đội 3', address: 'C7', fieldKey: 'Đội 3!C7', type: 'TEXT' as const, label: 'Ghi chú' },
];
