import type { SheetIndex } from './gridIndex';
import type { Pos, Rect } from './navigation';

/**
 * Decisions both the drawing (GridTable) and the keyboard (GridEntry) must
 * agree on, kept in one place so the cursor can never walk onto a row that is
 * not on screen.
 */

/** 0-based sheet row of an A1 address ("C7" → 6), or null if it is not one. */
export function rowOfAddress(address: string): number | null {
  const m = /^[A-Z]+(\d+)$/.exec(address);
  return m ? Number(m[1]) - 1 : null;
}

/** 0-based sheet column of an A1 address ("C7" → 2), or null. */
export function colOfAddress(address: string): number | null {
  const m = /^([A-Z]+)\d+$/.exec(address);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return col - 1;
}

/** Rows (0-based) of this sheet that hold at least one input cell. */
export function inputRowSet(
  sheetName: string,
  fields: Iterable<{ sheetKey: string; address: string }>,
): Set<number> {
  const rows = new Set<number>();
  for (const f of fields) {
    if (f.sheetKey !== sheetName) continue;
    const r = rowOfAddress(f.address);
    if (r !== null) rows.add(r);
  }
  return rows;
}

/**
 * The rows that are drawn. With "only rows with inputs" the frozen heading
 * rows stay (they give the numbers their meaning) and every row without an
 * input cell goes.
 */
export function drawnRowsOf(
  index: SheetIndex,
  inputRows: ReadonlySet<number>,
  onlyInputRows: boolean,
): number[] {
  const freezeRows = index.sheet.freeze.rows;
  return index.visibleRows.filter((r) => !onlyInputRows || r < freezeRows || inputRows.has(r));
}

/** True when a block (inclusive sheet rectangle) overlaps the selection rectangle. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.top <= b.bottom && a.bottom >= b.top && a.left <= b.right && a.right >= b.left;
}

export const posKey = (p: Pos): string => `${p.row},${p.col}`;
