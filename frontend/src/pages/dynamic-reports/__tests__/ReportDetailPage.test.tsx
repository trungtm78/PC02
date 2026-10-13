import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReportDetailPage from '../ReportDetailPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { ReportDetailView } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    getReportDetail: vi.fn(),
    suspendReportGeneration: vi.fn(),
    resumeReportGeneration: vi.fn(),
    publishDraftReport: vi.fn(),
    archiveReport: vi.fn(),
    unarchiveReport: vi.fn(),
    getReportDeletionImpact: vi.fn(),
    deleteReport: vi.fn(),
    deleteReportWithData: vi.fn(),
    saveVersionFileToDisk: vi.fn(),
  },
}));

const DETAIL: ReportDetailView = {
  id: 'r1',
  code: 'HSLN',
  name: 'Thống kê hình sự',
  description: 'Báo cáo tháng',
  status: 'PUBLISHED',
  reportingUnit: 'TEAM',
  effectiveFrom: '2026-10-01T00:00:00.000Z',
  configVersion: 2,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
  schedule: {
    periodType: 'MONTHLY',
    periodStartDay: 1,
    dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
    openRule: { kind: 'AT_PERIOD_START' },
    shiftNonWorking: false,
    oneTimeDate: null,
    timezone: 'Asia/Ho_Chi_Minh',
    effectiveFrom: '2026-10-01T00:00:00.000Z',
  },
  roles: [{ userId: 'u1', name: 'Nguyễn An', role: 'MANAGER', teamScopeId: null }],
  targets: [{ teamId: 't1', teamCode: 'DOI-1', teamName: 'Đội 1', editors: [{ userId: 'u2', name: 'Lê Bình' }] }],
  currentVersion: {
    versionId: 'v2',
    version: 2,
    status: 'PUBLISHED',
    fileName: 'mau.xlsx',
    selectedSheets: ['Thống kê'],
    dateSystem: '1900',
    publishedAt: '2026-10-01T00:00:00.000Z',
    createdAt: '2026-10-01T00:00:00.000Z',
    fields: [
      {
        sheetKey: 'Thống kê', address: 'C4', fieldKey: 'Thống kê!C4', label: 'Số vụ tiếp nhận', type: 'NUM', format: null,
        aggregate: 'SUM', blankPolicy: 'ZERO', required: true, min: '0', max: null, scale: null, maxLength: null,
        helpText: null, source: 'WEB',
      },
    ],
    rules: [
      { name: 'Giải quyết ≤ tiếp nhận', leftExpr: 'C5', operator: 'LTE', rightExpr: 'C4', severity: 'ERROR', message: 'Quá số tiếp nhận', missingStrategy: null, origin: 'MANUAL' },
    ],
  },
  versionCount: 2,
  periods: [
    { periodId: 'p1', periodKey: '2026-10', status: 'OPEN', startDate: '2026-10-01', endDate: '2026-10-31', opensAt: '2026-10-01T00:00:00.000Z', dueAt: '2026-11-05T10:00:00.000Z', version: 2, teamCount: 3, submittedCount: 1 },
  ],
  periodTotal: 1,
};

function renderPage(detail: ReportDetailView = DETAIL) {
  vi.mocked(dynamicReportsApi.getReportDetail).mockResolvedValue(detail);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/bao-cao-dong/thiet-lap/r1']}>
        <Routes>
          <Route path="/bao-cao-dong/thiet-lap/:reportId" element={<ReportDetailPage />} />
          <Route path="/bao-cao-dong/thiet-lap" element={<div data-testid="list-page" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportDetailPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the whole configuration: schedule in words, managers, teams with their editors, input cells, rules, periods', async () => {
    renderPage();

    expect(await screen.findByTestId('report-name')).toHaveTextContent('Thống kê hình sự');
    expect(screen.getByTestId('schedule-text')).toHaveTextContent('Hằng tháng');
    expect(screen.getByTestId('schedule-text')).toHaveTextContent('5 ngày sau khi kết thúc kỳ lúc 17:00');
    expect(screen.getByTestId('section-roles')).toHaveTextContent('Nguyễn An');
    expect(screen.getByTestId('section-targets')).toHaveTextContent('Đội 1');
    expect(screen.getByTestId('section-targets')).toHaveTextContent('Lê Bình');
    expect(screen.getByTestId('field-table')).toHaveTextContent('Số vụ tiếp nhận');
    expect(screen.getByTestId('field-table')).toHaveTextContent('từ 0');
    expect(screen.getByTestId('rule-list')).toHaveTextContent('Giải quyết ≤ tiếp nhận');
    expect(screen.getByTestId('period-row-2026-10')).toHaveTextContent('1/3');
  });

  it('each recent period links to its summary screen', async () => {
    renderPage();
    const row = await screen.findByTestId('period-row-2026-10');
    expect(row.querySelector('a')).toHaveAttribute('href', '/bao-cao-dong/duyet/tong-hop/p1');
  });

  it('a published report offers "Ngừng phát sinh" and not the way back', async () => {
    renderPage();
    await screen.findByTestId('btn-suspend');
    expect(screen.queryByTestId('btn-resume')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-unarchive')).not.toBeInTheDocument();
  });

  it('a draft says it is only a temporary save and offers "Xuất bản", which asks first and then publishes it', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(dynamicReportsApi.publishDraftReport).mockResolvedValue({ reportId: 'r1', versionId: 'v1', version: 1, status: 'PUBLISHED' });
    renderPage({ ...DETAIL, status: 'DRAFT' });

    expect(await screen.findByTestId('draft-note')).toHaveTextContent('lưu tạm');
    expect(screen.queryByTestId('btn-suspend')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-publish-draft'));

    await waitFor(() => expect(dynamicReportsApi.publishDraftReport).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(dynamicReportsApi.getReportDetail).toHaveBeenCalledTimes(2));
  });

  it('declining the confirmation publishes nothing; a published report has no "Xuất bản"', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage({ ...DETAIL, status: 'DRAFT' });
    fireEvent.click(await screen.findByTestId('btn-publish-draft'));
    expect(dynamicReportsApi.publishDraftReport).not.toHaveBeenCalled();
  });

  it('what the server says is missing is shown as it is (e.g. no manager), and the draft stays a draft', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(dynamicReportsApi.publishDraftReport).mockRejectedValue(new Error('Phải có ít nhất một quản lý trước khi xuất bản.'));
    renderPage({ ...DETAIL, status: 'DRAFT' });
    fireEvent.click(await screen.findByTestId('btn-publish-draft'));
    expect(await screen.findByText(/ít nhất một quản lý/)).toBeInTheDocument();
    expect(screen.getByTestId('btn-publish-draft')).toBeInTheDocument();
  });

  it('a published report does not offer "Xuất bản"', async () => {
    renderPage();
    await screen.findByTestId('btn-suspend');
    expect(screen.queryByTestId('btn-publish-draft')).not.toBeInTheDocument();
    expect(screen.queryByTestId('draft-note')).not.toBeInTheDocument();
  });

  it('a suspended report offers "Tiếp tục phát sinh" and calls the API, then reloads the detail', async () => {
    vi.mocked(dynamicReportsApi.resumeReportGeneration).mockResolvedValue({ status: 'PUBLISHED' });
    renderPage({ ...DETAIL, status: 'SUSPENDED' });

    fireEvent.click(await screen.findByTestId('btn-resume'));

    await waitFor(() => expect(dynamicReportsApi.resumeReportGeneration).toHaveBeenCalledWith('r1'));
    await waitFor(() => expect(dynamicReportsApi.getReportDetail).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('btn-suspend')).not.toBeInTheDocument();
  });

  it('an archived report offers "Khôi phục từ lưu trữ" instead of "Lưu trữ"', async () => {
    vi.mocked(dynamicReportsApi.unarchiveReport).mockResolvedValue({ status: 'SUSPENDED' });
    renderPage({ ...DETAIL, status: 'ARCHIVED' });

    expect(screen.queryByTestId('btn-archive-report')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByTestId('btn-unarchive'));
    await waitFor(() => expect(dynamicReportsApi.unarchiveReport).toHaveBeenCalledWith('r1'));
  });

  it('"Lưu trữ" asks first, and does nothing when declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-archive-report'));
    expect(dynamicReportsApi.archiveReport).not.toHaveBeenCalled();
  });

  it('a refused action shows the server reason on the page', async () => {
    vi.mocked(dynamicReportsApi.resumeReportGeneration).mockRejectedValue(new Error('Không tiếp tục được'));
    renderPage({ ...DETAIL, status: 'SUSPENDED' });

    fireEvent.click(await screen.findByTestId('btn-resume'));

    expect(await screen.findByTestId('action-error')).toBeInTheDocument();
  });

  it('deleting a report nobody touched goes back to the list', async () => {
    vi.mocked(dynamicReportsApi.getReportDeletionImpact).mockResolvedValue({
      reportId: 'r1', code: 'HSLN', name: DETAIL.name, versions: 2, periods: 1, finalizedPeriods: 0,
      assignments: 3, submissionsWithData: 0, revisions: 0, comments: 0, unlocks: 0, hasData: false,
    });
    vi.mocked(dynamicReportsApi.deleteReport).mockResolvedValue({ deleted: true });
    renderPage();

    fireEvent.click(await screen.findByTestId('btn-delete-report'));
    fireEvent.click(await screen.findByTestId('btn-delete'));

    expect(await screen.findByTestId('list-page')).toBeInTheDocument();
    expect(dynamicReportsApi.deleteReport).toHaveBeenCalledWith('r1');
  });

  it('a report with no schedule or template yet still opens, with the empty states', async () => {
    renderPage({ ...DETAIL, schedule: null, currentVersion: null, periods: [], periodTotal: 0, targets: [], roles: [] });
    expect(await screen.findByTestId('section-schedule')).toHaveTextContent('Chưa đặt lịch');
    expect(screen.getByTestId('section-template')).toHaveTextContent('Chưa có mẫu');
    expect(screen.getByTestId('section-periods')).toHaveTextContent('Chưa có kỳ nào');
  });

  it('a report that cannot be loaded says so instead of a blank page', async () => {
    vi.mocked(dynamicReportsApi.getReportDetail).mockRejectedValue(new Error('404'));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/bao-cao-dong/thiet-lap/r1']}>
          <Routes>
            <Route path="/bao-cao-dong/thiet-lap/:reportId" element={<ReportDetailPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/Không tải được báo cáo này/)).toBeInTheDocument();
  });

  it('offers "Cập nhật mẫu" and a download of the current template (to edit in Excel and upload again)', async () => {
    vi.mocked(dynamicReportsApi.saveVersionFileToDisk).mockResolvedValue(undefined);
    renderPage();

    expect(await screen.findByTestId('btn-update-template')).toHaveAttribute('href', '/bao-cao-dong/thiet-lap/r1/phien-ban/moi');
    fireEvent.click(screen.getByTestId('btn-download-template'));
    await waitFor(() => expect(dynamicReportsApi.saveVersionFileToDisk).toHaveBeenCalledWith('r1', 'v2', 'mau.xlsx'));
  });

  it('offers "Sửa cấu hình" for a live report, and not for an archived one', async () => {
    renderPage();
    expect(await screen.findByTestId('btn-edit-config')).toHaveAttribute('href', '/bao-cao-dong/thiet-lap/r1/sua');
  });

  it('offers "Sao chép" (a new report that starts as a copy) when the report has a template', async () => {
    renderPage();
    expect(await screen.findByTestId('btn-copy')).toHaveAttribute('href', '/bao-cao-dong/thiet-lap/r1/sao-chep');
  });

  it('an archived report cannot be given a new template until it is restored', async () => {
    renderPage({ ...DETAIL, status: 'ARCHIVED' });
    await screen.findByTestId('btn-unarchive');
    expect(screen.queryByTestId('btn-update-template')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-edit-config')).not.toBeInTheDocument();
  });
});
