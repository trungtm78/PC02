import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import GridTable from '../GridTable';
import type { GridPick } from '../GridTable';
import { evaluateGrid } from '../gridEvaluation';
import { makeGrid } from './fixtures';

/**
 * Rows are memoized, so a selection only reaches the rows it touches. A merged block is drawn by its first DRAWN
 * row, which is not its anchor when the anchor's row is hidden: the block must still be shaded when the selection
 * touches only a later row of it (found by review).
 */

function renderWith(selection: GridPick['selection'], sheetOver = {}) {
  const grid = makeGrid({}, { ...sheetOver });
  const pick: GridPick = {
    markers: new Map(),
    selection,
    onCellMouseDown: () => undefined,
    onCellMouseEnter: () => undefined,
  };
  return render(<GridTable grid={grid} sheetName="Đội 3" evaluation={evaluateGrid(grid, [], {})} pick={pick} />);
}

const shaded = (id: string) => (screen.getByTestId(id) as HTMLElement).style.backgroundImage.includes('linear-gradient');

describe('GridTable — the selection shades the blocks it touches', () => {
  // A3:A5 is one block (rows 3..5 of the sheet = 0-based 2..4); row 3 is hidden, so row 4 draws it.
  const BLOCK = { merges: [{ top: 2, left: 0, bottom: 4, right: 0 }], hiddenRows: [2] };

  it('a selection that touches only a later row of a block whose anchor row is hidden still shades the block', () => {
    renderWith({ top: 4, left: 0, bottom: 4, right: 0 }, BLOCK);
    expect(shaded('cell-A3')).toBe(true); // the block is drawn by row 4 but carries its anchor's address
  });

  it('a selection that touches nothing of the block leaves it alone', () => {
    renderWith({ top: 6, left: 1, bottom: 6, right: 1 }, BLOCK);
    expect(shaded('cell-A3')).toBe(false);
  });

  it('with the anchor row drawn, the ordinary case still works', () => {
    renderWith({ top: 3, left: 0, bottom: 3, right: 0 }, { merges: [{ top: 2, left: 0, bottom: 4, right: 0 }] });
    expect(shaded('cell-A3')).toBe(true);
  });

  it('only the rows the selection reaches are shaded', () => {
    renderWith({ top: 3, left: 2, bottom: 3, right: 2 });
    expect(shaded('cell-C4')).toBe(true);
    expect(shaded('cell-C5')).toBe(false);
  });
});
