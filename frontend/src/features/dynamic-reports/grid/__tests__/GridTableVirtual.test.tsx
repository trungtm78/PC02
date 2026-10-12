import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GridTable from '../GridTable';
import type { GridInteraction } from '../GridTable';
import { evaluateGrid } from '../gridEvaluation';
import { makeGrid } from './fixtures';

/**
 * A sheet of thousands of rows is drawn through a window: the rows around the viewport, the frozen rows, the row
 * the cursor is on, and whole merged blocks — with spacer rows keeping the table the height it would be whole.
 */

const ROWS = 3000;
const ROW_H = 20;

function bigGrid() {
  const cells: Record<string, { k: 'text'; v: string; s: number }> = {};
  for (let r = 1; r <= ROWS; r += 1) cells[`A${r}`] = { k: 'text', v: `dòng ${r}`, s: 0 };
  return makeGrid(
    {},
    {
      name: 'Đội 3',
      rows: ROWS,
      cols: 3,
      colWidthsPx: [60, 60, 60],
      rowHeightsPx: Array.from({ length: ROWS }, () => ROW_H),
      hiddenRows: [],
      merges: [{ top: 1499, left: 0, bottom: 1509, right: 0 }], // rows 1500..1510, one block
      freeze: { rows: 2, cols: 0 },
      cells: cells as never,
    },
  );
}

function renderBig(interaction?: GridInteraction) {
  const grid = bigGrid();
  const evaluation = evaluateGrid(grid, [], {});
  return render(<GridTable grid={grid} sheetName="Đội 3" evaluation={evaluation} interaction={interaction} showHeaders={false} />);
}

const drawnRows = () => screen.getAllByRole('row').filter((r) => r.getAttribute('aria-hidden') !== 'true');
const gapHeights = () =>
  screen
    .queryAllByTestId('grid-gap')
    .map((g) => Number((g as HTMLElement).style.height.replace('px', '')));

function scrollTo(top: number) {
  const box = screen.getByTestId('grid-scroll-Đội 3');
  Object.defineProperty(box, 'scrollTop', { value: top, configurable: true });
  Object.defineProperty(box, 'clientHeight', { value: 400, configurable: true });
  fireEvent.scroll(box);
}

describe('GridTable — a large sheet is windowed', () => {
  it('draws far fewer rows than the sheet has, and says nothing is missing: spacer rows hold the height', () => {
    renderBig();
    expect(drawnRows().length).toBeLessThan(200);
    const gaps = gapHeights();
    expect(gaps.length).toBeGreaterThan(0);
    const total = drawnRows().length * ROW_H + gaps.reduce((a, b) => a + b, 0);
    expect(total).toBe(ROWS * ROW_H);
  });

  it('the spacer rows are invisible to a screen reader', () => {
    renderBig();
    for (const g of screen.getAllByTestId('grid-gap')) expect(g).toHaveAttribute('aria-hidden', 'true');
  });

  it('the frozen rows are drawn wherever the sheet is scrolled to', () => {
    renderBig();
    scrollTo(30_000);
    expect(screen.getByTestId('cell-A1')).toBeInTheDocument();
    expect(screen.getByTestId('cell-A2')).toBeInTheDocument();
  });

  it('scrolling draws the rows that come into view and drops the ones that left', () => {
    renderBig();
    expect(screen.queryByTestId('cell-A1000')).toBeNull();
    scrollTo((1000 - 1) * ROW_H);
    expect(screen.getByTestId('cell-A1000')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-A30')).toBeNull();
  });

  it('a merged block that reaches into the window is drawn whole', () => {
    renderBig();
    scrollTo((1505 - 1) * ROW_H); // the middle of the block
    expect(screen.getByTestId('cell-A1500')).toHaveAttribute('rowspan', '11');
  });

  it('the row the cursor is on is drawn wherever the window is, so the keyboard never lands on nothing', () => {
    const interaction: GridInteraction = {
      selection: null,
      active: { row: 2500, col: 0 },
      invalid: new Set(),
      required: new Set(),
      onCellMouseDown: () => undefined,
      onCellMouseEnter: () => undefined,
      onCellDoubleClick: () => undefined,
    };
    renderBig(interaction);
    expect(screen.getByTestId('cell-A2501')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-A1000')).toBeNull();
  });

  it('a normal sheet is drawn whole, exactly as before, with no spacer row', () => {
    const grid = makeGrid();
    render(<GridTable grid={grid} sheetName="Đội 3" evaluation={evaluateGrid(grid, [], {})} />);
    expect(screen.queryAllByTestId('grid-gap')).toHaveLength(0);
  });
});
