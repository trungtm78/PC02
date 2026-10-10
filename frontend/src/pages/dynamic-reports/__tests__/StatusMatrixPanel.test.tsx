import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import StatusMatrixPanel from '../StatusMatrixPanel';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { StatusMatrixView } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: { listStatusReports: vi.fn(), getStatusMatrix: vi.fn() },
}));

function renderPanel(initialEntries = ['/bao-cao-dong/tinh-trang?view=matrix']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <StatusMatrixPanel />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const REPORTS = [{ reportId: 'report1', reportName: 'HSLN' }];

const MATRIX: StatusMatrixView = {
  periods: [
    { periodId: 'p1', periodKey: '2026-05', dueAt: '2026-06-05T17:00:00.000Z' },
    { periodId: 'p2', periodKey: '2026-06', dueAt: '2026-07-05T17:00:00.000Z' },
  ],
  teams: [
    { teamId: 'team1', teamName: 'Đội 1' },
    { teamId: 'team2', teamName: 'Đội 2' },
  ],
  cells: {
    team1: {
      p1: {
        notAssigned: false,
        state: 'APPROVED',
        accessState: 'LOCKED',
        timelinessState: 'ON_TIME',
        exempt: false,
        dueAt: '2026-06-05T17:00:00.000Z',
      },
      p2: {
        notAssigned: false,
        state: 'NOT_STARTED',
        accessState: 'OPEN',
        timelinessState: 'NOT_YET_DUE',
        exempt: false,
        dueAt: '2026-07-05T17:00:00.000Z',
      },
    },
    team2: {
      p1: {
        notAssigned: true,
        state: null,
        accessState: null,
        timelinessState: null,
        exempt: false,
        dueAt: null,
      },
      p2: {
        notAssigned: true,
        state: null,
        accessState: null,
        timelinessState: null,
        exempt: false,
        dueAt: null,
      },
    },
  },
  asOf: '2026-07-01T10:00:00.000Z',
};

describe('StatusMatrixPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the no-report hint until a report is chosen', async () => {
    vi.mocked(dynamicReportsApi.listStatusReports).mockResolvedValue(REPORTS);
    renderPanel();

    await waitFor(() => screen.getByTestId('matrix-no-report'));
    expect(dynamicReportsApi.getStatusMatrix).not.toHaveBeenCalled();
  });

  it('loads the matrix once a report is selected from the URL', async () => {
    vi.mocked(dynamicReportsApi.listStatusReports).mockResolvedValue(REPORTS);
    vi.mocked(dynamicReportsApi.getStatusMatrix).mockResolvedValue(MATRIX);
    renderPanel(['/bao-cao-dong/tinh-trang?view=matrix&matrixReportId=report1']);

    await waitFor(() => screen.getByTestId('matrix-table'));
    expect(dynamicReportsApi.getStatusMatrix).toHaveBeenCalledWith('report1');
    expect(screen.getByTestId('matrix-row-team1')).toHaveTextContent('Đội 1');
  });

  it('distinguishes "Không giao" (no assignment) from "Chưa nhập" (NOT_STARTED)', async () => {
    vi.mocked(dynamicReportsApi.listStatusReports).mockResolvedValue(REPORTS);
    vi.mocked(dynamicReportsApi.getStatusMatrix).mockResolvedValue(MATRIX);
    renderPanel(['/bao-cao-dong/tinh-trang?view=matrix&matrixReportId=report1']);

    await waitFor(() => screen.getByTestId('matrix-table'));

    // team1/p2 has an assignment that's NOT_STARTED ("Chưa bắt đầu").
    expect(screen.getByTestId('matrix-cell-team1-p2')).toHaveTextContent('Chưa bắt đầu');
    // team2 has no assignment at all for either period ("Không giao").
    expect(screen.getByTestId('matrix-cell-team2-p1')).toHaveTextContent('Không giao');
    expect(screen.getByTestId('matrix-cell-team2-p2')).toHaveTextContent('Không giao');
  });

  it('selecting a report from the dropdown updates the URL and fetches its matrix', async () => {
    vi.mocked(dynamicReportsApi.listStatusReports).mockResolvedValue(REPORTS);
    vi.mocked(dynamicReportsApi.getStatusMatrix).mockResolvedValue(MATRIX);
    renderPanel();

    await waitFor(() => screen.getByRole('option', { name: 'HSLN' }));
    await userEvent.selectOptions(screen.getByTestId('matrix-report-select'), 'report1');

    await waitFor(() => {
      expect(dynamicReportsApi.getStatusMatrix).toHaveBeenCalledWith('report1');
    });
  });

  it('shows an error message when the matrix fails to load', async () => {
    vi.mocked(dynamicReportsApi.listStatusReports).mockResolvedValue(REPORTS);
    vi.mocked(dynamicReportsApi.getStatusMatrix).mockRejectedValue(new Error('network'));
    renderPanel(['/bao-cao-dong/tinh-trang?view=matrix&matrixReportId=report1']);

    await waitFor(() => {
      expect(screen.getByText('Không tải được ma trận — vui lòng thử lại.')).toBeInTheDocument();
    });
  });

  it('S23: shows a distinct "forbidden" message (not the generic retry error) on a 404 from the backend', async () => {
    vi.mocked(dynamicReportsApi.listStatusReports).mockResolvedValue(REPORTS);
    const forbidden = Object.assign(new Error('Không tìm thấy báo cáo này.'), {
      isAxiosError: true,
      response: { status: 404, data: { error: { message: 'Không tìm thấy báo cáo này.' } } },
    });
    vi.mocked(dynamicReportsApi.getStatusMatrix).mockRejectedValue(forbidden);
    renderPanel(['/bao-cao-dong/tinh-trang?view=matrix&matrixReportId=report1']);

    await waitFor(() => screen.getByTestId('matrix-forbidden'));
    expect(
      screen.queryByText('Không tải được ma trận — vui lòng thử lại.'),
    ).not.toBeInTheDocument();
  });

  it('shows the empty-periods message when the report has no periods', async () => {
    vi.mocked(dynamicReportsApi.listStatusReports).mockResolvedValue(REPORTS);
    vi.mocked(dynamicReportsApi.getStatusMatrix).mockResolvedValue({
      ...MATRIX,
      periods: [],
      teams: [],
      cells: {},
    });
    renderPanel(['/bao-cao-dong/tinh-trang?view=matrix&matrixReportId=report1']);

    await waitFor(() => screen.getByTestId('matrix-empty'));
  });
});
