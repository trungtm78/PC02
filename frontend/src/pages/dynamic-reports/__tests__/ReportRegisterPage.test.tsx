import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ReportRegisterPage from '../ReportRegisterPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { ReportSetupSummary } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    listForSetup: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ReportRegisterPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const SAMPLE: ReportSetupSummary = {
  id: 'r1',
  code: 'HSLN',
  name: 'Thống kê hình sự liên ngành',
  status: 'PUBLISHED',
  reportingUnit: 'TEAM',
  effectiveFrom: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
  periodType: 'MONTHLY',
  nextDueAt: '2026-07-05T10:00:00.000Z',
  managers: ['Nguyễn Văn A', 'Trần Thị B'],
  teamCount: 16,
  latestVersion: 2,
};

describe('ReportRegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a report row with every S01 column (mã, tên, loại kỳ, hạn, quản lý, số tổ, phiên bản, trạng thái)', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([SAMPLE]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('HSLN')).toBeInTheDocument();
    });
    expect(screen.getByText('Thống kê hình sự liên ngành')).toBeInTheDocument();
    expect(screen.getByText('Hằng tháng')).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn A, Trần Thị B')).toBeInTheDocument();
    expect(screen.getByText('16')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Đã xuất bản')).toBeInTheDocument();
  });

  it('shows "Chưa đặt lịch" when a report has no schedule configured yet', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([
      { ...SAMPLE, periodType: null, nextDueAt: null, managers: [], teamCount: 0, latestVersion: null },
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Chưa đặt lịch')).toBeInTheDocument();
    });
  });

  it('shows the empty state when there are no reports yet', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Chưa có báo cáo nào')).toBeInTheDocument();
    });
  });

  it('shows an error message when the list fails to load', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockRejectedValue(new Error('network'));

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText('Không tải được danh sách báo cáo — vui lòng thử lại.'),
      ).toBeInTheDocument();
    });
  });

  it('"Tạo báo cáo" links to the upload step (PR4 slice 3), not a coming-soon note', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([]);

    renderPage();
    await waitFor(() => screen.getByTestId('btn-create-report'));

    expect(screen.getByTestId('btn-create-report')).toHaveAttribute(
      'href',
      '/bao-cao-dong/thiet-lap/moi',
    );
  });

  it('clicking "Xem" on a row shows the same coming-soon note', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([SAMPLE]);

    renderPage();
    await waitFor(() => screen.getByTestId('btn-view-HSLN'));
    fireEvent.click(screen.getByTestId('btn-view-HSLN'));

    expect(screen.getByTestId('action-note')).toHaveTextContent('đang được phát triển');
  });
});
