import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReportPeriodSummaryPage from '../ReportPeriodSummaryPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { PeriodSummaryView } from '@/features/dynamic-reports/types';
import { makeGrid } from '@/features/dynamic-reports/grid/__tests__/fixtures';
import { FeatureFlagsContext } from '@/lib/features/featureFlagsContextObject';
import { GRID_FLAG } from '@/features/dynamic-reports/grid/useGridLayout';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    getPeriodSummary: vi.fn(),
    finalizePeriod: vi.fn(),
    reopenPeriod: vi.fn(),
    exportPeriod: vi.fn(),
    downloadExport: vi.fn(),
    getVersionGrid: vi.fn(),
    getPeriodDeletionImpact: vi.fn(),
    deletePeriod: vi.fn(),
    deletePeriodWithData: vi.fn(),
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
          <Route path="/bao-cao-dong/thiet-lap/:reportId" element={<div data-testid="report-detail-stub" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const VIEW: PeriodSummaryView = {
  reportId: 'report1',
  versionId: 'version1',
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
      type: 'NUM',
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
  formulaValues: null,
  formulaSource: 'UNAVAILABLE',
  calcEngineVersion: null,
  serverTime: '2026-06-15T10:00:00.000Z',
};

describe('ReportPeriodSummaryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links to the add-team/exempt-team page (S30)', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('link-period-teams'));
    expect(screen.getByTestId('link-period-teams')).toHaveAttribute(
      'href',
      '/bao-cao-dong/duyet/tong-hop/period1/to',
    );
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

  const UNAPPROVED = {
    isAxiosError: true,
    response: {
      status: 409,
      data: {
        error: {
          code: 'UNAPPROVED_TEAMS',
          message: 'Số chốt chỉ tính 1/3 tổ đã duyệt. Số liệu của các tổ sau KHÔNG nằm trong số chốt: Đội 1 (đã nộp, chưa duyệt).',
        },
      },
    },
  };

  it('when the server says some teams are not approved it shows who is left out; confirming closes with the acknowledgement', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.finalizePeriod)
      .mockRejectedValueOnce(UNAPPROVED)
      .mockResolvedValueOnce({ periodId: 'period1', status: 'FINALIZED', finalizedAt: '2026-06-15T10:00:00.000Z', snapshotId: 's1' });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    fireEvent.click(await screen.findByTestId('btn-finalize'));

    await waitFor(() => expect(dynamicReportsApi.finalizePeriod).toHaveBeenCalledTimes(2));
    expect(dynamicReportsApi.finalizePeriod).toHaveBeenNthCalledWith(1, 'period1');
    expect(dynamicReportsApi.finalizePeriod).toHaveBeenNthCalledWith(2, 'period1', true);
    // The second question carries the server's own words: which team, and why it is not counted.
    expect(confirmSpy.mock.calls[1][0]).toContain('Đội 1 (đã nộp, chưa duyệt)');
    confirmSpy.mockRestore();
  });

  it('declining the second question closes nothing and shows no error', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.finalizePeriod).mockRejectedValueOnce(UNAPPROVED);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(false);
    renderPage();

    fireEvent.click(await screen.findByTestId('btn-finalize'));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(2));
    expect(dynamicReportsApi.finalizePeriod).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('finalize-error')).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('any other refusal (nobody approved yet) is shown as an error and is not offered as "close anyway"', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.finalizePeriod).mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409, data: { error: { code: 'INVALID_STATE_TRANSITION', message: 'Chưa có tổ nào được duyệt — hãy duyệt trước.' } } },
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    fireEvent.click(await screen.findByTestId('btn-finalize'));

    expect(await screen.findByTestId('finalize-error')).toHaveTextContent('Chưa có tổ nào được duyệt');
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it('"Xoá kỳ" opens the impact dialog; deleting an empty period goes back to the report', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.getPeriodDeletionImpact).mockResolvedValue({
      periodId: 'period1', reportId: 'report1', periodKey: '2026-06', status: 'OPEN', assignments: 3,
      submissionsWithData: 0, revisions: 0, comments: 0, unlocks: 0, hasData: false,
    });
    vi.mocked(dynamicReportsApi.deletePeriod).mockResolvedValue({ deleted: true, periodKey: '2026-06' });
    renderPage();

    fireEvent.click(await screen.findByTestId('btn-delete-period-open'));
    fireEvent.click(await screen.findByTestId('btn-delete-period'));

    await waitFor(() => expect(dynamicReportsApi.deletePeriod).toHaveBeenCalledWith('period1'));
    expect(await screen.findByTestId('report-detail-stub')).toBeInTheDocument();
  });

  it('a period with figures offers no plain delete from this screen either', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.getPeriodDeletionImpact).mockResolvedValue({
      periodId: 'period1', reportId: 'report1', periodKey: '2026-06', status: 'OPEN', assignments: 3,
      submissionsWithData: 2, revisions: 5, comments: 0, unlocks: 0, hasData: true,
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('btn-delete-period-open'));
    await screen.findByTestId('period-delete-has-data');
    expect(screen.queryByTestId('btn-delete-period')).not.toBeInTheDocument();
    expect(dynamicReportsApi.deletePeriod).not.toHaveBeenCalled();
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
      format: 'TEMPLATE',
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
    expect(screen.queryByTestId('export-list-note')).not.toBeInTheDocument();
  });

  it('says so when the file had to be the plain list instead of the report template', async () => {
    vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.exportPeriod).mockResolvedValue({
      exportId: 'export1',
      fileName: 'HSLN-2026-06.xlsx',
      format: 'LIST',
    });
    vi.mocked(dynamicReportsApi.downloadExport).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-export'));
    fireEvent.click(screen.getByTestId('btn-export'));

    await waitFor(() => screen.getByTestId('export-list-note'));
    expect(screen.getByTestId('export-list-note')).toHaveTextContent(/dạng danh sách/);
    // The next export starts clean.
    vi.mocked(dynamicReportsApi.exportPeriod).mockRejectedValue(new Error('x'));
    fireEvent.click(screen.getByTestId('btn-export'));
    await waitFor(() => expect(screen.queryByTestId('export-list-note')).not.toBeInTheDocument());
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

  describe('grid layout (G4)', () => {
    const GRID_VIEW: PeriodSummaryView = {
      ...VIEW,
      fields: [{ ...VIEW.fields[0], fieldKey: 'Đội 3!C3', address: 'C3', label: 'Số vụ mới' }],
      formulaValues: { 'Đội 3!C5': { ok: true, type: 'number', value: '777' } },
      formulaSource: 'LIVE',
      calcEngineVersion: 1,
    };

    it('starts as the list, as before: the grid is opt-in until it is the default', async () => {
      vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(GRID_VIEW);
      renderPage();
      await waitFor(() => screen.getByTestId('field-table'));
      expect(screen.queryByTestId('grid-section')).toBeNull();
      expect(screen.getByTestId('layout-list')).toHaveAttribute('aria-pressed', 'true');
      expect(dynamicReportsApi.getVersionGrid).not.toHaveBeenCalled();
    });

    it('shows the template as a grid with the aggregated and official figures, and keeps the mode select', async () => {
      vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(GRID_VIEW);
      vi.mocked(dynamicReportsApi.getVersionGrid).mockResolvedValue(makeGrid());
      renderPage();
      await waitFor(() => screen.getByTestId('layout-grid'));
      fireEvent.click(screen.getByTestId('layout-grid'));

      await waitFor(() => screen.getByTestId('grid-viewer'));
      expect(dynamicReportsApi.getVersionGrid).toHaveBeenCalledWith('version1');
      expect(screen.getByTestId('cell-C3')).toHaveTextContent('30');
      expect(screen.getByTestId('cell-C5')).toHaveTextContent('777');
      expect(screen.queryByTestId('field-table')).toBeNull();
      expect(screen.getByTestId('mode-select')).toBeInTheDocument();
      expect(screen.getByTestId('kpi-cards')).toBeInTheDocument();
    });

    it('lists the teams behind a figure when its cell is opened', async () => {
      vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(GRID_VIEW);
      vi.mocked(dynamicReportsApi.getVersionGrid).mockResolvedValue(makeGrid());
      renderPage();
      await waitFor(() => screen.getByTestId('layout-grid'));
      fireEvent.click(screen.getByTestId('layout-grid'));
      await waitFor(() => screen.getByTestId('grid-viewer'));

      fireEvent.click(screen.getByTestId('cell-C3'));
      expect(screen.getByTestId('contributor-Đội 3')).toHaveTextContent('10');
      expect(screen.getByTestId('contributor-Đội 4')).toHaveTextContent('20');
    });

    it('falls back to the list, with a note, when the grid cannot be built', async () => {
      vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(GRID_VIEW);
      vi.mocked(dynamicReportsApi.getVersionGrid).mockRejectedValue({
        response: { status: 422, data: { code: 'GRID_UNAVAILABLE', message: 'Không dựng được lưới' } },
      });
      renderPage();
      await waitFor(() => screen.getByTestId('layout-grid'));
      fireEvent.click(screen.getByTestId('layout-grid'));

      await waitFor(() => screen.getByTestId('grid-fallback-note'));
      expect(screen.getByTestId('field-table')).toBeInTheDocument();
      expect(screen.getByTestId('layout-grid')).toBeDisabled();
    });
  });

  describe('the grid is the default, with an emergency switch (GA)', () => {
    const wide = (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });

    afterEach(() => {
      Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true, writable: true });
      localStorage.clear();
    });

    function renderWithFlag(enabled: boolean) {
      const flags = new Map([[GRID_FLAG, { key: GRID_FLAG, enabled }]]);
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      return render(
        <FeatureFlagsContext.Provider value={{ flags, isLoading: false } as never}>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/bao-cao-dong/duyet/tong-hop/period1']}>
              <Routes>
                <Route path="/bao-cao-dong/duyet/tong-hop/:periodId" element={<ReportPeriodSummaryPage />} />
              </Routes>
            </MemoryRouter>
          </QueryClientProvider>
        </FeatureFlagsContext.Provider>,
      );
    }

    const GA_VIEW = {
      ...VIEW,
      fields: [{ ...VIEW.fields[0], fieldKey: 'Đội 3!C3', address: 'C3' }],
      formulaValues: {},
      formulaSource: 'LIVE' as const,
      calcEngineVersion: 1,
    };

    it('opens as the grid on a wide screen', async () => {
      Object.defineProperty(window, 'matchMedia', { value: wide, configurable: true, writable: true });
      vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(GA_VIEW);
      vi.mocked(dynamicReportsApi.getVersionGrid).mockResolvedValue(makeGrid());
      renderWithFlag(true);
      await waitFor(() => screen.getByTestId('grid-viewer'));
      expect(screen.getByTestId('layout-grid')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByTestId('field-table')).toBeNull();
    });

    it('with the emergency switch off it is the list, and no way to the grid is offered', async () => {
      Object.defineProperty(window, 'matchMedia', { value: wide, configurable: true, writable: true });
      vi.mocked(dynamicReportsApi.getPeriodSummary).mockResolvedValue(GA_VIEW);
      renderWithFlag(false);
      await waitFor(() => screen.getByTestId('field-table'));
      expect(screen.queryByTestId('layout-grid')).toBeNull();
      expect(dynamicReportsApi.getVersionGrid).not.toHaveBeenCalled();
    });
  });
});
