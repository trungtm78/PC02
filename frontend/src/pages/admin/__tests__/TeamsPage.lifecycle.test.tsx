import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TeamsPage from '../TeamsPage';
import { api } from '@/lib/api';
import { teams as t } from '@/locales/vi';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/components/SingleWardPicker', () => ({ SingleWardPicker: () => null }));

const base = {
  level: 1,
  order: 0,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  _count: { members: 2 },
};
const TEAMS = [
  { ...base, id: 'a1', name: 'Tổ công tác số 2', code: 'T2', parentId: null, isActive: true, status: 'ACTIVE' },
  // A paused child of an ACTIVE parent: it must still be reachable from the Paused tab.
  { ...base, id: 'p1', name: 'Tổ thử nghiệm', code: 'TN', parentId: 'a1', isActive: false, status: 'INACTIVE' },
  { ...base, id: 'z1', name: 'Tổ cũ Phường 3', code: 'P3', parentId: null, isActive: false, status: 'ARCHIVED' },
];

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TeamsPage />
    </QueryClientProvider>,
  );
}

describe('TeamsPage lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ data: TEAMS });
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it('asks for every state once and shows the active tab first, with a count on each tab', async () => {
    renderPage();

    await screen.findByText('Tổ công tác số 2');
    expect(api.get).toHaveBeenCalledWith('/teams', { params: { status: 'ALL' } });
    expect(screen.queryByText('Tổ thử nghiệm')).toBeNull();
    expect(screen.queryByText('Tổ cũ Phường 3')).toBeNull();
    expect(screen.getByTestId('team-tab-ACTIVE')).toHaveTextContent('(1)');
    expect(screen.getByTestId('team-tab-INACTIVE')).toHaveTextContent('(1)');
    expect(screen.getByTestId('team-tab-ARCHIVED')).toHaveTextContent('(1)');
  });

  it('the paused tab lists a paused team even though its parent is active (a flat list, not a tree)', async () => {
    renderPage();
    await screen.findByText('Tổ công tác số 2');

    fireEvent.click(screen.getByTestId('team-tab-INACTIVE'));

    expect(await screen.findByText('Tổ thử nghiệm')).toBeInTheDocument();
    expect(screen.queryByText('Tổ công tác số 2')).toBeNull();
    expect(screen.getByText(t.hint.INACTIVE)).toBeInTheDocument();
  });

  it('pausing an active team confirms, then sends the new state', async () => {
    renderPage();
    await screen.findByText('Tổ công tác số 2');

    fireEvent.click(screen.getByTestId('team-action-deactivate-a1'));

    expect(window.confirm).toHaveBeenCalledWith(t.confirm.deactivate('Tổ công tác số 2'));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/teams/a1/status', { status: 'INACTIVE' }),
    );
  });

  it('declining the confirmation sends nothing', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    renderPage();
    await screen.findByText('Tổ công tác số 2');

    fireEvent.click(screen.getByTestId('team-action-archive-a1'));

    expect(api.patch).not.toHaveBeenCalled();
  });

  it('a paused team can be reactivated or archived; an archived one can only be restored', async () => {
    renderPage();
    await screen.findByText('Tổ công tác số 2');

    fireEvent.click(screen.getByTestId('team-tab-INACTIVE'));
    await screen.findByText('Tổ thử nghiệm');
    expect(screen.getByTestId('team-action-activate-p1')).toBeInTheDocument();
    expect(screen.getByTestId('team-action-archive-p1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('team-tab-ARCHIVED'));
    await screen.findByText('Tổ cũ Phường 3');
    expect(screen.getByTestId('team-action-restore-z1')).toBeInTheDocument();
    expect(screen.queryByTestId('team-action-archive-z1')).toBeNull();

    fireEvent.click(screen.getByTestId('team-action-restore-z1'));
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/teams/z1/status', { status: 'ACTIVE' }),
    );
  });

  it('shows the translated message for a server error code, not the code itself', async () => {
    vi.mocked(api.patch).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error: { code: 'TEAM_INVALID_TRANSITION', message: 'x' } } },
    });
    renderPage();
    await screen.findByText('Tổ công tác số 2');

    fireEvent.click(screen.getByTestId('team-action-deactivate-a1'));

    expect(await screen.findByTestId('team-status-error')).toHaveTextContent(
      t.errors.TEAM_INVALID_TRANSITION,
    );
  });

  it('the parent picker of the form offers active teams only', async () => {
    renderPage();
    await screen.findByText('Tổ công tác số 2');

    fireEvent.click(screen.getByText('Thêm mới'));

    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options.some((o) => o?.includes('TN - Tổ thử nghiệm'))).toBe(false);
    expect(options.some((o) => o?.includes('P3 - Tổ cũ Phường 3'))).toBe(false);
    expect(options.some((o) => o?.includes('T2 - Tổ công tác số 2'))).toBe(true);
  });
});
