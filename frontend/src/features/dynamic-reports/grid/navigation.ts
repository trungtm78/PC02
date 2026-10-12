import type { GridSheet } from '../engine/generated/grid-types';
import { key, layoutMerges } from './gridIndex';
import type { MergeLayout } from './gridIndex';
import type { Direction } from './keymap';

/**
 * Where the cursor goes, as pure functions over a sheet's drawn lines.
 *
 * A position is always the cell that DRAWS a merged block (its first drawn
 * cell), never one of the cells it covers, so the cursor can never sit on
 * something that is not on screen. Hidden rows/columns, and rows removed by
 * the "only rows with inputs" filter, are simply absent from `rows`/`cols`.
 *
 *   arrows      one drawn line at a time; leaving a merged block skips all of it
 *   Ctrl+arrow  Excel's rule: to the edge of a filled run, else to the next filled cell
 *   Tab         next input cell, row by row
 *   Enter       next input cell, column by column (down, then the next column)
 *
 * Tab and Enter visit input cells only, like Excel on a protected sheet, so an
 * officer filling a 258-row template never lands on a label.
 */

export interface Pos {
  row: number;
  col: number;
}

export interface Rect {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface NavModel {
  /** Drawn rows / columns, ascending (sheet coordinates, 0-based). */
  rows: number[];
  cols: number[];
  rowIdx: Map<number, number>;
  colIdx: Map<number, number>;
  layout: MergeLayout;
  /** Input cells in reading order (row, then column). */
  inputsByRow: Pos[];
  /** Input cells down the columns (column, then row). */
  inputsByCol: Pos[];
  isFilled: (row: number, col: number) => boolean;
  freeze: { rows: number; cols: number };
  /** Last row / column holding anything (sheet coordinates), or -1 for an empty sheet. */
  lastUsed: Pos;
}

export const samePos = (a: Pos, b: Pos): boolean => a.row === b.row && a.col === b.col;

export function buildNavModel(args: {
  sheet: GridSheet;
  rows: readonly number[];
  cols: readonly number[];
  /** Input cells as the report defines them (any cell of a merged block). */
  inputs: readonly Pos[];
  /** True when the cell shows something (used by Ctrl+arrow and Ctrl+End). */
  isFilled: (row: number, col: number) => boolean;
}): NavModel {
  const rows = [...args.rows].sort((a, b) => a - b);
  const cols = [...args.cols].sort((a, b) => a - b);
  const layout = layoutMerges(args.sheet, rows, cols);
  const rowIdx = new Map(rows.map((r, i) => [r, i]));
  const colIdx = new Map(cols.map((c, i) => [c, i]));

  const model: NavModel = {
    rows,
    cols,
    rowIdx,
    colIdx,
    layout,
    inputsByRow: [],
    inputsByCol: [],
    isFilled: args.isFilled,
    freeze: args.sheet.freeze,
    lastUsed: { row: -1, col: -1 },
  };

  const seen = new Set<string>();
  const inputs: Pos[] = [];
  for (const p of args.inputs) {
    const owner = resolve(model, p);
    if (!owner) continue;
    const k = key(owner.row, owner.col);
    if (seen.has(k)) continue;
    seen.add(k);
    inputs.push(owner);
  }
  model.inputsByRow = [...inputs].sort((a, b) => a.row - b.row || a.col - b.col);
  model.inputsByCol = [...inputs].sort((a, b) => a.col - b.col || a.row - b.row);

  let lastRow = -1;
  let lastCol = -1;
  for (const [address, cell] of Object.entries(args.sheet.cells)) {
    if (cell.k === 'empty') continue;
    const m = /^([A-Z]+)(\d+)$/.exec(address);
    if (!m) continue;
    let col = 0;
    for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
    lastCol = Math.max(lastCol, col - 1);
    lastRow = Math.max(lastRow, Number(m[2]) - 1);
  }
  for (const p of inputs) {
    lastRow = Math.max(lastRow, p.row);
    lastCol = Math.max(lastCol, p.col);
  }
  model.lastUsed = { row: lastRow, col: lastCol };
  return model;
}

/** The cell that draws whatever occupies (row, col), or null if nothing there is drawn. */
export function resolve(model: NavModel, p: Pos): Pos | null {
  const owner = model.layout.ownerKeyOf.get(key(p.row, p.col));
  if (owner) {
    const [r, c] = owner.split(',').map(Number);
    return { row: r, col: c };
  }
  if (model.layout.covered.has(key(p.row, p.col))) return null; // inside a block that has no drawn cell
  return model.rowIdx.has(p.row) && model.colIdx.has(p.col) ? { row: p.row, col: p.col } : null;
}

/** Drawn-line extent of the block at `p` as inclusive indexes into rows / cols. */
function extent(model: NavModel, p: Pos): { r0: number; r1: number; c0: number; c1: number } {
  const r0 = model.rowIdx.get(p.row) ?? 0;
  const c0 = model.colIdx.get(p.col) ?? 0;
  const drawn = model.layout.owners.get(key(p.row, p.col));
  return {
    r0,
    c0,
    r1: r0 + (drawn ? drawn.rowSpan : 1) - 1,
    c1: c0 + (drawn ? drawn.colSpan : 1) - 1,
  };
}

/** The sheet rectangle (inclusive) that the block at `p` covers on screen. */
export function blockRect(model: NavModel, p: Pos): Rect {
  const e = extent(model, p);
  return { top: model.rows[e.r0], bottom: model.rows[e.r1], left: model.cols[e.c0], right: model.cols[e.c1] };
}

/**
 * One step. `lane` is the column (moving up/down) or row (moving left/right) the
 * cursor is travelling along; it defaults to the cell's own, but a long move
 * that passes through a merged block must keep its original lane or it would
 * come out the other side in the block's own column.
 */
export function moveArrow(model: NavModel, p: Pos, dir: Direction, lane?: number): Pos {
  const e = extent(model, p);
  let row = dir === 'left' || dir === 'right' ? (lane ?? p.row) : p.row;
  let col = dir === 'up' || dir === 'down' ? (lane ?? p.col) : p.col;
  switch (dir) {
    case 'down': {
      const i = e.r1 + 1;
      if (i >= model.rows.length) return p;
      row = model.rows[i];
      break;
    }
    case 'up': {
      const i = e.r0 - 1;
      if (i < 0) return p;
      row = model.rows[i];
      break;
    }
    case 'right': {
      const i = e.c1 + 1;
      if (i >= model.cols.length) return p;
      col = model.cols[i];
      break;
    }
    case 'left': {
      const i = e.c0 - 1;
      if (i < 0) return p;
      col = model.cols[i];
      break;
    }
  }
  return resolve(model, { row, col }) ?? p;
}

/** Ctrl+arrow, Excel's rule. */
export function moveJump(model: NavModel, p: Pos, dir: Direction): Pos {
  const filled = (q: Pos) => model.isFilled(q.row, q.col);
  const lane = dir === 'up' || dir === 'down' ? p.col : p.row;
  const first = moveArrow(model, p, dir, lane);
  if (samePos(first, p)) return p;

  let at = first;
  if (filled(p) && filled(first)) {
    // Inside a filled run: go to its last cell.
    for (;;) {
      const next = moveArrow(model, at, dir, lane);
      if (samePos(next, at) || !filled(next)) return at;
      at = next;
    }
  }
  // Otherwise: the next filled cell, or the edge of the sheet.
  for (;;) {
    if (filled(at)) return at;
    const next = moveArrow(model, at, dir, lane);
    if (samePos(next, at)) return at;
    at = next;
  }
}

export function move(model: NavModel, p: Pos, dir: Direction, jump: boolean): Pos {
  return jump ? moveJump(model, p, dir) : moveArrow(model, p, dir);
}

/** Home: first drawn column of this row. */
export function moveHome(model: NavModel, p: Pos): Pos {
  return resolve(model, { row: p.row, col: model.cols[0] }) ?? p;
}

/** End: the last filled cell of this row (or stay put). */
export function moveEnd(model: NavModel, p: Pos): Pos {
  for (let i = model.cols.length - 1; i >= 0; i--) {
    const c = model.cols[i];
    const q = resolve(model, { row: p.row, col: c });
    if (q && model.isFilled(q.row, q.col)) return q;
  }
  return p;
}

/** Ctrl+Home: the first cell of the scrollable area (below and right of the frozen panes). */
export function moveGridStart(model: NavModel): Pos | null {
  const ri = model.rows.findIndex((r) => r >= model.freeze.rows);
  const ci = model.cols.findIndex((c) => c >= model.freeze.cols);
  const row = model.rows[ri >= 0 ? ri : 0];
  const col = model.cols[ci >= 0 ? ci : 0];
  if (row === undefined || col === undefined) return null;
  return resolve(model, { row, col });
}

/** Ctrl+End: the cell at the last used row and column. */
export function moveGridEnd(model: NavModel): Pos | null {
  if (model.lastUsed.row < 0) return moveGridStart(model);
  const lastRow = [...model.rows].reverse().find((r) => r <= model.lastUsed.row);
  const lastCol = [...model.cols].reverse().find((c) => c <= model.lastUsed.col);
  if (lastRow === undefined || lastCol === undefined) return moveGridStart(model);
  return resolve(model, { row: lastRow, col: lastCol });
}

/** PageUp / PageDown: `pageRows` drawn rows, same column. */
export function movePage(model: NavModel, p: Pos, dir: 'up' | 'down', pageRows: number): Pos {
  const e = extent(model, p);
  const from = dir === 'down' ? e.r1 : e.r0;
  const target = Math.max(0, Math.min(model.rows.length - 1, from + (dir === 'down' ? pageRows : -pageRows)));
  return resolve(model, { row: model.rows[target], col: p.col }) ?? p;
}

function nextIn(list: Pos[], p: Pos, back: boolean, cmp: (a: Pos, b: Pos) => number): Pos | null {
  if (list.length === 0) return null;
  // Binary search for the boundary around p in the ordered list.
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cmp(list[mid], p) <= 0) lo = mid + 1;
    else hi = mid;
  }
  // lo = first element strictly after p.
  if (!back) return lo < list.length ? list[lo] : null;
  let before = lo - 1;
  while (before >= 0 && cmp(list[before], p) >= 0) before--; // skip p itself
  return before >= 0 ? list[before] : null;
}

const byRow = (a: Pos, b: Pos) => a.row - b.row || a.col - b.col;
const byCol = (a: Pos, b: Pos) => a.col - b.col || a.row - b.row;

/** Tab / Shift+Tab: the neighbouring input cell in reading order, or null at either end. */
export function nextInputByRow(model: NavModel, p: Pos, back: boolean): Pos | null {
  return nextIn(model.inputsByRow, p, back, byRow);
}

/** Enter / Shift+Enter: the neighbouring input cell down the columns, or null at either end. */
export function nextInputByCol(model: NavModel, p: Pos, back: boolean): Pos | null {
  return nextIn(model.inputsByCol, p, back, byCol);
}

/** The first input cell in reading order (where a fresh sheet puts the cursor). */
export function firstInput(model: NavModel): Pos | null {
  return model.inputsByRow[0] ?? null;
}
