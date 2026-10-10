import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReportPeriodSummaryPage from '../ReportPeriodSummaryPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { PeriodSummaryView } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    getPeriodSummary: vi.fn(),
    finalizePeriod: vi.fn(),
    reopenPeriod: vi.fn(),
    exportPeriod: vi.fn(),
    downloadExport: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/bao-cao-dong/duyet/tong-hop/period1']}>
        <Routes>
          <Route
            path="/bao-cao-dong/duyet/tong-hop/:periodId"
            element={<ReportPeriodSummaryPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const VIEW: PeriodSummaryView = {
  reportId: 'report1',
  reportName: 'HSLN',
  periodId: 'period1',
  periodKey: '2026-06',
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  dueAt: '2026-07-05T17:00:00.000Z',
  status: 'OPEN',
  mode: 'SUBMITTED',
  kpi: {
    requiredCount: 3,
    exemptCount: 1,
    completedCount: 2,
    notStartedCount: 0,
    inProgressCount: 1,
    overdueNotDoneCount: 0,
    reopenedCount: 0,
    completionRateLabel: '2/3',
    onTimeRateLabel: '— / Không có lượt được giao',
    dataCoverageLabel: '3/3',
  },
  fields: [
    {
      fieldKey: 'Đội 3!C6',
      sheetKey: 'Đội 3',
      address: 'C6',
      label: 'Số vụ mới',
      value: '30',
      displayNotAggregated: false,
      countTotal: 2,
      countNonBlank: 2,
      contributors: [
        { teamName: 'Đội 3', value: '10', state: 'SUBMITTED', revision: '2', updatedAt: '2026-06-10T08:00:00.000Z' },
        { teamName: 'Đội 4', value: '20', state: 'APPROVED', revision: '3', updatedAt: '2026-06-11T08:00:00.000Z' },
      ],
    },
  ],
  serverTime: '2026-06-15T10:00:00.000Z',
};

describe('ReportPeriodSummaryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links to the whole-period history page', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('link-report-history'));
    expect(screen.getByTestId('link-report-history')).toHaveAttribute(
      'href',
      '/bao-cao-dong/duyet/tong-hop/period1/lich-su',
    );
  });

  it('renders the KPI cards and the field aggregate table', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('kpi-completed'));
    expect(screen.getByTestId('kpi-completed')).toHaveTextContent('2/3');
    expect(screen.getByTestId('kpi-coverage')).toHaveTextContent('3/3');
    expect(screen.getByTestId('field-row-Đội 3!C6')).toHaveTextContent('30');
    expect(dynamicReportsApi.getPeriodSummary).toHaveBeenCalledWith('period1', 'SUBMITTED');
  });

  it('refetches with the new mode when the mode select changes', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('mode-select'));
    fireEvent.change(screen.getByTestId('mode-select'), { target: { value: 'APPROVED' } });

    await waitFor(() => {
      expect(dynamicReportsApi.getPeriodSummary).toHaveBeenCalledWith('period1', 'APPROVED');
    });
  });

  it('shows the "Tạm tính" badge only in ALL_SAVED mode', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('mode-select'));
    expect(screen.queryByTestId('tam-tinh-badge')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('mode-select'), { target: { value: 'ALL_SAVED' } });

    await waitFor(() => screen.getByTestId('tam-tinh-badge'));
  });

  it('shows "— / Không tổng hợp" for a NONE-aggregate field instead of a value', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue({
      ...VIEW,
      fields: [{ ...VIEW.fields[0], value: null, displayNotAggregated: true }],
    });
    renderPage();

    await waitFor(() => screen.getByTestId('field-row-Đội 3!C6'));
    expect(screen.getByTestId('field-row-Đội 3!C6')).toHaveTextContent('Không tổng hợp');
  });

  it('expands the contributor drill-down on click, showing every team behind the aggregate', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('field-row-Đội 3!C6'));
    expect(screen.queryByTestId('contributors-Đội 3!C6')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('field-row-Đội 3!C6'));

    await waitFor(() => screen.getByTestId('contributors-Đội 3!C6'));
    expect(screen.getByTestId('contributor-Đội 3!C6-Đội 3')).toHaveTextContent('10');
    expect(screen.getByTestId('contributor-Đội 3!C6-Đội 4')).toHaveTextContent('20');
  });

  it('collapses the drill-down on a second click', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('field-row-Đội 3!C6'));
    fireEvent.click(screen.getByTestId('field-row-Đội 3!C6'));
    await waitFor(() => screen.getByTestId('contributors-Đội 3!C6'));

    fireEvent.click(screen.getByTestId('field-row-Đội 3!C6'));
    expect(screen.queryByTestId('contributors-Đội 3!C6')).not.toBeInTheDocument();
  });

  it('shows an empty-contributors note when no team currently matches the chosen mode', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue({
      ...VIEW,
      fields: [{ ...VIEW.fields[0], contributors: [] }],
    });
    renderPage();

    await waitFor(() => screen.getByTestId('field-row-Đội 3!C6'));
    fireEvent.click(screen.getByTestId('field-row-Đội 3!C6'));

    await waitFor(() => screen.getByTestId('contributors-Đội 3!C6'));
    expect(screen.getByTestId('contributors-Đội 3!C6')).toHaveTextContent('Chưa có tổ nào đóng góp');
  });

  it('shows "Chốt kỳ" for an OPEN period and finalizes after confirmation', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.finalizePeriod).mockResolvedValue({
      periodId: 'period1',
      status: 'FINALIZED',
      finalizedAt: '2026-06-15T10:00:00.000Z',
      snapshotId: 'snapshot1',
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-finalize'));
    expect(screen.queryByTestId('finalized-badge')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-finalize'));

    await waitFor(() => {
      expect(dynamicReportsApi.finalizePeriod).toHaveBeenCalledWith('period1');
    });
    confirmSpy.mockRestore();
  });

  it('does not finalize when the confirmation dialog is declined', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-finalize'));
    fireEvent.click(screen.getByTestId('btn-finalize'));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(dynamicReportsApi.finalizePeriod).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('shows "Đã chốt" + "Mở chốt" for a FINALIZED period and reopens after a prompted reason', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue({
      ...VIEW,
      status: 'FINALIZED',
    });
    vi.mocked(dynamicReportsApi.reopenPeriod).mockResolvedValue({
      periodId: 'period1',
      status: 'OPEN',
    });
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Sai số liệu');
    renderPage();

    await waitFor(() => screen.getByTestId('finalized-badge'));
    expect(screen.queryByTestId('btn-finalize')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-reopen'));

    await waitFor(() => {
      expect(dynamicReportsApi.reopenPeriod).toHaveBeenCalledWith('period1', 'Sai số liệu');
    });
    promptSpy.mockRestore();
  });

  it('does not reopen when the reason prompt is cancelled', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue({
      ...VIEW,
      status: 'FINALIZED',
    });
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-reopen'));
    fireEvent.click(screen.getByTestId('btn-reopen'));

    await waitFor(() => expect(promptSpy).toHaveBeenCalled());
    expect(dynamicReportsApi.reopenPeriod).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('shows an error message when finalize fails (e.g. 404 — not a manager of this report)', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.finalizePeriod).mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { error: { message: 'Không tìm thấy kỳ báo cáo này.' } } },
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-finalize'));
    fireEvent.click(screen.getByTestId('btn-finalize'));

    await waitFor(() => screen.getByTestId('finalize-error'));
    confirmSpy.mockRestore();
  });

  it('exports then downloads with the exportId/fileName the server returned', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.exportPeriod).mockResolvedValue({
      exportId: 'export1',
      fileName: 'HSLN-2026-06.xlsx',
    });
    vi.mocked(dynamicReportsApi.downloadExport).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-export'));
    fireEvent.click(screen.getByTestId('btn-export'));

    await waitFor(() => {
      expect(dynamicReportsApi.exportPeriod).toHaveBeenCalledWith('period1');
      expect(dynamicReportsApi.downloadExport).toHaveBeenCalledWith('export1', 'HSLN-2026-06.xlsx');
    });
    expect(screen.queryByTestId('export-error')).not.toBeInTheDocument();
  });

  it('shows an error message when export fails (e.g. scope changed / expired on download)', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.exportPeriod).mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { error: { message: 'Phạm vi dữ liệu đã thay đổi, vui lòng xuất lại.' } } },
    });
    renderPage();

    await waitFor(() => screen.getByTestId('btn-export'));
    fireEvent.click(screen.getByTestId('btn-export'));

    await waitFor(() => screen.getByTestId('export-error'));
    expect(screen.getByTestId('export-error')).toHaveTextContent('Phạm vi dữ liệu đã thay đổi');
  });
});
