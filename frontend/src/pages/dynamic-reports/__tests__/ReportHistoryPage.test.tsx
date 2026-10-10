import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReportHistoryPage from '../ReportHistoryPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { ReportHistoryView } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: { getReportHistory: vi.fn() },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/bao-cao-dong/duyet/tong-hop/period1/lich-su']}>
        <Routes>
          <Route
            path="/bao-cao-dong/duyet/tong-hop/:periodId/lich-su"
            element={<ReportHistoryPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const VIEW: ReportHistoryView = {
  periodId: 'period1',
  reportName: 'HSLN',
  periodKey: '2026-10',
  assignments: [
    {
      assignmentId: 'a1',
      teamName: 'Đội 3',
      state: 'SUBMITTED',
      currentRevision: '2',
      revisions: [
        {
          revision: '1',
          kind: 'SUBMIT',
          actorName: 'Văn Nguyễn',
          reason: null,
          committedAt: '2026-10-10T08:00:00.000Z',
        },
        {
          revision: '2',
          kind: 'SAVE',
          actorName: 'Văn Nguyễn',
          reason: null,
          committedAt: '2026-10-11T08:00:00.000Z',
        },
      ],
      changedFieldKeysSinceFirstSubmit: ['Đội 3!C6'],
    },
    {
      assignmentId: 'a2',
      teamName: 'Đội 4',
      state: 'NOT_STARTED',
      currentRevision: '0',
      revisions: [],
      changedFieldKeysSinceFirstSubmit: null,
    },
  ],
};

describe('ReportHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists every assignment with its revision count and changed-keys count', async () => {
    vi.mocked(dynamicReportsApi.getReportHistory).mockResolvedValue(VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('history-row-a1'));
    expect(screen.getByTestId('history-row-a1')).toHaveTextContent('2 lượt sửa');
    expect(screen.getByTestId('changed-count-a1')).toHaveTextContent('1 ô đổi so với lần nộp đầu');
    expect(screen.getByTestId('history-row-a2')).toHaveTextContent('0 lượt sửa');
    expect(dynamicReportsApi.getReportHistory).toHaveBeenCalledWith('period1');
  });

  it('expands a row to show its full revision table and changed field keys', async () => {
    vi.mocked(dynamicReportsApi.getReportHistory).mockResolvedValue(VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('history-row-a1'));
    expect(screen.queryByTestId('history-detail-a1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('history-row-a1'));

    await waitFor(() => screen.getByTestId('history-detail-a1'));
    expect(screen.getByTestId('history-detail-a1')).toHaveTextContent('SUBMIT');
    expect(screen.getByTestId('changed-keys-a1')).toHaveTextContent('Đội 3!C6');
  });

  it('shows "Chưa có hoạt động nào" for a team that never touched its submission', async () => {
    vi.mocked(dynamicReportsApi.getReportHistory).mockResolvedValue(VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('history-row-a2'));
    fireEvent.click(screen.getByTestId('history-row-a2'));

    await waitFor(() => screen.getByTestId('history-detail-a2'));
    expect(screen.getByTestId('history-detail-a2')).toHaveTextContent('Chưa có hoạt động nào');
    expect(screen.queryByTestId('changed-keys-a2')).not.toBeInTheDocument();
  });

  it('shows an error message when the history fails to load', async () => {
    vi.mocked(dynamicReportsApi.getReportHistory).mockRejectedValue(new Error('network'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Không tải được lịch sử kỳ này.')).toBeInTheDocument();
    });
  });
});
