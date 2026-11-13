import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OfficialFilePanel from '../OfficialFilePanel';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { OfficialFileView } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    listOfficialFiles: vi.fn(),
    remakeOfficialFile: vi.fn(),
    downloadOfficialFile: vi.fn(),
  },
}));

/** The waiting part of "File chính thức": the server makes the file a few seconds after the period is closed. */
const READY: OfficialFileView = {
  id: 'f1',
  status: 'READY',
  fileName: 'HSLN-2026-06.xlsx',
  error: null,
  createdAt: '2026-07-06T03:15:00.000Z',
  endedAt: null,
};

function renderPanel(props: { pollEveryMs?: number; pollForMs?: number } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <OfficialFilePanel periodId="period1" {...props} />
    </QueryClientProvider>,
  );
}

describe('OfficialFilePanel — waiting for the file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('says "Đang tạo file…" while the list is empty and asks again by itself until the file is there', async () => {
    vi.mocked(dynamicReportsApi.listOfficialFiles)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue([READY]);
    renderPanel({ pollEveryMs: 15, pollForMs: 5_000 });

    expect(await screen.findByTestId('official-file-making')).toHaveTextContent('Đang tạo file…');
    expect(screen.queryByTestId('official-file-none')).not.toBeInTheDocument();

    expect(await screen.findByTestId('btn-official-file-download-f1')).toBeInTheDocument();
    expect(screen.queryByTestId('official-file-making')).not.toBeInTheDocument();

    // Once the file is there the asking stops.
    const calls = vi.mocked(dynamicReportsApi.listOfficialFiles).mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(vi.mocked(dynamicReportsApi.listOfficialFiles).mock.calls.length).toBe(calls);
  });

  it('a void file from before a reopening does not count as the file of this closing: still waiting', async () => {
    vi.mocked(dynamicReportsApi.listOfficialFiles).mockResolvedValue([{ ...READY, id: 'f0', status: 'VOID' }]);
    renderPanel({ pollEveryMs: 15, pollForMs: 5_000 });

    expect(await screen.findByTestId('official-file-making')).toBeInTheDocument();
    expect(screen.getByTestId('official-file-status-f0')).toHaveTextContent('Đã vô hiệu vì kỳ được mở lại');
    await waitFor(() => expect(vi.mocked(dynamicReportsApi.listOfficialFiles).mock.calls.length).toBeGreaterThan(1));
  });

  it('stops asking after the waiting time and offers to make the file instead of spinning for ever', async () => {
    vi.mocked(dynamicReportsApi.listOfficialFiles).mockResolvedValue([]);
    vi.mocked(dynamicReportsApi.remakeOfficialFile).mockResolvedValue(READY);
    renderPanel({ pollEveryMs: 15, pollForMs: 60 });

    expect(await screen.findByTestId('official-file-none')).toHaveTextContent('Kỳ này chưa có file chính thức');
    expect(screen.queryByTestId('official-file-making')).not.toBeInTheDocument();
    const calls = vi.mocked(dynamicReportsApi.listOfficialFiles).mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(vi.mocked(dynamicReportsApi.listOfficialFiles).mock.calls.length).toBe(calls);

    vi.mocked(dynamicReportsApi.listOfficialFiles).mockResolvedValue([READY]);
    fireEvent.click(screen.getByTestId('btn-official-file-make'));
    await waitFor(() => expect(dynamicReportsApi.remakeOfficialFile).toHaveBeenCalledWith('period1'));
    expect(await screen.findByTestId('official-file-row-f1')).toBeInTheDocument();
  });

  it('a list that fails while waiting shows the error and does not keep asking behind it', async () => {
    vi.mocked(dynamicReportsApi.listOfficialFiles).mockRejectedValue(new Error('500'));
    renderPanel({ pollEveryMs: 15, pollForMs: 5_000 });

    expect(await screen.findByTestId('official-file-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('official-file-making')).not.toBeInTheDocument();
    const calls = vi.mocked(dynamicReportsApi.listOfficialFiles).mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(vi.mocked(dynamicReportsApi.listOfficialFiles).mock.calls.length).toBe(calls);
  });
});
