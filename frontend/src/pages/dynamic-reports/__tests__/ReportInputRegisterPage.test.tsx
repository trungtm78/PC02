import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ReportInputRegisterPage from '../ReportInputRegisterPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { AssignmentSummary } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: { listMySubmissions: vi.fn() },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ReportInputRegisterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const SAMPLE: AssignmentSummary = {
  assignmentId: 'assign1',
  reportName: 'HSLN',
  teamName: 'Đội 3',
  periodKey: '2026-10',
  dueAt: '2026-11-05T17:00:00.000Z',
  state: 'DRAFT',
};

describe('ReportInputRegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders each assignment as a row linking to its input page', async () => {
    vi.mocked(dynamicReportsApi.listMySubmissions).mockResolvedValue([SAMPLE]);
    renderPage();

    await waitFor(() => screen.getByTestId('assignment-row-assign1'));
    expect(screen.getByTestId('assignment-row-assign1')).toHaveAttribute(
      'href',
      '/bao-cao-dong/nhap/assign1',
    );
    expect(screen.getByText('HSLN — Đội 3')).toBeInTheDocument();
    expect(screen.getByText('Đang nhập')).toBeInTheDocument();
  });

  it('shows the empty state when there are no open assignments', async () => {
    vi.mocked(dynamicReportsApi.listMySubmissions).mockResolvedValue([]);
    renderPage();

    await waitFor(() => screen.getByTestId('empty-state'));
  });

  it('shows an error message when the list fails to load', async () => {
    vi.mocked(dynamicReportsApi.listMySubmissions).mockRejectedValue(new Error('network'));
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText('Không tải được danh sách lượt giao — vui lòng thử lại.'),
      ).toBeInTheDocument();
    });
  });
});
