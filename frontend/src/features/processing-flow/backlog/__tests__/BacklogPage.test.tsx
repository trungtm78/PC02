import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import BacklogPage from '../BacklogPage';
import { backlogApi } from '../api';
import { monthOf } from '../backlogKeys';
import type { BacklogUnitRow, BacklogUnitsDto, OnTimeReportDto } from '../types';
import type { TrackingItemDto, TrackingItemsDto } from '../../tracking/types';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { apiError } from '../../__tests__/fixtures';

vi.mock('../api', () => ({ backlogApi: { units: vi.fn(), cellItems: vi.fn(), onTime: vi.fn(), exportUnits: vi.fn() } }));

const api = vi.mocked(backlogApi);
const T = L.backlog;

const AS_OF = '2026-12-10T02:30:00.000Z'; // 09:30 in Vietnam
const AS_OF_2 = '2026-12-10T02:45:00.000Z'; // 09:45 in Vietnam

const unit = (teamId: string, teamName: string, parentTeamId: string | null, over: Partial<BacklogUnitRow> = {}): BacklogUnitRow => ({
  teamId,
  teamName,
  parentTeamId,
  holding: 0,
  OVERDUE: 0,
  RED: 0,
  YELLOW: 0,
  GREEN: 0,
  NONE: 0,
  oldestDueAt: null,
  oldestDays: null,
  ...over,
});

/** The server sends the child before its parent: the screen, not the server, makes the tree. */
const units = (over: Partial<BacklogUnitsDto> = {}): BacklogUnitsDto => ({
  asOf: AS_OF,
  rows: [
    unit('to-1', 'Tổ 1', 'doi-1', { holding: 5, OVERDUE: 2, RED: 1, GREEN: 3, NONE: 1, oldestDueAt: '2026-12-07T16:59:59.999Z', oldestDays: 3 }),
    unit('doi-1', 'Đội 1', null, { holding: 2, OVERDUE: 1, YELLOW: 1, NONE: 2, oldestDueAt: '2026-12-12T16:59:59.999Z', oldestDays: 0 }),
    unit('doi-2', 'Đội 2', null, { holding: 4, GREEN: 4 }),
  ],
  totals: { holding: 10, OVERDUE: 3, RED: 1, YELLOW: 1, GREEN: 7, NONE: 3 },
  ...over,
});

const item = (over: Partial<TrackingItemDto> = {}): TrackingItemDto => ({
  id: 'party-1',
  recordKind: 'PETITION',
  recordId: 'pet-1',
  recordCode: '2026-11940',
  recordLabel: 'Phạm Văn Đ',
  stepKey: 's2',
  stepName: 'Xác minh',
  teamId: 'to-1',
  teamName: 'Tổ 1',
  assigneeUserId: 'u7',
  responsibleName: 'Trần B',
  dueAt: '2026-12-07T16:59:59.999Z',
  band: 'OVERDUE',
  remainingDays: -3,
  ...over,
});
const items = (rows: TrackingItemDto[], over: Partial<TrackingItemsDto> = {}): TrackingItemsDto => ({
  asOf: AS_OF,
  band: null,
  items: rows,
  total: rows.length,
  page: 1,
  pageSize: 20,
  ...over,
});

const onTime = (over: Partial<OnTimeReportDto> = {}): OnTimeReportDto => ({
  asOf: AS_OF,
  from: '2026-12-01',
  to: '2026-12-31',
  rows: [
    { teamId: 'doi-1', teamName: 'Đội 1', parentTeamId: null, doneOnTime: 7, doneLate: 1, openInTime: 3, openOverdue: 2, onTimeRate: 0.875, averageDays: 4.5 },
    { teamId: 'doi-2', teamName: 'Đội 2', parentTeamId: null, doneOnTime: 0, doneLate: 0, openInTime: 4, openOverdue: 0, onTimeRate: null, averageDays: null },
  ],
  totals: { doneOnTime: 7, doneLate: 1, openInTime: 7, openOverdue: 2, onTimeRate: 0.875, averageDays: 4.5 },
  ...over,
});

function Where() {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(path = '/ton-dong-theo-don-vi') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/ton-dong-theo-don-vi" element={<><BacklogPage /><Where /></>} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const where = () => screen.getByTestId('where').textContent ?? '';
const cellOf = (teamId: string, band: string) => screen.getByTestId(`backlog-cell-${teamId}-${band}`);
const unitOrder = () => screen.getAllByTestId(/^backlog-row-/).map((row) => row.getAttribute('data-testid'));
const loaded = () => waitFor(() => expect(screen.getByTestId('backlog-table')).toBeInTheDocument());

beforeEach(() => {
  vi.resetAllMocks();
  api.units.mockResolvedValue(units());
  api.cellItems.mockResolvedValue(items([item(), item({ id: 'party-2', recordId: 'pet-2', recordCode: '2026-11902' })]));
  api.onTime.mockResolvedValue(onTime());
  api.exportUnits.mockResolvedValue(undefined);
});

describe('the table of units', () => {
  it('lists the units as a tree, with each number, the oldest deadline and the totals of the server', async () => {
    renderPage();
    await loaded();
    expect(unitOrder()).toEqual(['backlog-row-doi-1', 'backlog-row-to-1', 'backlog-row-doi-2']);
    expect(cellOf('to-1', 'OVERDUE')).toHaveTextContent('2');
    expect(cellOf('doi-1', 'OVERDUE')).toHaveTextContent('1');
    expect(screen.getByTestId('backlog-holding-to-1')).toHaveTextContent('5');
    expect(screen.getByTestId('backlog-oldest-to-1')).toHaveTextContent('07/12/2026 · quá 3 ngày');
    // Not past its deadline: the day alone. No deadline at all: a dash.
    expect(screen.getByTestId('backlog-oldest-doi-1')).toHaveTextContent(/^12\/12\/2026$/);
    expect(screen.getByTestId('backlog-oldest-doi-2')).toHaveTextContent(T.none);
    const totals = within(screen.getByTestId('backlog-totals'));
    expect(totals.getByText('10')).toBeInTheDocument();
    expect(screen.getByTestId('backlog-total-OVERDUE')).toHaveTextContent('3');
    expect(screen.getByTestId('backlog-total-GREEN')).toHaveTextContent('7');
    expect(screen.getByTestId('backlog-as-of')).toHaveTextContent('09:30');
    // A zero opens nothing.
    expect(cellOf('doi-2', 'RED').tagName).toBe('SPAN');
  });

  it('rolled up, shows each top unit with the sums under it, `holding` as a lower bound, and no link on a sum', async () => {
    renderPage('/ton-dong-theo-don-vi?backlog_rollup=1');
    await loaded();
    expect(unitOrder()).toEqual(['backlog-row-doi-1', 'backlog-row-doi-2']);
    expect(cellOf('doi-1', 'OVERDUE')).toHaveTextContent('3');
    expect(cellOf('doi-1', 'NONE')).toHaveTextContent('3');
    expect(cellOf('doi-1', 'OVERDUE').tagName).toBe('SPAN');
    expect(screen.getByTestId('backlog-holding-doi-1')).toHaveTextContent('≥ 5');
    expect(screen.getByTestId('backlog-oldest-doi-1')).toHaveTextContent('07/12/2026 · quá 3 ngày');
    // A top unit with nothing under it keeps its own exact figures, and they still open.
    expect(screen.getByTestId('backlog-holding-doi-2')).toHaveTextContent(/^4$/);
    expect(cellOf('doi-2', 'GREEN').tagName).toBe('BUTTON');
  });

  it('the roll-up toggle is kept in the address', async () => {
    renderPage();
    await loaded();
    fireEvent.click(screen.getByTestId('backlog-rollup'));
    await waitFor(() => expect(where()).toContain('backlog_rollup=1'));
    fireEvent.click(screen.getByTestId('backlog-rollup'));
    await waitFor(() => expect(where()).not.toContain('backlog_rollup'));
  });
});

describe('the rows behind a number', () => {
  it('asks exactly the cell: its unit, its band, the filters of the table and the instant of the table', async () => {
    renderPage('/ton-dong-theo-don-vi?backlog_kind=PETITION&backlog_role=CHECK&backlog_from=2026-11-01&backlog_to=2026-11-30');
    await loaded();
    expect(api.cellItems).not.toHaveBeenCalled();
    fireEvent.click(cellOf('to-1', 'OVERDUE'));
    await waitFor(() => expect(api.cellItems).toHaveBeenCalledTimes(1));
    expect(api.cellItems).toHaveBeenCalledWith({
      kind: 'PETITION',
      role: 'CHECK',
      from: '2026-11-01',
      to: '2026-11-30',
      teamId: 'to-1',
      band: 'OVERDUE',
      asOf: AS_OF,
      page: 1,
      pageSize: 20,
    });
    expect(where()).toContain('backlog_team=to-1');
    expect(where()).toContain('backlog_band=OVERDUE');
    await waitFor(() => expect(screen.getByTestId('backlog-cell-count')).toHaveTextContent('2 dòng'));
    expect(screen.getByTestId('backlog-cell-panel')).toHaveTextContent('Tổ 1 · Quá hạn');
    // The rows are the tracking screen's rows, and a row opens the record on the assignment tab.
    const row = screen.getByTestId('tracking-row-party-1');
    expect(within(row).getByRole('link', { name: T_OPEN('2026-11940') })).toHaveAttribute('href', '/petitions/pet-1?tab=phan-cong-xu-ly');
    // The number equals its rows: nothing to say.
    expect(screen.queryByTestId('backlog-changed')).not.toBeInTheDocument();
  });

  it('opens a cell of the band NONE too, and closes it again', async () => {
    renderPage();
    await loaded();
    fireEvent.click(cellOf('doi-1', 'NONE'));
    await waitFor(() => expect(api.cellItems).toHaveBeenCalledWith(expect.objectContaining({ teamId: 'doi-1', band: 'NONE', role: 'MAIN', kind: null, from: null, to: null })));
    fireEvent.click(screen.getByTestId('backlog-cell-close'));
    await waitFor(() => expect(screen.queryByTestId('backlog-cell-panel')).not.toBeInTheDocument());
    expect(where()).not.toContain('backlog_team');
  });

  it('says the figures changed when the rows are not the number, and a refresh takes a new instant for both', async () => {
    api.cellItems.mockResolvedValue(items([item()], { total: 1 }));
    renderPage('/ton-dong-theo-don-vi?backlog_team=to-1&backlog_band=OVERDUE');
    await waitFor(() => expect(screen.getByTestId('backlog-changed')).toHaveTextContent(L.tracking.changed('09:30')));

    api.units.mockResolvedValue(
      units({
        asOf: AS_OF_2,
        rows: [unit('to-1', 'Tổ 1', null, { holding: 1, OVERDUE: 1 })],
        totals: { holding: 1, OVERDUE: 1, RED: 0, YELLOW: 0, GREEN: 0, NONE: 0 },
      }),
    );
    fireEvent.click(screen.getByTestId('backlog-refresh'));
    await waitFor(() => expect(api.cellItems).toHaveBeenLastCalledWith(expect.objectContaining({ teamId: 'to-1', band: 'OVERDUE', asOf: AS_OF_2 })));
    await waitFor(() => expect(screen.queryByTestId('backlog-changed')).not.toBeInTheDocument());
    expect(api.units).toHaveBeenCalledTimes(2);
    expect(cellOf('to-1', 'OVERDUE')).toHaveTextContent('1');
  });

  it('pages the rows of the cell in the address', async () => {
    api.cellItems.mockResolvedValue(items([item()], { total: 45 }));
    renderPage('/ton-dong-theo-don-vi?backlog_team=to-1&backlog_band=OVERDUE&backlog_page=2');
    await waitFor(() => expect(api.cellItems).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })));
  });

  it('a failed list is said, with its own retry, and is not an empty cell', async () => {
    api.cellItems.mockRejectedValue(apiError(500, null));
    renderPage('/ton-dong-theo-don-vi?backlog_team=to-1&backlog_band=OVERDUE');
    await waitFor(() => expect(screen.getByTestId('backlog-list-error')).toBeInTheDocument());
    expect(screen.queryByText(T.cell.empty)).not.toBeInTheDocument();
    api.cellItems.mockResolvedValue(items([item(), item({ id: 'party-2' })]));
    fireEvent.click(screen.getByTestId('backlog-list-retry'));
    await waitFor(() => expect(screen.getByTestId('tracking-row-party-2')).toBeInTheDocument());
  });
});

const T_OPEN = (code: string) => L.tracking.open(code);

describe('the filters', () => {
  it('reads them from the address and sends them with the table', async () => {
    renderPage('/ton-dong-theo-don-vi?backlog_kind=CASE&backlog_role=COORDINATE&backlog_from=2026-10-01&backlog_to=2026-10-31');
    await loaded();
    expect(api.units).toHaveBeenCalledWith({ kind: 'CASE', role: 'COORDINATE', from: '2026-10-01', to: '2026-10-31' });
    expect(screen.getByTestId('backlog-filter-kind')).toHaveValue('CASE');
    expect(screen.getByTestId('backlog-filter-role')).toHaveValue('COORDINATE');
    expect(screen.getByTestId('backlog-filter-from')).toHaveValue('2026-10-01');
  });

  it('writes them to the address under the prefix of the screen, the default role as no key at all', async () => {
    renderPage('/ton-dong-theo-don-vi?backlog_team=to-1&backlog_band=OVERDUE&backlog_page=3');
    await loaded();
    fireEvent.change(screen.getByTestId('backlog-filter-kind'), { target: { value: 'INCIDENT' } });
    await waitFor(() => expect(where()).toContain('backlog_kind=INCIDENT'));
    // What is counted changed: the open cell starts again at its first page.
    expect(where()).not.toContain('backlog_page');
    fireEvent.change(screen.getByTestId('backlog-filter-role'), { target: { value: 'CHECK' } });
    await waitFor(() => expect(where()).toContain('backlog_role=CHECK'));
    fireEvent.change(screen.getByTestId('backlog-filter-from'), { target: { value: '2026-11-01' } });
    await waitFor(() => expect(where()).toContain('backlog_from=2026-11-01'));
    await waitFor(() => expect(api.units).toHaveBeenLastCalledWith({ kind: 'INCIDENT', role: 'CHECK', from: '2026-11-01', to: null }));
    fireEvent.change(screen.getByTestId('backlog-filter-role'), { target: { value: 'MAIN' } });
    await waitFor(() => expect(where()).not.toContain('backlog_role'));
    fireEvent.click(screen.getByTestId('backlog-clear-filters'));
    await waitFor(() => expect(where()).not.toContain('backlog_kind'));
    expect(where()).not.toContain('backlog_from');
  });

  it('ignores a value of the address the contract does not know', async () => {
    renderPage('/ton-dong-theo-don-vi?backlog_kind=NOPE&backlog_role=INFORM&backlog_from=01/11/2026');
    await loaded();
    expect(api.units).toHaveBeenCalledWith({ kind: null, role: 'MAIN', from: null, to: null });
  });
});

describe('the states of the screen', () => {
  it('a failed load is said, with a retry, and is not the empty table', async () => {
    api.units.mockRejectedValue(apiError(500, null));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('backlog-load-error')).toBeInTheDocument());
    expect(screen.queryByTestId('backlog-empty')).not.toBeInTheDocument();
    expect(screen.queryByTestId('backlog-table')).not.toBeInTheDocument();
    api.units.mockResolvedValue(units());
    fireEvent.click(screen.getByTestId('backlog-retry'));
    await loaded();
  });

  it('no unit at all is the empty state, not an error', async () => {
    api.units.mockResolvedValue(units({ rows: [], totals: { holding: 0, OVERDUE: 0, RED: 0, YELLOW: 0, GREEN: 0, NONE: 0 } }));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('backlog-empty')).toHaveTextContent(T.empty));
    expect(screen.queryByTestId('backlog-load-error')).not.toBeInTheDocument();
  });

  it('shows loading until the table answers', async () => {
    api.units.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(await screen.findByTestId('backlog-loading')).toBeInTheDocument();
  });

  it('says the feature is off on a 404 with no code', async () => {
    api.units.mockRejectedValue(apiError(404, null));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('processing-flow-disabled')).toHaveTextContent(L.recordTabs.off));
  });

  it('says the person lacks the permission on a 403, and offers no export', async () => {
    api.units.mockRejectedValue(apiError(403, null));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('backlog-forbidden')).toHaveTextContent(T.forbidden));
    expect(screen.queryByTestId('backlog-export')).not.toBeInTheDocument();
    expect(screen.queryByTestId('backlog-on-time')).not.toBeInTheDocument();
  });
});

describe('the on-time rate by period', () => {
  it('asks the current month in Vietnam by default, with the kind and the role of the table', async () => {
    renderPage('/ton-dong-theo-don-vi?backlog_kind=CASE&backlog_role=CHECK');
    await waitFor(() => expect(api.onTime).toHaveBeenCalled());
    expect(api.onTime).toHaveBeenCalledWith({ kind: 'CASE', role: 'CHECK', ...monthOf() });
    expect(screen.getByTestId('backlog-period-from')).toHaveValue(monthOf().from);
  });

  it('formats the rate as a percent, a missing rate and a missing mean as a dash, and shows the totals', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('backlog-on-time-row-doi-1')).toBeInTheDocument());
    expect(screen.getByTestId('backlog-on-time-doi-1-rate')).toHaveTextContent('87,5%');
    expect(screen.getByTestId('backlog-on-time-doi-1-days')).toHaveTextContent('4,5');
    expect(screen.getByTestId('backlog-on-time-doi-2-rate')).toHaveTextContent(/^—$/);
    expect(screen.getByTestId('backlog-on-time-doi-2-days')).toHaveTextContent(/^—$/);
    expect(screen.getByTestId('backlog-on-time-totals-rate')).toHaveTextContent('87,5%');
    const row = within(screen.getByTestId('backlog-on-time-row-doi-1'));
    expect(row.getByText('7')).toBeInTheDocument();
    expect(row.getByText('3')).toBeInTheDocument();
  });

  it('states the formula of the rate: work overdue and not done counts against it', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('backlog-on-time')).toBeInTheDocument());
    expect(screen.getByTestId('backlog-on-time')).toHaveTextContent('xong đúng hạn ÷ (xong đúng hạn + xong trễ + đang quá hạn)');
  });

  it('keeps a chosen period in the address and asks it', async () => {
    renderPage();
    await waitFor(() => expect(api.onTime).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('backlog-period-from'), { target: { value: '2026-10-01' } });
    await waitFor(() => expect(where()).toContain('backlog_period_from=2026-10-01'));
    await waitFor(() => expect(api.onTime).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-10-01', to: monthOf().to })));
    fireEvent.click(screen.getByTestId('backlog-period-reset'));
    await waitFor(() => expect(where()).not.toContain('backlog_period_from'));
  });

  it('a failed report is said with a retry, and the table above still stands', async () => {
    api.onTime.mockRejectedValue(apiError(500, null));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('backlog-on-time-error')).toBeInTheDocument());
    expect(screen.queryByTestId('backlog-on-time-empty')).not.toBeInTheDocument();
    expect(screen.getByTestId('backlog-table')).toBeInTheDocument();
  });
});

describe('the export', () => {
  it('downloads the table as filtered, at the instant on screen', async () => {
    renderPage('/ton-dong-theo-don-vi?backlog_kind=PETITION&backlog_role=CHECK&backlog_to=2026-11-30');
    await loaded();
    fireEvent.click(screen.getByTestId('backlog-export'));
    await waitFor(() => expect(api.exportUnits).toHaveBeenCalledTimes(1));
    expect(api.exportUnits).toHaveBeenCalledWith({ kind: 'PETITION', role: 'CHECK', from: null, to: '2026-11-30' }, AS_OF);
  });

  it('says so when the export fails', async () => {
    api.exportUnits.mockRejectedValue(apiError(500, null));
    renderPage();
    await loaded();
    fireEvent.click(screen.getByTestId('backlog-export'));
    await waitFor(() => expect(screen.getByTestId('backlog-export-error')).toBeInTheDocument());
  });
});
