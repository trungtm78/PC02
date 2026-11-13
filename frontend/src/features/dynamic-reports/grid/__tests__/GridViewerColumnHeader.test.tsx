import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GridViewer from '../GridViewer';
import type { GridViewerProps } from '../GridViewer';
import { makeGrid } from './fixtures';

vi.mock('../../api', () => ({
  dynamicReportsApi: { getVersionGrid: vi.fn() },
}));

/** A caller may make the column letters clickable (picking a whole column) and supply its own pick legend. */
const grid = makeGrid();

function renderViewer(props: Partial<GridViewerProps> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GridViewer versionId="v1" grid={grid} {...props} />
    </QueryClientProvider>,
  );
}

describe('GridViewer — column headers that can be clicked', () => {
  it('without the handler a column letter is plain text, as it always was', () => {
    renderViewer();
    expect(screen.queryByTestId('col-header-B')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'B' })).toBeInTheDocument();
  });

  it('with the handler every letter is a button that reports its column and the sheet shown', () => {
    const onColumnHeaderClick = vi.fn();
    renderViewer({ onColumnHeaderClick });
    fireEvent.click(screen.getByTestId('col-header-B'));
    expect(onColumnHeaderClick).toHaveBeenCalledWith('B', 'Đội 3');
    expect(screen.getByTestId('col-header-E').tagName).toBe('BUTTON');
  });

  it('marks the header of the picked column, and only that one', () => {
    renderViewer({ onColumnHeaderClick: vi.fn(), selectedColumn: 'C' });
    expect(screen.getByTestId('col-header-C')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('col-header-B')).toHaveAttribute('aria-pressed', 'false');
  });

  it('names the button for people who cannot see the letter\'s meaning', () => {
    renderViewer({ onColumnHeaderClick: vi.fn(), columnHeaderLabel: (c) => `Chọn cả cột ${c}` });
    expect(screen.getByRole('button', { name: 'Chọn cả cột B' })).toBeInTheDocument();
  });

  it('a caller\'s own legend replaces the wizard\'s words about input cells', () => {
    renderViewer({
      mark: { candidates: new Set(['Đội 3!B3']), chosen: new Set(), onPick: vi.fn(), legend: 'Chú thích riêng' },
    });
    expect(screen.getByTestId('mark-legend')).toHaveTextContent('Chú thích riêng');
    expect(screen.getByTestId('mark-legend')).not.toHaveTextContent('ô nhập đã có');
  });
});
