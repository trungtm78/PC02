import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReportPeriodSummaryPage from '../ReportPeriodSummaryPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { PeriodSummaryView } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: { getPeriodSummary: vi.fn() },
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
});
