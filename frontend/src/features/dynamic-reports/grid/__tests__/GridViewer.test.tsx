import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import GridViewer from '../GridViewer';
import { dynamicReportsApi } from '../../api';
import { FIELDS, makeGrid, makeSheet } from './fixtures';

vi.mock('../../api', () => ({
  dynamicReportsApi: { getVersionGrid: vi.fn() },
}));

const VALUES = { 'Đội 3!C3': { t: 'NUM', v: '1234.5' } };

function renderViewer(onUnavailable?: (reason: string) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <GridViewer versionId="v1" fields={FIELDS} values={VALUES} onUnavailable={onUnavailable} />
    </QueryClientProvider>,
  );
}

describe('GridViewer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a loading note, then the grid', async () => {
    vi.mocked(dynamicReportsApi.getVersionGrid).mockResolvedValue(makeGrid());
    renderViewer();
    expect(screen.getByTestId('grid-loading')).toBeInTheDocument();
    await waitFor(() => screen.getByTestId('grid-viewer'));
    expect(screen.getByTestId('cell-C3')).toHaveTextContent('1.235');
    expect(dynamicReportsApi.getVersionGrid).toHaveBeenCalledWith('v1');
  });

  it('a failed build is announced, and the page is told once so it can show the list', async () => {
    vi.mocked(dynamicReportsApi.getVersionGrid).mockRejectedValue({
      response: { status: 422, data: { code: 'GRID_UNAVAILABLE', message: 'Không dựng được lưới' } },
    });
    const onUnavailable = vi.fn();
    renderViewer(onUnavailable);
    await waitFor(() => screen.getByTestId('grid-unavailable'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1));
  });

  it('announces one failure once, even when the parent re-renders with a new callback each time', async () => {
    vi.mocked(dynamicReportsApi.getVersionGrid).mockRejectedValue(new Error('boom'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const calls: string[] = [];
    const ui = () => (
      <QueryClientProvider client={client}>
        <GridViewer versionId="v1" fields={FIELDS} values={VALUES} onUnavailable={(m) => calls.push(m)} />
      </QueryClientProvider>
    );
    const { rerender } = render(ui());
    await waitFor(() => screen.getByTestId('grid-unavailable'));
    rerender(ui());
    rerender(ui());
    expect(calls).toHaveLength(1);
  });

  it('shows no tabs for a single sheet, and switches between sheets when there are several', async () => {
    const second = makeSheet({
      name: 'TỔNG',
      rows: 1,
      cols: 1,
      colWidthsPx: [60],
      rowHeightsPx: [20],
      hiddenRows: [],
      merges: [],
      freeze: { rows: 0, cols: 0 },
      cells: { A1: { k: 'text', v: 'Trang hai', s: 0 } },
    });
    vi.mocked(dynamicReportsApi.getVersionGrid).mockResolvedValue(
      makeGrid({ sheetOrder: ['Đội 3', 'TỔNG'], sheets: [makeSheet(), second] }),
    );
    renderViewer();
    await waitFor(() => screen.getByTestId('grid-viewer'));
    expect(screen.getByTestId('grid-tab-TỔNG')).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(screen.getByTestId('grid-tab-TỔNG'));
    expect(screen.getByTestId('grid-tab-TỔNG')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('cell-A1')).toHaveTextContent('Trang hai');
  });

  it('a single-sheet model has no tab strip', async () => {
    vi.mocked(dynamicReportsApi.getVersionGrid).mockResolvedValue(makeGrid());
    renderViewer();
    await waitFor(() => screen.getByTestId('grid-viewer'));
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('zoom changes the column width', async () => {
    vi.mocked(dynamicReportsApi.getVersionGrid).mockResolvedValue(makeGrid());
    const { container } = renderViewer();
    await waitFor(() => screen.getByTestId('grid-viewer'));
    const widthOf = () => (container.querySelectorAll('col')[3] as HTMLElement).style.width;
    expect(widthOf()).toBe('80px');
    fireEvent.change(screen.getByTestId('grid-zoom'), { target: { value: '125' } });
    expect(widthOf()).toBe('100px');
  });

  it('"only rows with inputs" hides the label-only rows', async () => {
    vi.mocked(dynamicReportsApi.getVersionGrid).mockResolvedValue(makeGrid());
    renderViewer();
    await waitFor(() => screen.getByTestId('grid-viewer'));
    expect(screen.getByTestId('cell-A5')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('grid-only-inputs'));
    expect(screen.queryByTestId('cell-A5')).toBeNull();
  });

  it('tells the viewer when the file used formatting that could not be drawn', async () => {
    vi.mocked(dynamicReportsApi.getVersionGrid).mockResolvedValue(
      makeGrid({ warnings: ['chart'] }),
    );
    renderViewer();
    await waitFor(() => screen.getByTestId('grid-warnings'));
    expect(screen.getByTestId('grid-warnings')).toHaveTextContent('1');
  });
});
