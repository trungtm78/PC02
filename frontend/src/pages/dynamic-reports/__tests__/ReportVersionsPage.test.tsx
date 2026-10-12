import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReportVersionsPage from '../ReportVersionsPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { VersionListItem } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: { listVersions: vi.fn(), deleteReportVersion: vi.fn(), saveVersionFileToDisk: vi.fn() },
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

  describe('edit and delete (created => editable and deletable)', () => {
    const WITH_DRAFT: VersionListItem[] = [
      { versionId: 'ver3', version: 3, status: 'DRAFT', publishedAt: null, createdAt: '2026-07-01T00:00:00.000Z', periodKeys: [] },
      ...VERSIONS,
    ];

    it('"Cập nhật mẫu" starts a new version of this report', async () => {
      vi.mocked(dynamicReportsApi.listVersions).mockResolvedValue(VERSIONS);
      renderPage();
      await waitFor(() => screen.getByTestId('versions-table'));
      expect(screen.getByTestId('btn-new-version')).toHaveAttribute('href', '/bao-cao-dong/thiet-lap/report1/phien-ban/moi');
    });

    it('every version can be saved to disk (to edit in Excel and upload again)', async () => {
      vi.mocked(dynamicReportsApi.listVersions).mockResolvedValue(VERSIONS);
      vi.mocked(dynamicReportsApi.saveVersionFileToDisk).mockResolvedValue(undefined);
      renderPage();
      await waitFor(() => screen.getByTestId('btn-download-version-2'));
      fireEvent.click(screen.getByTestId('btn-download-version-2'));
      await waitFor(() => expect(dynamicReportsApi.saveVersionFileToDisk).toHaveBeenCalledWith('report1', 'ver2', 'mau-v2.xlsx'));
    });

    it('only a version nobody depends on can be deleted: a draft yes; the current one and a used one never', async () => {
      vi.mocked(dynamicReportsApi.listVersions).mockResolvedValue(WITH_DRAFT);
      renderPage();
      await waitFor(() => screen.getByTestId('versions-table'));

      expect(screen.getByTestId('btn-delete-version-3')).toBeInTheDocument();
      expect(screen.queryByTestId('btn-delete-version-2')).not.toBeInTheDocument(); // published
      expect(screen.queryByTestId('btn-delete-version-1')).not.toBeInTheDocument(); // retired but periods use it
    });

    it('deleting asks first, calls the API and reloads the list', async () => {
      vi.mocked(dynamicReportsApi.listVersions).mockResolvedValue(WITH_DRAFT);
      vi.mocked(dynamicReportsApi.deleteReportVersion).mockResolvedValue({ deleted: true });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderPage();
      await waitFor(() => screen.getByTestId('btn-delete-version-3'));

      fireEvent.click(screen.getByTestId('btn-delete-version-3'));

      await waitFor(() => expect(dynamicReportsApi.deleteReportVersion).toHaveBeenCalledWith('report1', 'ver3'));
      await waitFor(() => expect(dynamicReportsApi.listVersions).toHaveBeenCalledTimes(2));
    });

    it('declining the confirmation deletes nothing; a server refusal is shown', async () => {
      vi.mocked(dynamicReportsApi.listVersions).mockResolvedValue(WITH_DRAFT);
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false);
      renderPage();
      await waitFor(() => screen.getByTestId('btn-delete-version-3'));
      fireEvent.click(screen.getByTestId('btn-delete-version-3'));
      expect(dynamicReportsApi.deleteReportVersion).not.toHaveBeenCalled();

      confirm.mockReturnValueOnce(true);
      vi.mocked(dynamicReportsApi.deleteReportVersion).mockRejectedValue(new Error('Đang được kỳ dùng'));
      fireEvent.click(screen.getByTestId('btn-delete-version-3'));
      expect(await screen.findByTestId('version-delete-error')).toBeInTheDocument();
    });
  });
});
