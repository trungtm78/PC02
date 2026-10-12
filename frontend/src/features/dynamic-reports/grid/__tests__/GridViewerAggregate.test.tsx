import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GridViewer from '../GridViewer';
import type { GridAggregateBinding } from '../GridViewer';
import { dynamicReportsApi } from '../../api';
import { makeGrid } from './fixtures';

vi.mock('../../api', () => ({
  dynamicReportsApi: { getVersionGrid: vi.fn() },
}));

function agg(over: Partial<GridAggregateBinding> = {}): GridAggregateBinding {
  return {
    fields: [
      {
        fieldKey: 'Đội 3!C3',
        sheetKey: 'Đội 3',
        address: 'C3',
        label: 'Số vụ mới',
        type: 'NUM',
        value: '30',
        displayNotAggregated: false,
        countTotal: 2,
        countNonBlank: 2,
        contributors: [
          { teamName: 'Đội 3', value: '10', state: 'SUBMITTED', revision: '1', updatedAt: '2026-06-10T08:00:00.000Z' },
          { teamName: 'Đội 4', value: '20', state: 'APPROVED', revision: '1', updatedAt: '2026-06-11T08:00:00.000Z' },
        ],
      },
      {
        fieldKey: 'Đội 3!C4',
        sheetKey: 'Đội 3',
        address: 'C4',
        label: 'Đã giải quyết',
        type: 'NUM',
        value: null,
        displayNotAggregated: false,
        countTotal: 2,
        countNonBlank: 0,
        contributors: [],
      },
    ],
    formulaValues: { 'Đội 3!C5': { ok: true, type: 'number', value: '777' } },
    formulaSource: 'LIVE',
    calcEngineVersion: 1,
    ...over,
  };
}

function renderViewer(aggregate: GridAggregateBinding) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GridViewer versionId="v1" aggregate={aggregate} />
    </QueryClientProvider>,
  );
}

describe('GridViewer — aggregate (S15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dynamicReportsApi.getVersionGrid).mockResolvedValue(makeGrid());
  });

  it('draws the aggregated figures in the input cells and the SERVER figures in the formula cells', async () => {
    renderViewer(agg());
    await waitFor(() => screen.getByTestId('grid-viewer'));
    expect(screen.getByTestId('cell-C3')).toHaveTextContent('30');
    // SUM(C3:C4) would be 99 here (the template's own sample) — the server says 777.
    expect(screen.getByTestId('cell-C5')).toHaveTextContent('777');
  });

  it('opens the teams behind a figure when its cell is clicked, and closes on a second click', async () => {
    renderViewer(agg());
    await waitFor(() => screen.getByTestId('grid-viewer'));
    expect(screen.queryByTestId('contributors-popover')).toBeNull();

    fireEvent.click(screen.getByTestId('cell-C3'));
    const popover = screen.getByTestId('contributors-popover');
    expect(popover).toHaveTextContent('Đội 3');
    expect(popover).toHaveTextContent('Đội 4');

    fireEvent.click(screen.getByTestId('cell-C3'));
    expect(screen.queryByTestId('contributors-popover')).toBeNull();
  });

  it('clicking another figure moves the popover to it', async () => {
    renderViewer(agg());
    await waitFor(() => screen.getByTestId('grid-viewer'));
    fireEvent.click(screen.getByTestId('cell-C3'));
    fireEvent.click(screen.getByTestId('cell-C4'));
    expect(screen.getByRole('dialog')).toHaveAccessibleName(/Đã giải quyết/);
  });

  it('Escape closes the popover', async () => {
    renderViewer(agg());
    await waitFor(() => screen.getByTestId('grid-viewer'));
    fireEvent.click(screen.getByTestId('cell-C3'));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByTestId('contributors-popover')).toBeNull();
  });

  it('says where the formula figures come from', async () => {
    const { unmount } = renderViewer(agg());
    await waitFor(() => screen.getByTestId('grid-viewer'));
    expect(screen.getByTestId('formula-source-note')).toHaveTextContent(/tính từ tổng/i);
    unmount();

    renderViewer(agg({ formulaSource: 'FROZEN', calcEngineVersion: 3 }));
    await waitFor(() => screen.getByTestId('formula-source-note'));
    expect(screen.getByTestId('formula-source-note')).toHaveTextContent(/đã chốt/i);
    expect(screen.getByTestId('formula-source-note')).toHaveTextContent('3');
  });

  it('without figures from the server the formula cells are dashes and the note says so', async () => {
    renderViewer(agg({ formulaSource: 'UNAVAILABLE', formulaValues: null, calcEngineVersion: null }));
    await waitFor(() => screen.getByTestId('grid-viewer'));
    expect(screen.getByTestId('cell-C5')).toHaveTextContent('—');
    expect(screen.getByTestId('formula-source-note')).toHaveTextContent(/chưa có số công thức/i);
  });

  it('the cells are keyboard-reachable', async () => {
    renderViewer(agg());
    await waitFor(() => screen.getByTestId('grid-viewer'));
    const cell = screen.getByTestId('cell-C3');
    cell.focus();
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(screen.getByTestId('contributors-popover')).toBeInTheDocument();
  });
});
