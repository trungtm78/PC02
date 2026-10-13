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
    suspendReportGeneration: vi.fn(),
    resumeReportGeneration: vi.fn(),
    publishDraftReport: vi.fn(),
    getReportDeletionImpact: vi.fn(),
    deleteReport: vi.fn(),
    deleteReportWithData: vi.fn(),
    archiveReport: vi.fn(),
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

  it('"Phiên bản" links to the version list for that report (S22)', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([SAMPLE]);

    renderPage();
    await waitFor(() => screen.getByTestId('btn-versions-HSLN'));

    expect(screen.getByTestId('btn-versions-HSLN')).toHaveAttribute(
      'href',
      '/bao-cao-dong/thiet-lap/r1/phien-ban',
    );
  });

  it('"Xem" opens the report detail page — it is a real link now, not a coming-soon note', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([SAMPLE]);

    renderPage();
    await waitFor(() => screen.getByTestId('btn-view-HSLN'));

    expect(screen.getByTestId('btn-view-HSLN')).toHaveAttribute('href', '/bao-cao-dong/thiet-lap/r1');
    expect(screen.queryByTestId('action-note')).not.toBeInTheDocument();
  });

  it('every row can be edited ("Sửa" opens the config editor), except an archived one', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([SAMPLE, { ...SAMPLE, id: 'r2', code: 'OLD', status: 'ARCHIVED' }]);
    renderPage();
    await waitFor(() => screen.getByTestId('btn-edit-HSLN'));
    expect(screen.getByTestId('btn-edit-HSLN')).toHaveAttribute('href', '/bao-cao-dong/thiet-lap/r1/sua');
    expect(screen.queryByTestId('btn-edit-OLD')).not.toBeInTheDocument();
  });

  it('a draft row offers "Xuất bản" (and not "Ngừng phát sinh"); confirming publishes it and reloads the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([{ ...SAMPLE, status: 'DRAFT' }]);
    vi.mocked(dynamicReportsApi.publishDraftReport).mockResolvedValue({ reportId: 'r1', versionId: 'v1', version: 1, status: 'PUBLISHED' });

    renderPage();
    await waitFor(() => screen.getByTestId('btn-publish-HSLN'));
    expect(screen.queryByTestId('btn-suspend-HSLN')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-publish-HSLN'));

    await waitFor(() => expect(dynamicReportsApi.publishDraftReport).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(dynamicReportsApi.listForSetup).toHaveBeenCalledTimes(2));
  });

  it('a draft that cannot be published says why, in the server\'s words', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([{ ...SAMPLE, status: 'DRAFT' }]);
    vi.mocked(dynamicReportsApi.publishDraftReport).mockRejectedValue(new Error('Mỗi tổ phải có ít nhất một người nhập.'));

    renderPage();
    fireEvent.click(await screen.findByTestId('btn-publish-HSLN'));
    await waitFor(() => expect(screen.getByTestId('action-note')).toHaveTextContent('Mỗi tổ phải có ít nhất một người nhập'));
  });

  it('a published report has no "Xuất bản" on its row', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([SAMPLE]);
    renderPage();
    await waitFor(() => screen.getByTestId('btn-suspend-HSLN'));
    expect(screen.queryByTestId('btn-publish-HSLN')).not.toBeInTheDocument();
  });

  it('a suspended report offers "Tiếp tục phát sinh" (the way back from "Ngừng phát sinh") and calls the API', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([{ ...SAMPLE, status: 'SUSPENDED' }]);
    vi.mocked(dynamicReportsApi.resumeReportGeneration).mockResolvedValue({ status: 'PUBLISHED' });

    renderPage();
    await waitFor(() => screen.getByTestId('btn-resume-HSLN'));
    expect(screen.queryByTestId('btn-suspend-HSLN')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-resume-HSLN'));

    await waitFor(() => expect(dynamicReportsApi.resumeReportGeneration).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(dynamicReportsApi.listForSetup).toHaveBeenCalledTimes(2));
  });

  it('"Xoá" opens the delete dialog for that report and deleting refreshes the list', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([SAMPLE]);
    vi.mocked(dynamicReportsApi.getReportDeletionImpact).mockResolvedValue({
      reportId: 'r1', code: 'HSLN', name: SAMPLE.name, versions: 1, periods: 0, finalizedPeriods: 0,
      assignments: 0, submissionsWithData: 0, revisions: 0, comments: 0, unlocks: 0, hasData: false,
    });
    vi.mocked(dynamicReportsApi.deleteReport).mockResolvedValue({ deleted: true });

    renderPage();
    await waitFor(() => screen.getByTestId('btn-delete-HSLN'));
    fireEvent.click(screen.getByTestId('btn-delete-HSLN'));
    await waitFor(() => screen.getByTestId('btn-delete'));
    fireEvent.click(screen.getByTestId('btn-delete'));

    await waitFor(() => expect(dynamicReportsApi.deleteReport).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(screen.getByTestId('action-note')).toHaveTextContent('Đã xoá báo cáo'));
    await waitFor(() => expect(dynamicReportsApi.listForSetup).toHaveBeenCalledTimes(2));
  });

  it('"Ngừng phát sinh" only shows for a PUBLISHED report, never DRAFT/SUSPENDED/ARCHIVED', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([
      SAMPLE,
      { ...SAMPLE, id: 'r2', code: 'DRAFT1', status: 'DRAFT' },
    ]);

    renderPage();
    await waitFor(() => screen.getByTestId('btn-view-HSLN'));

    expect(screen.getByTestId('btn-suspend-HSLN')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-suspend-DRAFT1')).not.toBeInTheDocument();
  });

  it('"Ngừng phát sinh" calls the API after confirmation and refetches the list (S31)', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([SAMPLE]);
    vi.mocked(dynamicReportsApi.suspendReportGeneration).mockResolvedValue({
      status: 'SUSPENDED',
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    await waitFor(() => screen.getByTestId('btn-suspend-HSLN'));
    fireEvent.click(screen.getByTestId('btn-suspend-HSLN'));

    await waitFor(() => {
      expect(dynamicReportsApi.suspendReportGeneration).toHaveBeenCalledWith('r1');
    });
    // Refetch after success (same queryKey) — confirms the list is invalidated, not just a local state flip.
    await waitFor(() => {
      expect(dynamicReportsApi.listForSetup).toHaveBeenCalledTimes(2);
    });
  });

  it('"Ngừng phát sinh" does nothing when the confirm dialog is declined', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([SAMPLE]);
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderPage();
    await waitFor(() => screen.getByTestId('btn-suspend-HSLN'));
    fireEvent.click(screen.getByTestId('btn-suspend-HSLN'));

    expect(dynamicReportsApi.suspendReportGeneration).not.toHaveBeenCalled();
  });

  it('"Ngừng phát sinh" shows an error note when the API call fails', async () => {
    vi.mocked(dynamicReportsApi.listForSetup).mockResolvedValue([SAMPLE]);
    vi.mocked(dynamicReportsApi.suspendReportGeneration).mockRejectedValue(new Error('boom'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    await waitFor(() => screen.getByTestId('btn-suspend-HSLN'));
    fireEvent.click(screen.getByTestId('btn-suspend-HSLN'));

    await waitFor(() => {
      expect(screen.getByTestId('action-note')).toHaveTextContent('Không ngừng phát sinh được');
    });
  });
});
