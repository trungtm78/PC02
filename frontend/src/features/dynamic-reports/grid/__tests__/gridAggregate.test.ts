import { describe, expect, it } from 'vitest';
import { evaluateAggregate, viewOf } from '../gridEvaluation';
import type { FieldAggregateView, FormulaCellView } from '../../types';
import { makeGrid } from './fixtures';

/**
 * The aggregate (S15) view of the template: input cells hold the AGGREGATED
 * figure, formula cells hold what the SERVER worked out — the browser never
 * recalculates them, so the screen, the exported file and the closed snapshot
 * cannot disagree.
 */

const grid = makeGrid();
const sheet = grid.sheets[0];

function field(address: string, over: Partial<FieldAggregateView> = {}): FieldAggregateView {
  return {
    fieldKey: `Đội 3!${address}`,
    sheetKey: 'Đội 3',
    address,
    label: address,
    type: 'NUM',
    value: null,
    displayNotAggregated: false,
    countTotal: 0,
    countNonBlank: 0,
    contributors: [],
    ...over,
  };
}

function view(address: string, fields: FieldAggregateView[], cells: Record<string, FormulaCellView> | null) {
  const ev = evaluateAggregate(grid, fields, cells);
  const cell = sheet.cells[address];
  return viewOf(ev, sheet, address, cell, grid.styles[cell?.s ?? 0]);
}

describe('evaluateAggregate / viewOf (S15 grid)', () => {
  it('an input cell shows the aggregated figure in the number format of its cell', () => {
    const v = view('C3', [field('C3', { value: '1234.5' })], {});
    expect(v.kind).toBe('input');
    expect(v.text).toBe('1.235'); // '#,##0' in vi-VN
  });

  it('an aggregated date is shown as a date, not as the ISO text it is stored as', () => {
    const v = view('E3', [field('E3', { type: 'DATE', value: '2026-06-15' })], {});
    expect(v.text).toBe('15/06/2026');
  });

  it('an input with no figure is blank, and one that is not aggregated says so', () => {
    expect(view('C3', [field('C3')], {}).text).toBe('');
    const none = view('C3', [field('C3', { displayNotAggregated: true })], {});
    expect(none.text).toBe('—');
    expect(none.hint).toMatch(/không tổng hợp/i);
  });

  it('a formula cell shows the figure the server worked out, formatted by the cell', () => {
    const v = view('D3', [], { 'Đội 3!D3': { ok: true, type: 'number', value: '0.256' } });
    expect(v.kind).toBe('formula');
    expect(v.text).toBe('25,6%'); // '0.0%'
    expect(v.isError).toBe(false);
  });

  it('never recalculates in the browser: the server figure wins over what the inputs would give', () => {
    // C3 = 1000 and C4 = 99 would make C5 = SUM(C3:C4) = 1.099 here; the server says 5.
    const fields = [field('C3', { value: '1000' })];
    const v = view('C5', fields, { 'Đội 3!C5': { ok: true, type: 'number', value: '5' } });
    expect(v.text).toBe('5');
  });

  it('a failure of the server is shown in its words, as an error with its hint', () => {
    const v = view('D3', [], { 'Đội 3!D3': { ok: false, code: 'MISSING_DATA', text: 'Thiếu dữ liệu' } });
    expect(v.isError).toBe(true);
    expect(v.text).toBe('Thiếu dữ liệu');
    expect(v.hint).toBeTruthy();
  });

  it('a boolean result is shown as TRUE/FALSE text', () => {
    const v = view('D3', [], { 'Đội 3!D3': { ok: true, type: 'boolean', value: true } });
    expect(v.text).toMatch(/true|đúng/i);
  });

  it('no figures from the server at all: every formula cell shows a dash and says why, never an invented number', () => {
    const v = view('C5', [field('C3', { value: '1000' })], null);
    expect(v.text).toBe('—');
    expect(v.isError).toBe(false);
    expect(v.hint).toMatch(/công thức/i);
  });

  it('a formula the server did not report is a dash too, not a stale browser calculation', () => {
    const v = view('C5', [field('C3', { value: '1000' })], {});
    expect(v.text).toBe('—');
  });

  it('static cells are untouched', () => {
    const v = view('B3', [], {});
    expect(v.kind).toBe('static');
    expect(v.text).toBe('Vụ mới');
  });
});
