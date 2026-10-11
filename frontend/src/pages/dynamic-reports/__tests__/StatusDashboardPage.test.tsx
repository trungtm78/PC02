import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import StatusDashboardPage from '../StatusDashboardPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import type { StatusListResult } from '@/features/dynamic-reports/types';

vi.mock('@/hooks/useOfficerOptions', () => ({ useOfficerOptions: vi.fn() }));

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    listStatus: vi.fn(),
    exportStatus: vi.fn(),
    listStatusReports: vi.fn(),
    listTeamsForFilter: vi.fn(),
    getStatusMatrix: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/bao-cao-dong/tinh-trang']}>
        <StatusDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const RESULT: StatusListResult = {
  items: [
    {
      assignmentId: 'a1',
      reportId: 'report1',
      reportName: 'HSLN',
      periodId: 'period1',
      periodKey: '2026-06',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      teamId: 'team1',
      teamName: 'Đội 3',
      parentTeamName: 'Đội mẹ',
      dataCoverageLabel: '2/3',
      state: 'DRAFT',
      accessState: 'REOPENED',
      timelinessState: 'OVERDUE_NOT_DONE',
      exempt: false,
      dueAt: '2026-06-20T17:00:00.000Z',
      effectiveLockAt: '2026-06-25T17:00:00.000Z',
      submittedAt: null,
      approvedAt: null,
      updatedAt: '2026-06-22T08:00:00.000Z',
      grantCount: 1,
      changedSinceReopen: true,
    },
  ],
  total: 1,
  kpi: {
    requiredCount: 3,
    exemptCount: 1,
    completedCount: 1,
    notStartedCount: 1,
    inProgressCount: 1,
    overdueNotDoneCount: 1,
    reopenedCount: 1,
    completionRateLabel: '1/3',
    onTimeRateLabel: '— / Không có lượt được giao',
    dataCoverageLabel: '2/3',
  },
  asOf: '2026-06-22T10:00:00.000Z',
};

describe('StatusDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOfficerOptions).mockReturnValue({ data: [], isLoading: false } as never);
  });

  it('renders the KPI cards and the status table', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue(RESULT);
    renderPage();

    await waitFor(() => screen.getByTestId('status-row-a1'));
    expect(screen.getByTestId('kpi-required')).toHaveTextContent('3');
    expect(screen.getByTestId('kpi-overdue')).toHaveTextContent('1');
    expect(screen.getByTestId('kpi-reopened')).toHaveTextContent('1');
    expect(screen.getByTestId('status-row-a1')).toHaveTextContent('HSLN');
    expect(screen.getByTestId('status-row-a1')).toHaveTextContent('Đội 3');
    expect(screen.getByTestId('status-row-a1')).toHaveTextContent('Đội mẹ');
    expect(screen.getByTestId('changed-since-reopen-a1')).toBeInTheDocument();
    expect(dynamicReportsApi.listStatus).toHaveBeenCalledWith({}, 1, 25);
  });

  it('shows the empty state when nothing matches the filter', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue({
      ...RESULT,
      items: [],
      total: 0,
    });
    renderPage();

    await waitFor(() => screen.getByTestId('empty-state'));
  });

  it('shows an error message when the list fails to load', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockRejectedValue(new Error('network'));
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText('Không tải được tình trạng nhập liệu — vui lòng thử lại.'),
      ).toBeInTheDocument();
    });
  });

  it('clicking the "Quá hạn chưa nộp" KPI card re-queries with overdue=true', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue(RESULT);
    renderPage();

    await waitFor(() => screen.getByTestId('kpi-overdue'));
    fireEvent.click(screen.getByTestId('kpi-overdue'));

    await waitFor(() => {
      expect(dynamicReportsApi.listStatus).toHaveBeenCalledWith({ overdue: true }, 1, 25);
    });
  });

  it('clicking the same active KPI card again clears the filter', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue(RESULT);
    renderPage();

    await waitFor(() => screen.getByTestId('kpi-overdue'));
    fireEvent.click(screen.getByTestId('kpi-overdue'));
    await waitFor(() => {
      expect(dynamicReportsApi.listStatus).toHaveBeenLastCalledWith({ overdue: true }, 1, 25);
    });
    // re-query the button fresh (it may have unmounted/remounted during the refetch).
    await waitFor(() => screen.getByTestId('kpi-overdue'));
    fireEvent.click(screen.getByTestId('kpi-overdue'));
    await waitFor(() => {
      expect(dynamicReportsApi.listStatus).toHaveBeenLastCalledWith({}, 1, 25);
    });
  });

  it('paginates to the next page', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue({ ...RESULT, total: 30 });
    renderPage();

    await waitFor(() => screen.getByTestId('btn-next-page'));
    fireEvent.click(screen.getByTestId('btn-next-page'));

    await waitFor(() => {
      expect(dynamicReportsApi.listStatus).toHaveBeenLastCalledWith({}, 2, 25);
    });
  });

  it('links each row to its review page', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue(RESULT);
    renderPage();

    await waitFor(() => screen.getByTestId('link-review-a1'));
    expect(screen.getByTestId('link-review-a1')).toHaveAttribute(
      'href',
      '/bao-cao-dong/duyet/a1',
    );
  });

  it('clicking "Xuất CSV" calls exportStatus with the current filters and format csv', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue(RESULT);
    vi.mocked(dynamicReportsApi.exportStatus).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => screen.getByTestId('kpi-overdue'));
    fireEvent.click(screen.getByTestId('kpi-overdue'));
    await waitFor(() => {
      expect(dynamicReportsApi.listStatus).toHaveBeenLastCalledWith({ overdue: true }, 1, 25);
    });

    fireEvent.click(screen.getByTestId('btn-export-csv'));

    await waitFor(() => {
      expect(dynamicReportsApi.exportStatus).toHaveBeenCalledWith({ overdue: true }, 'csv');
    });
  });

  it('clicking "Xuất XLSX" calls exportStatus with format xlsx', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue(RESULT);
    vi.mocked(dynamicReportsApi.exportStatus).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-export-xlsx'));
    fireEvent.click(screen.getByTestId('btn-export-xlsx'));

    await waitFor(() => {
      expect(dynamicReportsApi.exportStatus).toHaveBeenCalledWith({}, 'xlsx');
    });
  });

  it('filters the table by report when a report is selected from the dropdown', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue(RESULT);
    vi.mocked(dynamicReportsApi.listStatusReports).mockResolvedValue([
      { reportId: 'report1', reportName: 'HSLN' },
    ]);
    renderPage();

    await waitFor(() => screen.getByRole('option', { name: 'HSLN' }));
    await userEvent.selectOptions(screen.getByTestId('report-filter-select'), 'report1');

    await waitFor(() => {
      expect(dynamicReportsApi.listStatus).toHaveBeenLastCalledWith(
        { reportId: 'report1' },
        1,
        25,
      );
    });
  });

  it('includes the selected report filter when exporting', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue(RESULT);
    vi.mocked(dynamicReportsApi.listStatusReports).mockResolvedValue([
      { reportId: 'report1', reportName: 'HSLN' },
    ]);
    vi.mocked(dynamicReportsApi.exportStatus).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => screen.getByRole('option', { name: 'HSLN' }));
    await userEvent.selectOptions(screen.getByTestId('report-filter-select'), 'report1');
    await waitFor(() => {
      expect(dynamicReportsApi.listStatus).toHaveBeenLastCalledWith(
        { reportId: 'report1' },
        1,
        25,
      );
    });

    fireEvent.click(screen.getByTestId('btn-export-csv'));

    await waitFor(() => {
      expect(dynamicReportsApi.exportStatus).toHaveBeenCalledWith({ reportId: 'report1' }, 'csv');
    });
  });

  it('filters the table by team when a team is selected from the dropdown (S27)', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue(RESULT);
    vi.mocked(dynamicReportsApi.listTeamsForFilter).mockResolvedValue([
      { teamId: 'team1', teamName: 'Đội 1' },
    ]);
    renderPage();

    await waitFor(() => screen.getByRole('option', { name: 'Đội 1' }));
    await userEvent.selectOptions(screen.getByTestId('team-filter-select'), 'team1');

    await waitFor(() => {
      expect(dynamicReportsApi.listStatus).toHaveBeenLastCalledWith({ teamId: 'team1' }, 1, 25);
    });
  });

  it('includes the selected team filter when exporting (S27)', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue(RESULT);
    vi.mocked(dynamicReportsApi.listTeamsForFilter).mockResolvedValue([
      { teamId: 'team1', teamName: 'Đội 1' },
    ]);
    vi.mocked(dynamicReportsApi.exportStatus).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => screen.getByRole('option', { name: 'Đội 1' }));
    await userEvent.selectOptions(screen.getByTestId('team-filter-select'), 'team1');
    await waitFor(() => {
      expect(dynamicReportsApi.listStatus).toHaveBeenLastCalledWith({ teamId: 'team1' }, 1, 25);
    });

    fireEvent.click(screen.getByTestId('btn-export-csv'));

    await waitFor(() => {
      expect(dynamicReportsApi.exportStatus).toHaveBeenCalledWith({ teamId: 'team1' }, 'csv');
    });
  });

  it('filters the table by editor (người nhập) when selected from the dropdown (S27 slice 8)', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue(RESULT);
    vi.mocked(useOfficerOptions).mockReturnValue({
      data: [{ value: 'user1', label: 'Nguyễn Văn A', teams: [] }],
      isLoading: false,
    } as never);
    renderPage();

    await waitFor(() =>
      within(screen.getByTestId('editor-filter-select')).getByRole('option', {
        name: 'Nguyễn Văn A',
      }),
    );
    await userEvent.selectOptions(screen.getByTestId('editor-filter-select'), 'user1');

    await waitFor(() => {
      expect(dynamicReportsApi.listStatus).toHaveBeenLastCalledWith(
        { editorUserId: 'user1' },
        1,
        25,
      );
    });
  });

  it('filters the table by manager (quản lý) when selected from the dropdown (S27 slice 8)', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue(RESULT);
    vi.mocked(useOfficerOptions).mockReturnValue({
      data: [{ value: 'user2', label: 'Trần Thị B', teams: [] }],
      isLoading: false,
    } as never);
    renderPage();

    await waitFor(() =>
      within(screen.getByTestId('manager-filter-select')).getByRole('option', {
        name: 'Trần Thị B',
      }),
    );
    await userEvent.selectOptions(screen.getByTestId('manager-filter-select'), 'user2');

    await waitFor(() => {
      expect(dynamicReportsApi.listStatus).toHaveBeenLastCalledWith(
        { managerUserId: 'user2' },
        1,
        25,
      );
    });
  });

  it('filters the table by period type (loại kỳ) when selected from the dropdown (S27 slice 8)', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue(RESULT);
    renderPage();

    await waitFor(() => screen.getByTestId('period-type-filter-select'));
    await userEvent.selectOptions(screen.getByTestId('period-type-filter-select'), 'MONTHLY');

    await waitFor(() => {
      expect(dynamicReportsApi.listStatus).toHaveBeenLastCalledWith(
        { periodType: 'MONTHLY' },
        1,
        25,
      );
    });
  });

  it('switches to the matrix view and back without crashing', async () => {
    vi.mocked(dynamicReportsApi.listStatus).mockResolvedValue(RESULT);
    vi.mocked(dynamicReportsApi.listStatusReports).mockResolvedValue([]);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-view-matrix'));
    fireEvent.click(screen.getByTestId('btn-view-matrix'));

    await waitFor(() => screen.getByTestId('status-matrix-panel'));
    expect(screen.queryByTestId('status-table')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('btn-view-table'));
    await waitFor(() => screen.getByTestId('status-table'));
  });
});
