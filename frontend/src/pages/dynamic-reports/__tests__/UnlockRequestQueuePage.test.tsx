import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import UnlockRequestQueuePage from '../UnlockRequestQueuePage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { AssignmentSummary, UnlockRequestView } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    listUnlockRequests: vi.fn(),
    listForManager: vi.fn(),
    decideUnlockRequest: vi.fn(),
    bulkGrantUnlock: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UnlockRequestQueuePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const REQUEST: UnlockRequestView = {
  id: 'req1',
  assignmentId: 'assign1',
  reportName: 'HSLN',
  periodKey: '2026-10',
  teamName: 'Đội 3',
  reason: 'Nhập nhầm số',
  requestedAt: '2026-10-10T10:00:00.000Z',
  requestedByName: 'Văn Nguyễn',
};

const OVERDUE: AssignmentSummary = {
  assignmentId: 'assign2',
  reportId: 'report1',
  periodId: 'period1',
  reportName: 'HSLN',
  teamName: 'Đội 4',
  periodKey: '2026-10',
  dueAt: '2000-01-01T00:00:00.000Z',
  state: 'NOT_STARTED',
};

describe('UnlockRequestQueuePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dynamicReportsApi.listForManager).mockResolvedValue([]);
  });

  it('renders the pending queue with approve/reject buttons', async () => {
    vi.mocked(dynamicReportsApi.listUnlockRequests).mockResolvedValue([REQUEST]);
    renderPage();

    await waitFor(() => screen.getByTestId('unlock-request-row-req1'));
    expect(screen.getByText('HSLN — Đội 3 (Kỳ 2026-10)')).toBeInTheDocument();
    expect(screen.getByTestId('btn-approve-req1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-reject-req1')).toBeInTheDocument();
  });

  it('shows the empty state when the queue is empty', async () => {
    vi.mocked(dynamicReportsApi.listUnlockRequests).mockResolvedValue([]);
    renderPage();

    await waitFor(() => screen.getByTestId('queue-empty-state'));
  });

  it('approves a request with no prompt needed', async () => {
    vi.mocked(dynamicReportsApi.listUnlockRequests).mockResolvedValue([REQUEST]);
    vi.mocked(dynamicReportsApi.decideUnlockRequest).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-approve-req1'));
    fireEvent.click(screen.getByTestId('btn-approve-req1'));

    await waitFor(() => {
      expect(dynamicReportsApi.decideUnlockRequest).toHaveBeenCalledWith('req1', 'APPROVE');
    });
  });

  it('rejects a request with the prompted reason', async () => {
    vi.mocked(dynamicReportsApi.listUnlockRequests).mockResolvedValue([REQUEST]);
    vi.mocked(dynamicReportsApi.decideUnlockRequest).mockResolvedValue(undefined);
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Không hợp lệ');
    renderPage();

    await waitFor(() => screen.getByTestId('btn-reject-req1'));
    fireEvent.click(screen.getByTestId('btn-reject-req1'));

    await waitFor(() => {
      expect(dynamicReportsApi.decideUnlockRequest).toHaveBeenCalledWith(
        'req1',
        'REJECT',
        'Không hợp lệ',
      );
    });
    promptSpy.mockRestore();
  });

  it('does not reject when the reason prompt is cancelled', async () => {
    vi.mocked(dynamicReportsApi.listUnlockRequests).mockResolvedValue([REQUEST]);
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-reject-req1'));
    fireEvent.click(screen.getByTestId('btn-reject-req1'));

    await waitFor(() => expect(promptSpy).toHaveBeenCalled());
    expect(dynamicReportsApi.decideUnlockRequest).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('shows the empty state for bulk-grant when nothing is overdue', async () => {
    vi.mocked(dynamicReportsApi.listUnlockRequests).mockResolvedValue([]);
    vi.mocked(dynamicReportsApi.listForManager).mockResolvedValue([]);
    renderPage();

    await waitFor(() => screen.getByTestId('bulk-grant-empty-state'));
  });

  it('lists only still-overdue, not-yet-submitted assignments for bulk grant', async () => {
    vi.mocked(dynamicReportsApi.listUnlockRequests).mockResolvedValue([]);
    vi.mocked(dynamicReportsApi.listForManager).mockResolvedValue([
      OVERDUE,
      { ...OVERDUE, assignmentId: 'assign3', state: 'SUBMITTED' }, // already submitted, excluded
      { ...OVERDUE, assignmentId: 'assign4', dueAt: '2099-01-01T00:00:00.000Z' }, // not yet due, excluded
    ]);
    renderPage();

    await waitFor(() => screen.getByTestId('bulk-grant-checkbox-assign2'));
    expect(screen.queryByTestId('bulk-grant-checkbox-assign3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('bulk-grant-checkbox-assign4')).not.toBeInTheDocument();
  });

  it('bulk-grants unlock to the selected assignments with the prompted reason', async () => {
    vi.mocked(dynamicReportsApi.listUnlockRequests).mockResolvedValue([]);
    vi.mocked(dynamicReportsApi.listForManager).mockResolvedValue([OVERDUE]);
    vi.mocked(dynamicReportsApi.bulkGrantUnlock).mockResolvedValue({
      granted: ['assign2'],
      skipped: [],
    });
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Quá hạn chung');
    renderPage();

    await waitFor(() => screen.getByTestId('bulk-grant-checkbox-assign2'));
    fireEvent.click(screen.getByTestId('bulk-grant-checkbox-assign2'));
    fireEvent.click(screen.getByTestId('btn-bulk-grant'));

    await waitFor(() => {
      expect(dynamicReportsApi.bulkGrantUnlock).toHaveBeenCalledWith(
        ['assign2'],
        'Quá hạn chung',
      );
    });
    await waitFor(() => screen.getByTestId('bulk-grant-result'));
    promptSpy.mockRestore();
  });
});
