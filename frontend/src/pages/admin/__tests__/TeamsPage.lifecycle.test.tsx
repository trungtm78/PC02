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
    vi.mocked(api.get).mockImplementation(async (url: string) =>
      url === '/teams/merges' ? { data: [] } : { data: TEAMS },
    );
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

  describe('real delete', () => {
    it('asks the server what still refers to the team, confirms, then deletes', async () => {
      vi.mocked(api.get).mockImplementation(async (url: string) =>
        url === '/teams/a1/deletion-check'
          ? { data: { deletable: true, total: 0, blockers: [] } }
          : { data: TEAMS },
      );
      vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
      renderPage();
      await screen.findByText('Tổ công tác số 2');

      fireEvent.click(screen.getByTestId('team-action-delete-a1'));

      await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/teams/a1'));
      expect(window.confirm).toHaveBeenCalledWith(t.delete.confirm('Tổ công tác số 2'));
    });

    it('a team that still has data is not deleted: the screen lists what blocks it and offers Archive', async () => {
      vi.mocked(api.get).mockImplementation(async (url: string) =>
        url === '/teams/a1/deletion-check'
          ? {
              data: {
                deletable: false,
                total: 763 + 13,
                blockers: [
                  { table: 'petitions', column: 'assignedTeamId', count: 763 },
                  { table: 'user_teams', column: 'teamId', count: 13 },
                ],
              },
            }
          : { data: TEAMS },
      );
      renderPage();
      await screen.findByText('Tổ công tác số 2');

      fireEvent.click(screen.getByTestId('team-action-delete-a1'));

      const box = await screen.findByTestId('team-delete-blocked');
      expect(box).toHaveTextContent('763 ' + t.delete.sources.petitions);
      expect(box).toHaveTextContent('13 ' + t.delete.sources.user_teams);
      expect(box).toHaveTextContent(t.delete.blockedHint);
      expect(api.delete).not.toHaveBeenCalled();
      expect(window.confirm).not.toHaveBeenCalled();
    });

    it('a table the screen has no words for is still shown, by its own name', async () => {
      vi.mocked(api.get).mockImplementation(async (url: string) =>
        url === '/teams/a1/deletion-check'
          ? { data: { deletable: false, total: 2, blockers: [{ table: 'brand_new_table', column: 'teamId', count: 2 }] } }
          : { data: TEAMS },
      );
      renderPage();
      await screen.findByText('Tổ công tác số 2');

      fireEvent.click(screen.getByTestId('team-action-delete-a1'));

      expect(await screen.findByTestId('team-delete-blocked')).toHaveTextContent('2 brand_new_table');
    });

    it('when the server refuses at delete time (a race), it shows the same list from the error', async () => {
      vi.mocked(api.get).mockImplementation(async (url: string) =>
        url === '/teams/a1/deletion-check'
          ? { data: { deletable: true, total: 0, blockers: [] } }
          : { data: TEAMS },
      );
      vi.mocked(api.delete).mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 409,
          data: {
            error: {
              code: 'TEAM_HAS_DATA',
              message: 'x',
              details: [{ table: 'user_teams', column: 'teamId', count: 1 }],
            },
          },
        },
      });
      renderPage();
      await screen.findByText('Tổ công tác số 2');

      fireEvent.click(screen.getByTestId('team-action-delete-a1'));

      expect(await screen.findByTestId('team-delete-blocked')).toHaveTextContent('1 ' + t.delete.sources.user_teams);
    });

    it('the blocked box can be closed', async () => {
      vi.mocked(api.get).mockImplementation(async (url: string) =>
        url === '/teams/a1/deletion-check'
          ? { data: { deletable: false, total: 1, blockers: [{ table: 'cases', column: 'assignedTeamId', count: 1 }] } }
          : { data: TEAMS },
      );
      renderPage();
      await screen.findByText('Tổ công tác số 2');
      fireEvent.click(screen.getByTestId('team-action-delete-a1'));
      await screen.findByTestId('team-delete-blocked');

      fireEvent.click(screen.getByTestId('team-delete-blocked-close'));

      expect(screen.queryByTestId('team-delete-blocked')).toBeNull();
    });

    it('Delete is offered from every state', async () => {
      renderPage();
      await screen.findByText('Tổ công tác số 2');
      expect(screen.getByTestId('team-action-delete-a1')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('team-tab-INACTIVE'));
      await screen.findByText('Tổ thử nghiệm');
      expect(screen.getByTestId('team-action-delete-p1')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('team-tab-ARCHIVED'));
      await screen.findByText('Tổ cũ Phường 3');
      expect(screen.getByTestId('team-action-delete-z1')).toBeInTheDocument();
    });
  });

  describe('merge', () => {
    const SUMMARY = {
      moved: [
        { table: 'petitions', column: 'assignedTeamId', count: 763 },
        { table: 'user_teams', column: 'teamId', count: 12 },
      ],
      duplicatesRemoved: [{ table: 'user_teams', count: 1 }],
      leadersRaised: 1,
      skipped: [{ table: 'dyn_report_assignments', column: 'teamId', count: 4, reason: 'HISTORY' }],
    };
    const TEAMS_WITH_TARGET = [
      ...TEAMS,
      { ...base, id: 'a2', name: 'Tổ công tác số 5', code: 'T5', parentId: null, isActive: true, status: 'ACTIVE' },
    ];

    beforeEach(() => {
      vi.mocked(api.get).mockImplementation(async (url: string) =>
        url === '/teams/merges' ? { data: [] } : { data: TEAMS_WITH_TARGET },
      );
      vi.mocked(api.post).mockImplementation(async (url: string) =>
        url.endsWith('/merge-preview')
          ? { data: { source: { id: 'a1', name: 'x' }, target: { id: 'a2', name: 'y' }, summary: SUMMARY } }
          : { data: { operationId: 'op1', summary: SUMMARY } },
      );
    });

    function openMerge() {
      fireEvent.click(screen.getByTestId('team-action-merge-a1'));
    }

    it('only active teams other than the source can receive the merge', async () => {
      renderPage();
      await screen.findByText('Tổ công tác số 2');

      openMerge();

      const select = await screen.findByTestId('team-merge-target');
      const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
      expect(options.some((o) => o?.includes('Tổ công tác số 5'))).toBe(true);
      expect(options.some((o) => o?.includes('Tổ công tác số 2'))).toBe(false);
      expect(options.some((o) => o?.includes('Tổ thử nghiệm'))).toBe(false);
    });

    it('previews what will move, what is dropped as a duplicate and what stays, before anything is changed', async () => {
      renderPage();
      await screen.findByText('Tổ công tác số 2');
      openMerge();
      fireEvent.change(await screen.findByTestId('team-merge-target'), { target: { value: 'a2' } });

      fireEvent.click(screen.getByTestId('team-merge-preview'));

      const box = await screen.findByTestId('team-merge-summary');
      expect(api.post).toHaveBeenCalledWith('/teams/a1/merge-preview', { targetTeamId: 'a2' });
      expect(box).toHaveTextContent(t.merge.moved(763, t.delete.sources.petitions));
      expect(box).toHaveTextContent(t.merge.moved(12, t.delete.sources.user_teams));
      expect(box).toHaveTextContent(t.merge.duplicates(1, t.delete.sources.user_teams));
      expect(box).toHaveTextContent(t.merge.leaders(1));
      expect(box).toHaveTextContent(t.merge.skipped.HISTORY(4, t.delete.sources.dyn_report_assignments));
      expect(api.post).not.toHaveBeenCalledWith('/teams/a1/merge', expect.anything());
    });

    it('a preview that comes back for a target no longer selected cannot enable the merge', async () => {
      let answerFirst: (v: unknown) => void = () => {};
      vi.mocked(api.post).mockImplementation(
        (url: string, body?: unknown) =>
          new Promise((resolve) => {
            if (url.endsWith('/merge-preview') && (body as { targetTeamId: string }).targetTeamId === 'a2') {
              answerFirst = resolve;
            } else {
              resolve({ data: {} });
            }
          }),
      );
      renderPage();
      await screen.findByText('Tổ công tác số 2');
      openMerge();
      fireEvent.change(await screen.findByTestId('team-merge-target'), { target: { value: 'a2' } });
      fireEvent.click(screen.getByTestId('team-merge-preview'));
      // the person changes their mind while the preview for the first target is still being counted
      fireEvent.change(screen.getByTestId('team-merge-target'), { target: { value: '' } });

      answerFirst({ data: { source: { id: 'a1', name: 'x' }, target: { id: 'a2', name: 'y' }, summary: SUMMARY } });

      await waitFor(() => expect(screen.queryByTestId('team-merge-summary')).toBeNull());
      expect(screen.getByTestId('team-merge-confirm')).toBeDisabled();
    });

    it('merges only after the preview, then announces it', async () => {
      renderPage();
      await screen.findByText('Tổ công tác số 2');
      openMerge();
      fireEvent.change(await screen.findByTestId('team-merge-target'), { target: { value: 'a2' } });
      expect(screen.getByTestId('team-merge-confirm')).toBeDisabled();
      fireEvent.click(screen.getByTestId('team-merge-preview'));
      await screen.findByTestId('team-merge-summary');

      fireEvent.click(screen.getByTestId('team-merge-confirm'));

      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/teams/a1/merge', { targetTeamId: 'a2' }));
      expect(await screen.findByTestId('team-merge-done')).toHaveTextContent(
        t.merge.done('Tổ công tác số 2', 'Tổ công tác số 5'),
      );
    });

    it('a server refusal is shown in the dialog as its translated message', async () => {
      vi.mocked(api.post).mockRejectedValue({
        isAxiosError: true,
        response: { status: 409, data: { error: { code: 'TEAM_MERGE_CYCLE', message: 'x' } } },
      });
      renderPage();
      await screen.findByText('Tổ công tác số 2');
      openMerge();
      fireEvent.change(await screen.findByTestId('team-merge-target'), { target: { value: 'a2' } });

      fireEvent.click(screen.getByTestId('team-merge-preview'));

      expect(await screen.findByTestId('team-merge-error')).toHaveTextContent(t.errors.TEAM_MERGE_CYCLE);
    });

    it('lists recent merges and undoes one after asking, reporting what was left alone', async () => {
      vi.mocked(api.get).mockImplementation(async (url: string) =>
        url === '/teams/merges'
          ? {
              data: [
                { id: 'op1', sourceName: 'Tổ cũ A', targetName: 'Tổ mới B', status: 'APPLIED', mergedAt: '2026-11-13T01:00:00Z' },
                { id: 'op0', sourceName: 'Tổ cũ X', targetName: 'Tổ mới Y', status: 'UNDONE', mergedAt: '2026-11-12T01:00:00Z' },
              ],
            }
          : { data: TEAMS_WITH_TARGET },
      );
      vi.mocked(api.post).mockResolvedValue({ data: { restored: 10, skipped: 2 } });
      renderPage();

      await screen.findByText('Tổ cũ A', { exact: false });
      expect(screen.queryByTestId('team-merge-undo-op0')).toBeNull();
      fireEvent.click(screen.getByTestId('team-merge-undo-op1'));

      expect(window.confirm).toHaveBeenCalledWith(t.merge.undoConfirm('Tổ cũ A', 'Tổ mới B'));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/teams/merges/op1/undo'));
      expect(await screen.findByTestId('team-merge-undo-result')).toHaveTextContent(t.merge.undoResult(10, 2));
    });
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
