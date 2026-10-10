import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import StatusDashboardPage from '../StatusDashboardPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { StatusListResult } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: { listStatus: vi.fn() },
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
});
