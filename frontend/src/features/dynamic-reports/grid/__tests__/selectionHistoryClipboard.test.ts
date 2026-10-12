import { describe, expect, it } from 'vitest';
import { EditHistory } from '../history';
import { MAX_PASTE_CELLS, parseClipboardText, planGridPaste, toClipboardText } from '../clipboard';
import type { PasteTarget } from '../clipboard';
import { buildNavModel } from '../navigation';
import type { Pos } from '../navigation';
import { cellsInRect, cellsInSelection, isSingleCell, moveSelection, selectAll, selectionRect, single } from '../selection';
import { makeSheet } from './fixtures';
import type { GridSheet } from '../../engine/generated/grid-types';

function model(over: Partial<GridSheet> = {}, hiddenRows: number[] = []) {
  const sheet = makeSheet({
    rows: 6,
    cols: 4,
    colWidthsPx: [40, 40, 40, 40],
    rowHeightsPx: [20, 20, 20, 20, 20, 20],
    cells: {},
    merges: [],
    hiddenRows,
    hiddenCols: [],
    freeze: { rows: 0, cols: 0 },
    ...over,
  });
  return buildNavModel({
    sheet,
    rows: [0, 1, 2, 3, 4, 5].filter((r) => !hiddenRows.includes(r)),
    cols: [0, 1, 2, 3],
    inputs: [],
    isFilled: () => false,
  });
}

const at = (row: number, col: number): Pos => ({ row, col });

describe('selection', () => {
  it('a single cell is its own rectangle', () => {
    const m = model();
    expect(selectionRect(m, single(at(2, 1)))).toEqual({ top: 2, left: 1, bottom: 2, right: 1 });
    expect(isSingleCell(m, single(at(2, 1)))).toBe(true);
  });

  it('is the rectangle between anchor and focus, whichever way it was dragged', () => {
    const m = model();
    const expected = { top: 1, left: 1, bottom: 3, right: 2 };
    expect(selectionRect(m, { anchor: at(1, 1), focus: at(3, 2) })).toEqual(expected);
    expect(selectionRect(m, { anchor: at(3, 2), focus: at(1, 1) })).toEqual(expected);
    expect(selectionRect(m, { anchor: at(3, 1), focus: at(1, 2) })).toEqual(expected);
  });

  it('grows to take in a merged block it touches, and keeps growing while blocks chain', () => {
    // A1:B2 and B2:C3 cannot both exist; use A1:B2 and C2:D3 touching a selection of B2..C2.
    const m = model({
      merges: [
        { top: 0, left: 0, bottom: 1, right: 1 },
        { top: 1, left: 2, bottom: 2, right: 3 },
      ],
    });
    // Selecting B2 to C2 touches both blocks → their union A1:D3.
    expect(selectionRect(m, { anchor: at(1, 1), focus: at(1, 2) })).toEqual({ top: 0, left: 0, bottom: 2, right: 3 });
  });

  it('keeps growing while blocks chain, however the merges are listed', () => {
    // The selection is row 1, A..D. Block C (B1:B3) overlaps it and makes it taller;
    // only then does block D (C3:D4) overlap it. D is listed first, so one pass is not enough.
    const m = model({
      merges: [
        { top: 2, left: 2, bottom: 3, right: 3 },
        { top: 0, left: 1, bottom: 2, right: 1 },
      ],
    });
    expect(selectionRect(m, { anchor: at(0, 0), focus: at(0, 3) })).toEqual({ top: 0, left: 0, bottom: 3, right: 3 });
  });

  it('lists each drawn cell once, in reading order, merged blocks as one cell', () => {
    const m = model({ merges: [{ top: 0, left: 0, bottom: 1, right: 1 }] });
    const cells = cellsInSelection(m, { anchor: at(0, 0), focus: at(1, 2) });
    expect(cells).toEqual([at(0, 0), at(0, 2), at(1, 2)]);
  });

  it('skips hidden rows', () => {
    const m = model({}, [1]);
    expect(cellsInRect(m, { top: 0, left: 0, bottom: 2, right: 0 })).toEqual([at(0, 0), at(2, 0)]);
  });

  it('respects the cell limit', () => {
    const m = model();
    expect(cellsInRect(m, { top: 0, left: 0, bottom: 5, right: 3 }, 5)).toHaveLength(5);
  });

  it('Shift+arrow keeps the anchor; a plain arrow collapses the selection', () => {
    const m = model();
    const grown = moveSelection(m, single(at(1, 1)), 'down', { extend: true, jump: false });
    expect(grown).toEqual({ anchor: at(1, 1), focus: at(2, 1) });
    const more = moveSelection(m, grown, 'right', { extend: true, jump: false });
    expect(more).toEqual({ anchor: at(1, 1), focus: at(2, 2) });
    expect(moveSelection(m, more, 'down', { extend: false, jump: false })).toEqual(single(at(3, 2)));
  });

  it('Ctrl+A selects every drawn cell', () => {
    const m = model();
    expect(selectionRect(m, selectAll(m)!)).toEqual({ top: 0, left: 0, bottom: 5, right: 3 });
  });
});

describe('EditHistory', () => {
  const change = (key: string, before: string | null, after: string | null) => ({ key, before, after });

  it('undo returns the values to restore; redo returns them to reapply', () => {
    const h = new EditHistory();
    h.push([change('A', null, '5')]);
    expect(h.undo()).toEqual([change('A', '5', null)]);
    expect(h.redo()).toEqual([change('A', null, '5')]);
  });

  it('one action is one step, however many cells it touched', () => {
    const h = new EditHistory();
    h.push([change('A', null, '1'), change('B', '2', '3'), change('C', '4', null)]);
    const undone = h.undo()!;
    expect(undone).toHaveLength(3);
    expect(undone.map((c) => c.key)).toEqual(['C', 'B', 'A']); // last change first
    expect(h.undo()).toBeNull();
  });

  it('steps back through several actions in reverse order', () => {
    const h = new EditHistory();
    h.push([change('A', null, '1')]);
    h.push([change('A', '1', '2')]);
    expect(h.undo()).toEqual([change('A', '2', '1')]);
    expect(h.undo()).toEqual([change('A', '1', null)]);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);
  });

  it('a new action discards the redo steps', () => {
    const h = new EditHistory();
    h.push([change('A', null, '1')]);
    h.undo();
    h.push([change('B', null, '9')]);
    expect(h.canRedo).toBe(false);
    expect(h.redo()).toBeNull();
  });

  it('an action that changed nothing is not recorded', () => {
    const h = new EditHistory();
    h.push([change('A', '5', '5')]);
    h.push([]);
    expect(h.canUndo).toBe(false);
  });

  it('no-op cells are left out of a mixed action', () => {
    const h = new EditHistory();
    h.push([change('A', '5', '5'), change('B', null, '1')]);
    expect(h.undo()).toEqual([change('B', '1', null)]);
  });

  it('overlapping targets in one action keep the first before and the last after', () => {
    const h = new EditHistory();
    h.push([change('A', 'x', 'y'), change('A', 'y', 'z')]);
    expect(h.undo()).toEqual([change('A', 'z', 'x')]);
  });

  it('keeps only the most recent steps up to its limit', () => {
    const h = new EditHistory(3);
    for (let i = 0; i < 5; i++) h.push([change('A', String(i), String(i + 1))]);
    let steps = 0;
    while (h.undo()) steps++;
    expect(steps).toBe(3);
  });

  it('clear forgets everything', () => {
    const h = new EditHistory();
    h.push([change('A', null, '1')]);
    h.undo();
    h.clear();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });
});

describe('clipboard text', () => {
  it('round-trips plain cells', () => {
    const m = [
      ['1', 'a'],
      ['2', ''],
    ];
    expect(toClipboardText(m)).toBe('1\ta\n2\t');
    expect(parseClipboardText(toClipboardText(m))).toEqual(m);
  });

  it('quotes a cell with a tab, newline or quote, and reads it back', () => {
    const m = [['a\tb', 'dòng 1\ndòng 2', 'nói "xin chào"']];
    const text = toClipboardText(m);
    expect(text).toBe('"a\tb"\t"dòng 1\ndòng 2"\t"nói ""xin chào"""');
    expect(parseClipboardText(text)).toEqual(m);
  });

  it('reads what Excel produces: \\r\\n line ends and a trailing newline', () => {
    expect(parseClipboardText('1\t2\r\n3\t4\r\n')).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('keeps an intentionally blank last cell', () => {
    expect(parseClipboardText('1\t')).toEqual([['1', '']]);
    expect(parseClipboardText('1\t\n2\t3')).toEqual([['1', ''], ['2', '3']]);
  });

  it('a quote in the middle of a cell is just a character', () => {
    expect(parseClipboardText('5" pipe\t2')).toEqual([['5" pipe', '2']]);
  });

  it('a lone value is one cell', () => {
    expect(parseClipboardText('42')).toEqual([['42']]);
    expect(parseClipboardText('')).toEqual([['']]);
  });

  it('an unterminated quote keeps what was read instead of losing it', () => {
    expect(parseClipboardText('"abc')).toEqual([['abc']]);
  });
});

describe('planGridPaste', () => {
  const NUM: PasteTarget['field'] = { type: 'NUM', min: '0' };
  /** Inputs: B2 (NUM), C2 (NUM), B3 (TEXT), C3 (DATE). Everything else is locked. */
  const targets = new Map<string, PasteTarget>([
    ['1,1', { fieldKey: 'S!B2', field: NUM }],
    ['1,2', { fieldKey: 'S!C2', field: NUM }],
    ['2,1', { fieldKey: 'S!B3', field: { type: 'TEXT' } }],
    ['2,2', { fieldKey: 'S!C3', field: { type: 'DATE' } }],
  ]);
  const targetAt = (p: Pos) => targets.get(`${p.row},${p.col}`);

  it('maps the block from the top-left, row by row, with each cell normalised', () => {
    const plan = planGridPaste({ text: '1.234,5\t7\nghi chú\t04/07/2026', topLeft: at(1, 1), targetAt });
    expect(plan).toEqual({
      ok: true,
      changes: [
        { fieldKey: 'S!B2', address: 'B2', value: '1234.5' },
        { fieldKey: 'S!C2', address: 'C2', value: '7' },
        { fieldKey: 'S!B3', address: 'B3', value: 'ghi chú' },
        { fieldKey: 'S!C3', address: 'C3', value: '2026-07-04' },
      ],
    });
  });

  it('an empty pasted cell clears the target', () => {
    const plan = planGridPaste({ text: '\t7', topLeft: at(1, 1), targetAt });
    expect(plan).toMatchObject({ ok: true });
    if (plan.ok) expect(plan.changes[0].value).toBeNull();
  });

  it('rejects the WHOLE block when any target is not an input, naming every one', () => {
    const plan = planGridPaste({ text: '1\t2\t3\n4\t5\t6', topLeft: at(1, 1), targetAt });
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.addresses).toEqual(['D2', 'D3']);
      expect(plan.message).toContain('D2');
      expect(plan.message).toContain('Không ô nào được dán');
    }
  });

  it('never shifts values past a locked cell: starting on a locked cell is refused', () => {
    const plan = planGridPaste({ text: '1\t2', topLeft: at(1, 0), targetAt });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.addresses).toEqual(['A2']);
  });

  it('rejects the whole block when one value is invalid, naming the cell and the reason', () => {
    const plan = planGridPaste({ text: '5\t-3', topLeft: at(1, 1), targetAt });
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.addresses).toEqual(['C2']);
      expect(plan.message).toContain('C2');
      expect(plan.message).toMatch(/tối thiểu/);
    }
  });

  it('one copied cell fills a larger selection', () => {
    const plan = planGridPaste({
      text: '9',
      topLeft: at(1, 1),
      selection: { top: 1, left: 1, bottom: 1, right: 2 },
      targetAt,
    });
    expect(plan).toMatchObject({ ok: true });
    if (plan.ok) expect(plan.changes.map((c) => [c.address, c.value])).toEqual([['B2', '9'], ['C2', '9']]);
  });

  it('one copied cell over a selection that includes a locked cell is refused', () => {
    const plan = planGridPaste({
      text: '9',
      topLeft: at(1, 0),
      selection: { top: 1, left: 0, bottom: 1, right: 1 },
      targetAt,
    });
    expect(plan.ok).toBe(false);
  });

  it('a multi-cell block ignores the selection size and lands from the top-left', () => {
    const plan = planGridPaste({
      text: '1\t2',
      topLeft: at(1, 1),
      selection: { top: 1, left: 1, bottom: 2, right: 2 },
      targetAt,
    });
    expect(plan).toMatchObject({ ok: true });
    if (plan.ok) expect(plan.changes).toHaveLength(2);
  });

  it('refuses nothing-to-paste and oversized blocks', () => {
    expect(planGridPaste({ text: '', topLeft: at(1, 1), targetAt }).ok).toBe(false);
    const big = Array.from({ length: MAX_PASTE_CELLS + 1 }, () => '1').join('\n');
    const plan = planGridPaste({ text: big, topLeft: at(1, 1), targetAt });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.message).toContain('quá lớn');
  });
});
