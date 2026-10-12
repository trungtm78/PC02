import { key } from './gridIndex';
import { blockRect, move, samePos } from './navigation';
import type { NavModel, Pos, Rect } from './navigation';
import type { Direction } from './keymap';

/**
 * A selection is two cells: where it started (the anchor) and where it ends
 * (the focus, the cell that has the cursor). Everything else — the rectangle,
 * the cells inside it — is derived, and always grows to take in any merged
 * block it touches, like Excel.
 */

export interface Selection {
  anchor: Pos;
  focus: Pos;
}

export const single = (p: Pos): Selection => ({ anchor: p, focus: p });

export function isSingleCell(model: NavModel, s: Selection): boolean {
  const r = selectionRect(model, s);
  const only = blockRect(model, s.anchor);
  return samePos(s.anchor, s.focus) && r.top === only.top && r.bottom === only.bottom && r.left === only.left && r.right === only.right;
}

/** The sheet rectangle (inclusive) covered by the selection, grown to whole merged blocks. */
export function selectionRect(model: NavModel, s: Selection): Rect {
  const a = blockRect(model, s.anchor);
  const f = blockRect(model, s.focus);
  let rect: Rect = {
    top: Math.min(a.top, f.top),
    left: Math.min(a.left, f.left),
    bottom: Math.max(a.bottom, f.bottom),
    right: Math.max(a.right, f.right),
  };

  // Growing to take in one block can make the rectangle touch another: repeat until it settles.
  for (let pass = 0; pass <= model.layout.owners.size; pass++) {
    let grown = false;
    for (const [ownerKey] of model.layout.owners) {
      const [r, c] = ownerKey.split(',').map(Number);
      const b = blockRect(model, { row: r, col: c });
      const touches = b.top <= rect.bottom && b.bottom >= rect.top && b.left <= rect.right && b.right >= rect.left;
      if (!touches) continue;
      const next: Rect = {
        top: Math.min(rect.top, b.top),
        left: Math.min(rect.left, b.left),
        bottom: Math.max(rect.bottom, b.bottom),
        right: Math.max(rect.right, b.right),
      };
      if (next.top !== rect.top || next.left !== rect.left || next.bottom !== rect.bottom || next.right !== rect.right) {
        rect = next;
        grown = true;
      }
    }
    if (!grown) break;
  }
  return rect;
}

/** The drawn cells (the cells that draw a block count once) inside a rectangle, in reading order. */
export function cellsInRect(model: NavModel, rect: Rect, limit = 20_000): Pos[] {
  const out: Pos[] = [];
  for (const row of model.rows) {
    if (row < rect.top) continue;
    if (row > rect.bottom) break;
    for (const col of model.cols) {
      if (col < rect.left) continue;
      if (col > rect.right) break;
      if (model.layout.covered.has(key(row, col))) continue;
      out.push({ row, col });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function cellsInSelection(model: NavModel, s: Selection, limit?: number): Pos[] {
  return cellsInRect(model, selectionRect(model, s), limit);
}

/** Shift+arrow: the anchor stays, the focus moves. Without Shift the whole selection collapses to the moved cursor. */
export function moveSelection(
  model: NavModel,
  s: Selection,
  dir: Direction,
  opts: { extend: boolean; jump: boolean },
): Selection {
  const focus = move(model, s.focus, dir, opts.jump);
  return opts.extend ? { anchor: s.anchor, focus } : single(focus);
}

export function selectAll(model: NavModel): Selection | null {
  const first = firstDrawn(model);
  const last = lastDrawn(model);
  if (!first || !last) return null;
  return { anchor: first, focus: last };
}

function firstDrawn(model: NavModel): Pos | null {
  const row = model.rows[0];
  const col = model.cols[0];
  if (row === undefined || col === undefined) return null;
  return { row, col };
}

function lastDrawn(model: NavModel): Pos | null {
  const row = model.rows[model.rows.length - 1];
  const col = model.cols[model.cols.length - 1];
  if (row === undefined || col === undefined) return null;
  const owner = model.layout.ownerKeyOf.get(key(row, col));
  if (owner) {
    const [r, c] = owner.split(',').map(Number);
    return { row: r, col: c };
  }
  return { row, col };
}
