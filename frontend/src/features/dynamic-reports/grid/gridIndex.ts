import type { GridMerge, GridSheet } from '../engine/generated/grid-types';
import { formatAddress } from '../engine/generated/paste';

/**
 * Lookup structures over one sheet of a GridModel, built once per sheet and
 * shared by the renderer (and later by keyboard navigation): which cell owns
 * a merged block, which cells a block covers, which rows/columns are drawn,
 * and where each visible row/column starts.
 *
 * All indexes are 0-based and refer to the sheet's own rows/columns; hidden
 * ones simply do not appear in `visibleRows` / `visibleCols`.
 */
export interface SheetIndex {
  sheet: GridSheet;
  visibleRows: number[];
  visibleCols: number[];
  /** Merge by its top-left cell, key "row,col". */
  mergeByAnchor: Map<string, GridMerge>;
  /** Cells covered by some other cell's merge (never drawn), key "row,col". */
  covered: Set<string>;
  /** Left edge in pixels (zoom 100%) of every visible column, by sheet column index. */
  colLeft: Map<number, number>;
  /** Top edge in pixels (zoom 100%) of every visible row, by sheet row index. */
  rowTop: Map<number, number>;
  totalWidth: number;
  totalHeight: number;
}

export const key = (row: number, col: number): string => `${row},${col}`;

export function buildSheetIndex(sheet: GridSheet): SheetIndex {
  const hiddenRows = new Set(sheet.hiddenRows);
  const hiddenCols = new Set(sheet.hiddenCols);

  const visibleRows: number[] = [];
  const rowTop = new Map<number, number>();
  let top = 0;
  for (let r = 0; r < sheet.rows; r++) {
    if (hiddenRows.has(r)) continue;
    visibleRows.push(r);
    rowTop.set(r, top);
    top += sheet.rowHeightsPx[r] ?? 0;
  }

  const visibleCols: number[] = [];
  const colLeft = new Map<number, number>();
  let left = 0;
  for (let c = 0; c < sheet.cols; c++) {
    if (hiddenCols.has(c)) continue;
    visibleCols.push(c);
    colLeft.set(c, left);
    left += sheet.colWidthsPx[c] ?? 0;
  }

  const mergeByAnchor = new Map<string, GridMerge>();
  const covered = new Set<string>();
  for (const m of sheet.merges) {
    mergeByAnchor.set(key(m.top, m.left), m);
    for (let r = m.top; r <= m.bottom; r++) {
      for (let c = m.left; c <= m.right; c++) {
        if (r !== m.top || c !== m.left) covered.add(key(r, c));
      }
    }
  }

  return {
    sheet,
    visibleRows,
    visibleCols,
    mergeByAnchor,
    covered,
    colLeft,
    rowTop,
    totalWidth: left,
    totalHeight: top,
  };
}

/**
 * How many VISIBLE rows/columns a merged block spans. A block whose rows or
 * columns are partly hidden shrinks accordingly, like Excel; a block entirely
 * hidden has span 0 and the caller skips it.
 */
export function spanOf(index: SheetIndex, merge: GridMerge): { rowSpan: number; colSpan: number } {
  const hiddenRows = new Set(index.sheet.hiddenRows);
  const hiddenCols = new Set(index.sheet.hiddenCols);
  let rowSpan = 0;
  for (let r = merge.top; r <= merge.bottom; r++) if (!hiddenRows.has(r)) rowSpan++;
  let colSpan = 0;
  for (let c = merge.left; c <= merge.right; c++) if (!hiddenCols.has(c)) colSpan++;
  return { rowSpan, colSpan };
}

/** A1 address of a 0-based (row, col). */
export function addressOf(row: number, col: number): string {
  return formatAddress({ col, row: row + 1 });
}

/** Pixel width/height of a merged block (zoom 100%), counting only visible rows/columns. */
export function blockSize(index: SheetIndex, merge: GridMerge): { width: number; height: number } {
  const hiddenRows = new Set(index.sheet.hiddenRows);
  const hiddenCols = new Set(index.sheet.hiddenCols);
  let width = 0;
  for (let c = merge.left; c <= merge.right; c++) if (!hiddenCols.has(c)) width += index.sheet.colWidthsPx[c] ?? 0;
  let height = 0;
  for (let r = merge.top; r <= merge.bottom; r++) if (!hiddenRows.has(r)) height += index.sheet.rowHeightsPx[r] ?? 0;
  return { width, height };
}

/** A merged block as it is actually drawn: owned by its first drawn cell. */
export interface DrawnMerge {
  merge: GridMerge;
  rowSpan: number;
  colSpan: number;
}

export interface MergeLayout {
  /** Drawn blocks by the (row,col) of the cell that draws them. */
  owners: Map<string, DrawnMerge>;
  /** Cells that must not be emitted: the rest of every block. */
  covered: Set<string>;
  /** For a covered cell of a block that IS drawn: the key of the cell drawing it. */
  ownerKeyOf: Map<string, string>;
}

/**
 * Places every merged block on the rows/columns that are really drawn (hidden
 * ones, and rows removed by a filter, are not). The block is drawn by its first
 * drawn cell, which is NOT its anchor when the anchor's row or column is
 * hidden; spans count drawn lines only. A block with no drawn cell vanishes.
 * The anchor still holds the block's content and style.
 */
export function layoutMerges(
  sheet: GridSheet,
  drawnRows: readonly number[],
  drawnCols: readonly number[],
): MergeLayout {
  const owners = new Map<string, DrawnMerge>();
  const covered = new Set<string>();
  const ownerKeyOf = new Map<string, string>();
  const rows = [...drawnRows].sort((a, b) => a - b);
  const cols = [...drawnCols].sort((a, b) => a - b);
  for (const merge of sheet.merges) {
    const inRows = rows.filter((r) => r >= merge.top && r <= merge.bottom);
    const inCols = cols.filter((c) => c >= merge.left && c <= merge.right);
    if (inRows.length === 0 || inCols.length === 0) {
      for (let r = merge.top; r <= merge.bottom; r++)
        for (let c = merge.left; c <= merge.right; c++) covered.add(key(r, c));
      continue;
    }
    const ownerKey = key(inRows[0], inCols[0]);
    owners.set(ownerKey, { merge, rowSpan: inRows.length, colSpan: inCols.length });
    for (let r = merge.top; r <= merge.bottom; r++)
      for (let c = merge.left; c <= merge.right; c++) {
        const k = key(r, c);
        if (k === ownerKey) continue;
        covered.add(k);
        ownerKeyOf.set(k, ownerKey);
      }
  }
  return { owners, covered, ownerKeyOf };
}
