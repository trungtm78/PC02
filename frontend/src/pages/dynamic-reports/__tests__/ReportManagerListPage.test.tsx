import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ReportManagerListPage from '../ReportManagerListPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { AssignmentSummary } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: { listForManager: vi.fn() },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ReportManagerListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const SAMPLE: AssignmentSummary = {
  assignmentId: 'assign1',
  reportId: 'report1',
  periodId: 'period1',
  reportName: 'HSLN',
  teamName: 'Đội 3',
  periodKey: '2026-10',
  dueAt: '2026-11-05T17:00:00.000Z',
  state: 'SUBMITTED',
};

describe('ReportManagerListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders each assignment as a row linking to its review page', async () => {
    vi.mocked(dynamicReportsApi.listForManager).mockResolvedValue([SAMPLE]);
    renderPage();

    await waitFor(() => screen.getByTestId('assignment-row-assign1'));
    expect(screen.getByTestId('assignment-row-assign1')).toHaveAttribute(
      'href',
      '/bao-cao-dong/duyet/assign1',
    );
    expect(screen.getByText('HSLN — Đội 3')).toBeInTheDocument();
    expect(screen.getByText('Đã nộp')).toBeInTheDocument();
    expect(screen.getByTestId('period-summary-link-period1')).toHaveAttribute(
      'href',
      '/bao-cao-dong/duyet/tong-hop/period1',
    );
  });

  it('shows the empty state when there is nothing to review', async () => {
    vi.mocked(dynamicReportsApi.listForManager).mockResolvedValue([]);
    renderPage();

    await waitFor(() => screen.getByTestId('empty-state'));
  });

  it('shows an error message when the list fails to load', async () => {
    vi.mocked(dynamicReportsApi.listForManager).mockRejectedValue(new Error('network'));
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText('Không tải được danh sách lượt giao — vui lòng thử lại.'),
      ).toBeInTheDocument();
    });
  });
});
