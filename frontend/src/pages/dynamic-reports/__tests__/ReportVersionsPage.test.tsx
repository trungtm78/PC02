import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReportVersionsPage from '../ReportVersionsPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { VersionListItem } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: { listVersions: vi.fn() },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/bao-cao-dong/thiet-lap/report1/phien-ban']}>
        <Routes>
          <Route
            path="/bao-cao-dong/thiet-lap/:reportId/phien-ban"
            element={<ReportVersionsPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const VERSIONS: VersionListItem[] = [
  {
    versionId: 'ver2',
    version: 2,
    status: 'PUBLISHED',
    publishedAt: '2026-06-01T00:00:00.000Z',
    createdAt: '2026-05-20T00:00:00.000Z',
    periodKeys: ['2026-06', '2026-07'],
  },
  {
    versionId: 'ver1',
    version: 1,
    status: 'RETIRED',
    publishedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2025-12-20T00:00:00.000Z',
    periodKeys: ['2026-01', '2026-02'],
  },
];

describe('ReportVersionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls listVersions with the reportId from the URL', async () => {
    vi.mocked(dynamicReportsApi.listVersions).mockResolvedValue(VERSIONS);
    renderPage();

    await waitFor(() => {
      expect(dynamicReportsApi.listVersions).toHaveBeenCalledWith('report1');
    });
  });

  it('renders every version with its status, dates and period keys', async () => {
    vi.mocked(dynamicReportsApi.listVersions).mockResolvedValue(VERSIONS);
    renderPage();

    await waitFor(() => screen.getByTestId('version-row-2'));
    expect(screen.getByTestId('version-row-2')).toHaveTextContent('v2');
    expect(screen.getByTestId('version-row-2')).toHaveTextContent('Đã xuất bản');
    expect(screen.getByTestId('version-row-2')).toHaveTextContent('2026-06, 2026-07');

    expect(screen.getByTestId('version-row-1')).toHaveTextContent('v1');
    expect(screen.getByTestId('version-row-1')).toHaveTextContent('Đã thay thế');
  });

  it('shows the empty state when the report has no versions yet', async () => {
    vi.mocked(dynamicReportsApi.listVersions).mockResolvedValue([]);
    renderPage();

    await waitFor(() => screen.getByTestId('versions-empty'));
  });

  it('shows an error message when the request fails', async () => {
    vi.mocked(dynamicReportsApi.listVersions).mockRejectedValue(new Error('network'));
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText('Không tải được danh sách phiên bản — vui lòng thử lại.'),
      ).toBeInTheDocument();
    });
  });

  it('a DRAFT version with no periods shows "—" instead of an empty cell', async () => {
    vi.mocked(dynamicReportsApi.listVersions).mockResolvedValue([
      {
        versionId: 'ver3',
        version: 3,
        status: 'DRAFT',
        publishedAt: null,
        createdAt: '2026-07-01T00:00:00.000Z',
        periodKeys: [],
      },
    ]);
    renderPage();

    await waitFor(() => screen.getByTestId('version-row-3'));
    expect(screen.getByTestId('version-row-3')).toHaveTextContent('Bản nháp');
    expect(screen.getByTestId('version-row-3')).toHaveTextContent('—');
  });
});
