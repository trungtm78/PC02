/**
 * Row windowing for a sheet too large to draw whole (plan R19): only the rows around the viewport are drawn, a
 * single spacer row stands in for every stretch that is skipped, so the scroll bar and every frozen offset stay
 * exactly what the full table would give.
 *
 * Pure: heights in, segments out. The table decides what to measure and renders the segments.
 */

/** A sheet with more cells than this (drawn rows × visible columns) is windowed; a normal template never is. */
export const VIRTUALIZE_ABOVE_CELLS = 2_000;

export function shouldVirtualize(drawnRows: number, visibleCols: number): boolean {
  return drawnRows * visibleCols > VIRTUALIZE_ABOVE_CELLS;
}

/** Rows of the drawn list (indexes into `heights`) that must be drawn together: a merged block spans them. */
export interface RowBlock {
  top: number;
  bottom: number;
}

export type RowSegment =
  | { kind: 'rows'; from: number; to: number }
  | { kind: 'gap'; height: number };

export interface PlanRowsInput {
  /** Pixel height of every drawn row, in order. */
  heights: readonly number[];
  /** The first this-many rows are frozen and always drawn. */
  frozen: number;
  scrollTop: number;
  viewport: number;
  /** Extra pixels drawn above and below the viewport, so a fast scroll does not show blank rows. */
  overscan: number;
  /** Merged blocks as drawn-row ranges: a block touching the window is drawn whole, never cut in two. */
  blocks: readonly RowBlock[];
  /** Rows that must be drawn wherever the window is (the one holding the cursor or the editor). */
  keep: readonly number[];
}

export function planRows(input: PlanRowsInput): RowSegment[] {
  const { heights, frozen, viewport, overscan, blocks, keep } = input;
  const n = heights.length;
  if (n === 0) return [];

  const tops = new Array<number>(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    tops[i] = total;
    total += heights[i];
  }

  const scrollTop = Math.min(Math.max(0, input.scrollTop), total);
  const windowTop = Math.max(0, scrollTop - overscan);
  const windowBottom = Math.min(total, scrollTop + viewport + overscan);

  let start = 0;
  while (start < n - 1 && tops[start] + heights[start] <= windowTop) start++;
  let end = start;
  while (end < n - 1 && tops[end + 1] < windowBottom) end++;

  const selected = new Array<boolean>(n).fill(false);
  const select = (from: number, to: number): void => {
    for (let i = Math.max(0, from); i <= Math.min(n - 1, to); i++) selected[i] = true;
  };
  select(0, frozen - 1);
  select(start, end);
  for (const row of keep) if (row >= 0 && row < n) selected[row] = true;

  // A block that touches anything drawn is drawn whole, and that can pull in the next block: repeat until stable.
  let changed = true;
  while (changed) {
    changed = false;
    for (const b of blocks) {
      const top = Math.max(0, b.top);
      const bottom = Math.min(n - 1, b.bottom);
      let touches = false;
      let whole = true;
      for (let i = top; i <= bottom; i++) {
        if (selected[i]) touches = true;
        else whole = false;
      }
      if (touches && !whole) {
        select(top, bottom);
        changed = true;
      }
    }
  }

  const segments: RowSegment[] = [];
  let i = 0;
  while (i < n) {
    if (selected[i]) {
      const from = i;
      while (i + 1 < n && selected[i + 1]) i++;
      segments.push({ kind: 'rows', from, to: i });
      i++;
    } else {
      let height = 0;
      while (i < n && !selected[i]) {
        height += heights[i];
        i++;
      }
      segments.push({ kind: 'gap', height });
    }
  }
  return segments;
}
