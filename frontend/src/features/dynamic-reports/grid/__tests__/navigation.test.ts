import { describe, expect, it } from 'vitest';
import {
  blockRect,
  buildNavModel,
  firstInput,
  move,
  moveArrow,
  moveEnd,
  moveGridEnd,
  moveGridStart,
  moveHome,
  movePage,
  nextInputByCol,
  nextInputByRow,
  resolve,
} from '../navigation';
import type { NavModel, Pos } from '../navigation';
import { makeSheet } from './fixtures';
import type { GridSheet } from '../../engine/generated/grid-types';

/**
 * A 6 × 4 sheet (rows 1-6, columns A-D). Unless a test says otherwise nothing
 * is hidden or merged, and the input cells are B2, C2, B4, C4.
 */
const INPUTS: Pos[] = [
  { row: 1, col: 1 },
  { row: 1, col: 2 },
  { row: 3, col: 1 },
  { row: 3, col: 2 },
];

interface Opts {
  merges?: GridSheet['merges'];
  hiddenRows?: number[];
  hiddenCols?: number[];
  freeze?: { rows: number; cols: number };
  inputs?: Pos[];
  filled?: string[]; // "row,col"
  rows?: number[];
}

function build(o: Opts = {}): NavModel {
  const sheet = makeSheet({
    rows: 6,
    cols: 4,
    colWidthsPx: [40, 40, 40, 40],
    rowHeightsPx: [20, 20, 20, 20, 20, 20],
    cells: { A1: { k: 'text', v: 'x', s: 0 } },
    merges: o.merges ?? [],
    hiddenRows: o.hiddenRows ?? [],
    hiddenCols: o.hiddenCols ?? [],
    freeze: o.freeze ?? { rows: 0, cols: 0 },
  });
  const filled = new Set(o.filled ?? []);
  const allRows = [0, 1, 2, 3, 4, 5].filter((r) => !(o.hiddenRows ?? []).includes(r));
  const allCols = [0, 1, 2, 3].filter((c) => !(o.hiddenCols ?? []).includes(c));
  return buildNavModel({
    sheet,
    rows: o.rows ?? allRows,
    cols: allCols,
    inputs: o.inputs ?? INPUTS,
    isFilled: (r, c) => filled.has(`${r},${c}`),
  });
}

const at = (row: number, col: number): Pos => ({ row, col });

describe('arrows', () => {
  const m = build();
  it('move one cell and stop at the edges', () => {
    expect(moveArrow(m, at(2, 2), 'down')).toEqual(at(3, 2));
    expect(moveArrow(m, at(2, 2), 'up')).toEqual(at(1, 2));
    expect(moveArrow(m, at(2, 2), 'left')).toEqual(at(2, 1));
    expect(moveArrow(m, at(2, 2), 'right')).toEqual(at(2, 3));
    expect(moveArrow(m, at(0, 0), 'up')).toEqual(at(0, 0));
    expect(moveArrow(m, at(0, 0), 'left')).toEqual(at(0, 0));
    expect(moveArrow(m, at(5, 3), 'down')).toEqual(at(5, 3));
    expect(moveArrow(m, at(5, 3), 'right')).toEqual(at(5, 3));
  });

  it('step over hidden rows and columns', () => {
    const h = build({ hiddenRows: [2], hiddenCols: [1] });
    expect(moveArrow(h, at(1, 2), 'down')).toEqual(at(3, 2));
    expect(moveArrow(h, at(3, 2), 'up')).toEqual(at(1, 2));
    expect(moveArrow(h, at(1, 2), 'left')).toEqual(at(1, 0));
    expect(moveArrow(h, at(1, 0), 'right')).toEqual(at(1, 2));
  });

  it('step over rows the filter removed', () => {
    const f = build({ rows: [0, 1, 3, 5] });
    expect(moveArrow(f, at(1, 1), 'down')).toEqual(at(3, 1));
    expect(moveArrow(f, at(3, 1), 'down')).toEqual(at(5, 1));
  });
});

describe('merged blocks', () => {
  const block = { top: 0, left: 0, bottom: 1, right: 1 }; // A1:B2
  const m = build({ merges: [block] });

  it('the cursor lives on the cell that draws the block', () => {
    expect(resolve(m, at(1, 1))).toEqual(at(0, 0));
    expect(resolve(m, at(0, 1))).toEqual(at(0, 0));
    expect(resolve(m, at(0, 0))).toEqual(at(0, 0));
    expect(resolve(m, at(2, 2))).toEqual(at(2, 2));
  });

  it('leaving a block skips every cell of it', () => {
    expect(moveArrow(m, at(0, 0), 'right')).toEqual(at(0, 2));
    expect(moveArrow(m, at(0, 0), 'down')).toEqual(at(2, 0));
  });

  it('arriving from outside lands on the block, whatever cell was crossed', () => {
    expect(moveArrow(m, at(0, 2), 'left')).toEqual(at(0, 0));
    expect(moveArrow(m, at(1, 2), 'left')).toEqual(at(0, 0));
    expect(moveArrow(m, at(2, 1), 'up')).toEqual(at(0, 0));
  });

  it('the block occupies its whole rectangle on screen', () => {
    expect(blockRect(m, at(0, 0))).toEqual({ top: 0, left: 0, bottom: 1, right: 1 });
    expect(blockRect(m, at(2, 2))).toEqual({ top: 2, left: 2, bottom: 2, right: 2 });
  });

  it('a block whose anchor column is hidden is owned by its first drawn cell', () => {
    const h = build({ merges: [{ top: 0, left: 0, bottom: 0, right: 1 }], hiddenCols: [0] });
    expect(resolve(h, at(0, 0))).toEqual(at(0, 1));
    expect(moveArrow(h, at(0, 2), 'left')).toEqual(at(0, 1));
    expect(moveHome(h, at(0, 3))).toEqual(at(0, 1));
  });

  it('a block with nothing drawn cannot be entered', () => {
    const h = build({ merges: [{ top: 2, left: 0, bottom: 2, right: 1 }], hiddenRows: [2] });
    expect(resolve(h, at(2, 0))).toBeNull();
  });
});

describe('Ctrl+arrow (Excel rule)', () => {
  // Column B: rows 0-2 filled, row 3 empty, row 4 filled, row 5 empty.
  const m = build({ filled: ['0,1', '1,1', '2,1', '4,1'] });
  it('inside a run: to its last cell', () => {
    expect(move(m, at(0, 1), 'down', true)).toEqual(at(2, 1));
  });
  it('at the end of a run: to the next filled cell', () => {
    expect(move(m, at(2, 1), 'down', true)).toEqual(at(4, 1));
  });
  it('nothing further: to the edge of the sheet', () => {
    expect(move(m, at(4, 1), 'down', true)).toEqual(at(5, 1));
  });
  it('from an empty cell beside a filled run: stops on the FIRST filled cell, not the end of the run', () => {
    // Column B: rows 2 and 3 filled; the cursor starts on empty row 0.
    const run = build({ filled: ['2,1', '3,1'] });
    expect(move(run, at(0, 1), 'down', true)).toEqual(at(2, 1));
    // From the cell just above the run (empty, next one filled) it also stops on the first filled cell.
    expect(move(run, at(1, 1), 'down', true)).toEqual(at(2, 1));
  });

  it('stays in its own column while crossing a merged block', () => {
    // B2:C3 is merged and empty; only C4 is filled. Ctrl+Down from C1 must find C4, not B-something.
    const m = build({ merges: [{ top: 1, left: 1, bottom: 2, right: 2 }], filled: ['3,2'] });
    expect(move(m, at(0, 2), 'down', true)).toEqual(at(3, 2));
    // And the same sideways: a block spanning rows 1-2 crossed along row 2 (index 2).
    const side = build({ merges: [{ top: 1, left: 1, bottom: 2, right: 2 }], filled: ['2,3'] });
    expect(move(side, at(2, 0), 'right', true)).toEqual(at(2, 3));
  });

  it('an empty cell: to the next filled one', () => {
    expect(move(m, at(3, 1), 'down', true)).toEqual(at(4, 1));
    expect(move(m, at(5, 1), 'up', true)).toEqual(at(4, 1));
  });
  it('at the edge: stays', () => {
    expect(move(m, at(5, 1), 'down', true)).toEqual(at(5, 1));
    expect(move(m, at(0, 1), 'up', true)).toEqual(at(0, 1));
  });
  it('sideways in an empty row: to the edge', () => {
    expect(move(m, at(5, 0), 'right', true)).toEqual(at(5, 3));
  });
});

describe('Home, End, Ctrl+Home, Ctrl+End, PageUp/PageDown', () => {
  it('Home: first drawn column; End: last filled cell of the row', () => {
    const m = build({ filled: ['2,0', '2,2'] });
    expect(moveHome(m, at(2, 3))).toEqual(at(2, 0));
    expect(moveEnd(m, at(2, 0))).toEqual(at(2, 2));
    expect(moveEnd(m, at(4, 1))).toEqual(at(4, 1)); // nothing in the row: stay
  });

  it('Ctrl+Home goes below and right of the frozen panes', () => {
    expect(moveGridStart(build())).toEqual(at(0, 0));
    expect(moveGridStart(build({ freeze: { rows: 2, cols: 1 } }))).toEqual(at(2, 1));
  });

  it('Ctrl+End goes to the last used row and column', () => {
    // A1 holds text; the farthest input is C4 (row 3, col 2).
    expect(moveGridEnd(build())).toEqual(at(3, 2));
  });

  it('Ctrl+End never lands on a hidden line', () => {
    const m = build({ hiddenRows: [3] });
    expect(moveGridEnd(m)).toEqual(at(1, 2)); // row 4 hidden → last drawn row with content is row 2
  });

  it('PageDown / PageUp move by drawn rows and clamp', () => {
    const m = build();
    expect(movePage(m, at(0, 1), 'down', 4)).toEqual(at(4, 1));
    expect(movePage(m, at(3, 1), 'down', 4)).toEqual(at(5, 1));
    expect(movePage(m, at(3, 1), 'up', 10)).toEqual(at(0, 1));
  });
});

describe('Tab and Enter visit input cells only', () => {
  const m = build();
  it('Tab: reading order, stops at the last', () => {
    expect(nextInputByRow(m, at(1, 1), false)).toEqual(at(1, 2));
    expect(nextInputByRow(m, at(1, 2), false)).toEqual(at(3, 1));
    expect(nextInputByRow(m, at(3, 1), false)).toEqual(at(3, 2));
    expect(nextInputByRow(m, at(3, 2), false)).toBeNull();
  });
  it('Shift+Tab: backwards, stops at the first', () => {
    expect(nextInputByRow(m, at(3, 2), true)).toEqual(at(3, 1));
    expect(nextInputByRow(m, at(3, 1), true)).toEqual(at(1, 2));
    expect(nextInputByRow(m, at(1, 1), true)).toBeNull();
  });
  it('from a label cell: the next / previous input in reading order', () => {
    expect(nextInputByRow(m, at(2, 0), false)).toEqual(at(3, 1));
    expect(nextInputByRow(m, at(2, 0), true)).toEqual(at(1, 2));
    expect(nextInputByRow(m, at(0, 0), false)).toEqual(at(1, 1));
    expect(nextInputByRow(m, at(5, 3), false)).toBeNull();
  });
  it('Enter: down the column, then the next column', () => {
    expect(nextInputByCol(m, at(1, 1), false)).toEqual(at(3, 1));
    expect(nextInputByCol(m, at(3, 1), false)).toEqual(at(1, 2));
    expect(nextInputByCol(m, at(1, 2), false)).toEqual(at(3, 2));
    expect(nextInputByCol(m, at(3, 2), false)).toBeNull();
  });
  it('Shift+Enter reverses it', () => {
    expect(nextInputByCol(m, at(1, 2), true)).toEqual(at(3, 1));
    expect(nextInputByCol(m, at(1, 1), true)).toBeNull();
  });
  it('a sheet without inputs has nowhere to go', () => {
    const empty = build({ inputs: [] });
    expect(nextInputByRow(empty, at(0, 0), false)).toBeNull();
    expect(firstInput(empty)).toBeNull();
  });
  it('firstInput is the first in reading order', () => {
    expect(firstInput(m)).toEqual(at(1, 1));
  });

  it('inputs hidden by a filter or a hidden line are skipped', () => {
    const f = build({ rows: [0, 1, 2, 4, 5] }); // row 4 (index 3) filtered out
    expect(nextInputByRow(f, at(1, 2), false)).toBeNull();
  });

  it('an input inside a merged block is visited once, at the block', () => {
    const merged = build({
      merges: [{ top: 3, left: 1, bottom: 3, right: 2 }], // B4:C4
      inputs: [at(3, 1), at(3, 2)],
    });
    expect(merged.inputsByRow).toEqual([at(3, 1)]);
    expect(nextInputByRow(merged, at(3, 1), false)).toBeNull();
  });
});
