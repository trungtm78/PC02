import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GridTable from '../GridTable';
import { evaluateGrid } from '../gridEvaluation';
import { FIELDS, makeGrid } from './fixtures';

/**
 * `onCellActivate` turns the read-only table into one whose INPUT cells can be
 * opened (the aggregate view lists the teams behind a figure). It has to work
 * from the keyboard too — a click-only cell would lock keyboard users out.
 */

function renderTable(onCellActivate?: React.ComponentProps<typeof GridTable>['onCellActivate']) {
  const grid = makeGrid();
  const evaluation = evaluateGrid(grid, FIELDS, {});
  return render(<GridTable grid={grid} sheetName="Đội 3" evaluation={evaluation} onCellActivate={onCellActivate} />);
}

describe('GridTable onCellActivate', () => {
  it('a click on an input cell reports the field and the cell element', () => {
    const onActivate = vi.fn();
    renderTable(onActivate);
    const cell = screen.getByTestId('cell-C3');
    fireEvent.click(cell);
    expect(onActivate).toHaveBeenCalledTimes(1);
    const info = onActivate.mock.calls[0][0];
    expect(info.field.fieldKey).toBe('Đội 3!C3');
    expect(info.element).toBe(cell);
  });

  it('Enter and Space on a focused input cell do the same', () => {
    const onActivate = vi.fn();
    renderTable(onActivate);
    const cell = screen.getByTestId('cell-C3');
    expect(cell).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(cell, { key: 'Enter' });
    fireEvent.keyDown(cell, { key: ' ' });
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it('only input cells are interactive: static, formula and empty cells are not', () => {
    const onActivate = vi.fn();
    renderTable(onActivate);
    for (const id of ['cell-B3', 'cell-D3', 'cell-C5']) {
      const cell = screen.getByTestId(id);
      expect(cell).not.toHaveAttribute('tabindex');
      fireEvent.click(cell);
    }
    expect(onActivate).not.toHaveBeenCalled();
  });

  it('input cells announce that they open a dialog', () => {
    renderTable(vi.fn());
    expect(screen.getByTestId('cell-C3')).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('without the prop the table is as before: nothing is focusable or clickable', () => {
    renderTable();
    const cell = screen.getByTestId('cell-C3');
    expect(cell).not.toHaveAttribute('tabindex');
    expect(cell).not.toHaveAttribute('aria-haspopup');
  });
});
