import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { HistoryTab } from '../components/HistoryTab';
import { permissionsApi } from '../api';
import { permissions as L } from '@/locales/permissions.vi';
import { AUTHZ_ERROR, HISTORY_PAGE, PROBLEM, type ChangeSet } from '../types';
import { apiError } from './fixtures';
import { INDEX, TEAMS, renderWithClient } from './harness';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  permissionsApi: { changes: vi.fn(), undo: vi.fn(), teams: vi.fn() },
}));
vi.mock('@/hooks/useOfficerOptions', () => ({
  useOfficerOptions: () => ({ data: [{ value: 'u1', label: 'Nguyễn Văn A', teams: [] }] }),
}));

const api = vi.mocked(permissionsApi);
const T = L.history;
const change = (row: Partial<ChangeSet> & Pick<ChangeSet, 'id' | 'kind'>): ChangeSet => ({
  actorId: 'admin',
  actorName: 'Quản trị viên',
  reason: null,
  createdAt: '2026-11-10T03:00:00.000Z',
  revertsId: null,
  undoneById: null,
  changes: [],
  ...row,
});
const ROWS: ChangeSet[] = [
  change({
    id: 'c3',
    kind: 'TEAM_CONFIG_APPLIED',
    reason: 'Tách tổ',
    changes: [
      { type: 'team', id: 'to2', before: null, after: {} },
      { type: 'team', id: 'gone', before: null, after: {} },
    ],
  }),
  change({ id: 'c2', kind: 'TEMPLATE_UPDATED', undoneById: 'c9', changes: [{ type: 'template', id: 't1', before: { name: 'Cán bộ' }, after: { name: 'Cán bộ nhập liệu' } }] }),
  change({ id: 'c1', kind: 'USER_OVERRIDES_SAVED', changes: [{ type: 'user', id: 'u1', before: [], after: [] }] }),
];
const renderTab = (canWrite = true) => renderWithClient(<HistoryTab index={INDEX} canWrite={canWrite} />);

describe('HistoryTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.changes.mockResolvedValue(ROWS);
    api.teams.mockResolvedValue(TEAMS);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it('lists the changes as the server ordered them: what, who, why, and which objects by name', async () => {
    renderTab();
    const first = await screen.findByTestId('history-row-c3');
    expect(api.changes).toHaveBeenCalledWith({ limit: HISTORY_PAGE });
    expect(first).toHaveTextContent(L.changeKinds.TEAM_CONFIG_APPLIED);
    expect(first).toHaveTextContent('Quản trị viên');
    expect(first).toHaveTextContent(`${T.reason}: Tách tổ`);
    // A team that can no longer be named is shown by its id, not dropped.
    await waitFor(() =>
      expect(screen.getByTestId('history-objects-c3')).toHaveTextContent(`${T.object.team('Tổ CT số 2')}; ${T.object.team('gone')}`),
    );
    expect(screen.getByTestId('history-objects-c2')).toHaveTextContent(T.object.template('Cán bộ nhập liệu'));
    expect(screen.getByTestId('history-objects-c1')).toHaveTextContent(T.object.user('Nguyễn Văn A'));
    expect(screen.getAllByTestId(/^history-row-/).map((r) => r.getAttribute('data-testid'))).toEqual(['history-row-c3', 'history-row-c2', 'history-row-c1']);
  });

  it('a change already undone says so and offers no undo', async () => {
    renderTab();
    expect(await screen.findByTestId('history-undone-c2')).toHaveTextContent(T.undone);
    expect(screen.queryByTestId('history-undo-c2')).toBeNull();
    expect(screen.getByTestId('history-undo-c3')).toBeInTheDocument();
  });

  it('a failed load shows the error with a retry, never "no changes yet"', async () => {
    api.changes.mockRejectedValueOnce(apiError(500, 'INTERNAL'));
    renderTab();
    expect(await screen.findByTestId('history-load-error')).toBeInTheDocument();
    expect(screen.queryByText(T.empty)).toBeNull();
    fireEvent.click(screen.getByTestId('history-load-error-retry'));
    expect(await screen.findByTestId('history-row-c3')).toBeInTheDocument();
  });

  it('an empty history says so', async () => {
    api.changes.mockResolvedValue([]);
    renderTab();
    expect(await screen.findByTestId('history-empty')).toHaveTextContent(T.empty);
    expect(screen.queryByTestId('history-more')).toBeNull();
  });

  it('undo asks first, then undoes that change', async () => {
    api.undo.mockResolvedValue({ changed: true, changeSetId: 'c10' });
    renderTab();
    fireEvent.click(await screen.findByTestId('history-undo-c3'));
    expect(window.confirm).toHaveBeenCalledWith(T.confirmUndo(L.changeKinds.TEAM_CONFIG_APPLIED));
    await waitFor(() => expect(api.undo).toHaveBeenCalledWith('c3', undefined));
    expect(await screen.findByTestId('history-notice')).toHaveTextContent(T.undoDone);
    await waitFor(() => expect(api.changes).toHaveBeenCalledTimes(2));
  });

  it('declining the confirmation undoes nothing', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    renderTab();
    fireEvent.click(await screen.findByTestId('history-undo-c3'));
    expect(api.undo).not.toHaveBeenCalled();
  });

  it.each([
    [AUTHZ_ERROR.CHANGED_SINCE, true],
    [AUTHZ_ERROR.ALREADY_UNDONE, false],
  ])('a refused undo (%s) is explained on its row', async (code, offersReload) => {
    api.undo.mockRejectedValue(apiError(409, code, [{ type: 'team', id: 'to2' }]));
    renderTab();
    fireEvent.click(await screen.findByTestId('history-undo-c1'));
    expect(await screen.findByTestId('history-error')).toHaveTextContent(L.errors[code]);
    expect(screen.getByTestId('history-row-c1')).toContainElement(screen.getByTestId('history-error'));
    expect(screen.queryByTestId('history-error-reload') !== null).toBe(offersReload);
    expect(screen.queryByTestId('history-undo-reason')).toBeNull();
  });

  it('an undo that would hand out a sensitive permission asks for a reason and can be retried with it', async () => {
    api.undo.mockRejectedValueOnce(
      apiError(400, AUTHZ_ERROR.INVALID, [
        { code: PROBLEM.SENSITIVE_REASON_REQUIRED, permission: 'write:User' },
        { code: PROBLEM.ABOVE_OWN, permission: 'delete:User' },
      ]),
    );
    api.undo.mockResolvedValueOnce({ changed: true, changeSetId: 'c11' });
    renderTab();
    fireEvent.click(await screen.findByTestId('history-undo-c3'));

    const reasons = await screen.findByTestId('history-error-reasons');
    expect(reasons).toHaveTextContent(L.problems.SENSITIVE_REASON_REQUIRED('Người dùng · Thêm, Sửa', '', ''));
    expect(reasons).toHaveTextContent(L.problems.ABOVE_OWN('Người dùng · Xoá', '', ''));
    expect(screen.getByTestId('history-undo-retry')).toBeDisabled();

    fireEvent.change(screen.getByTestId('history-undo-reason'), { target: { value: ' Khôi phục theo yêu cầu ' } });
    fireEvent.click(screen.getByTestId('history-undo-retry'));
    await waitFor(() => expect(api.undo).toHaveBeenLastCalledWith('c3', 'Khôi phục theo yêu cầu'));
    expect(await screen.findByTestId('history-notice')).toHaveTextContent(T.undoDone);
    expect(screen.queryByTestId('history-error')).toBeNull();
  });

  it('"Tải thêm" appears only after a full page and asks for what comes before the last row', async () => {
    const full = Array.from({ length: HISTORY_PAGE }, (_, i) => change({ id: `p${i}`, kind: 'UNDO' }));
    api.changes.mockResolvedValueOnce(full).mockResolvedValueOnce([change({ id: 'older', kind: 'TEMPLATE_CREATED' })]);
    renderTab();
    fireEvent.click(await screen.findByTestId('history-more'));
    expect(await screen.findByTestId('history-row-older')).toBeInTheDocument();
    expect(api.changes).toHaveBeenLastCalledWith({ limit: HISTORY_PAGE, before: `p${HISTORY_PAGE - 1}` });
    expect(screen.getByTestId('history-row-p0')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('history-more')).toBeNull());
  });

  it('without the right to change there is no undo', async () => {
    renderTab(false);
    await screen.findByTestId('history-row-c3');
    expect(screen.queryByTestId('history-undo-c3')).toBeNull();
    expect(screen.getByTestId('history-undone-c2')).toBeInTheDocument();
  });
});
