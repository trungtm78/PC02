import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ReportNewVersionPage from '../ReportNewVersionPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { ReportDetailView } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: { getReportDetail: vi.fn(), listTemplateSheets: vi.fn(), getNonWorkingDates: vi.fn() },
}));

const DETAIL = {
  id: 'r1',
  code: 'HSLN',
  name: 'Thống kê',
  description: null,
  status: 'PUBLISHED',
  reportingUnit: 'TEAM',
  effectiveFrom: null,
  configVersion: 1,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  schedule: null,
  roles: [],
  targets: [],
  currentVersion: null,
  versionCount: 0,
  periods: [],
  periodTotal: 0,
} as ReportDetailView;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/bao-cao-dong/thiet-lap/r1/phien-ban/moi']}>
        <Routes>
          <Route path="/bao-cao-dong/thiet-lap/:reportId/phien-ban/moi" element={<ReportNewVersionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportNewVersionPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads the report, then runs the wizard in version mode for it', async () => {
    vi.mocked(dynamicReportsApi.getReportDetail).mockResolvedValue(DETAIL);
    renderPage();
    expect(await screen.findByTestId('wizard-title')).toHaveTextContent('Cập nhật mẫu — Thống kê');
    expect(dynamicReportsApi.getReportDetail).toHaveBeenCalledWith('r1');
  });

  it('shows a loading state first, and an error when the report cannot be loaded', async () => {
    vi.mocked(dynamicReportsApi.getReportDetail).mockRejectedValue(new Error('404'));
    renderPage();
    expect(screen.getByTestId('new-version-loading')).toBeInTheDocument();
    expect(await screen.findByTestId('new-version-error')).toBeInTheDocument();
  });

  it('an archived report is told to be restored first instead of opening a wizard that would be refused at the end', async () => {
    vi.mocked(dynamicReportsApi.getReportDetail).mockResolvedValue({ ...DETAIL, status: 'ARCHIVED' });
    renderPage();
    expect(await screen.findByTestId('new-version-archived')).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-title')).not.toBeInTheDocument();
  });
});
