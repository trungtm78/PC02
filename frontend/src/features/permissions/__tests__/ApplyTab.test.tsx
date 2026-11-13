import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import { ApplyTab } from '../components/ApplyTab';
import { permissionsApi } from '../api';
import { permissions as L } from '@/locales/permissions.vi';
import { formatVNDateTime } from '@/lib/dates';
import { authStore } from '@/stores/auth.store';
import { AUTHZ_MODE, AUTHZ_MODE_ERROR, MODE_CHANGE_STATUS, REACH, type AuthzMode, type ModeChange, type ModeComparison, type ModeStatus } from '../types';
import { apiError } from './fixtures';
import { INDEX, renderWithClient } from './harness';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  permissionsApi: {
    mode: vi.fn(),
    modeComparison: vi.fn(),
    setMode: vi.fn(),
    requestEnforce: vi.fn(),
    approveEnforce: vi.fn(),
    closeEnforceRequest: vi.fn(),
  },
}));

const api = vi.mocked(permissionsApi);
const T = L.apply;
const ME = 'admin-1';
const OTHER = 'admin-2';

const status = (over: Partial<ModeStatus> = {}): ModeStatus => ({
  mode: AUTHZ_MODE.OFF,
  enforcing: false,
  enforceAvailable: true,
  pending: null,
  history: [],
  ...over,
});
const change = (over: Partial<ModeChange> & Pick<ModeChange, 'id'>): ModeChange => ({
  fromMode: AUTHZ_MODE.OFF,
  toMode: AUTHZ_MODE.ENFORCE,
  status: MODE_CHANGE_STATUS.PENDING,
  requestedById: OTHER,
  requestedByName: 'Trần Thị B',
  reason: 'Đã rà soát xong',
  decidedById: null,
  decidedByName: null,
  decidedAt: null,
  createdAt: '2026-11-14T02:00:00.000Z',
  expiresAt: '2999-01-01T00:00:00.000Z',
  ...over,
});
const COMPARISON: ModeComparison = {
  people: 12,
  summary: { affected: 3, losing: 1, gaining: 2, changing: 1 },
  impacts: [
    { userId: 'gainer', name: 'Người Được Thêm', gained: [{ permission: 'read:Case', before: null, after: REACH.TEAM_TREE }], lost: [], changed: [] },
    { userId: 'loser', name: 'Người Bị Mất', gained: [], lost: [{ permission: 'delete:Petition', before: REACH.ALL, after: null }], changed: [] },
    {
      userId: 'narrowed',
      name: 'Người Bớt Tổ',
      gained: [],
      lost: [],
      changed: [{ permission: 'read:Petition', before: REACH.TEAM, after: REACH.TEAM, teamsLost: ['to2'], narrower: true }],
    },
  ],
  teamNames: { to2: 'Tổ CT số 2' },
  fingerprint: 'fp-1',
};
const NOBODY: ModeComparison = { people: 12, summary: { affected: 0, losing: 0, gaining: 0, changing: 0 }, impacts: [], teamNames: {}, fingerprint: 'fp-empty' };

const signIn = (id: string) => authStore.setProfile({ id, email: `${id}@example.test`, role: 'ADMIN', teams: [], primaryTeam: null });
const renderTab = (canWrite = true) => renderWithClient(<ApplyTab index={INDEX} canWrite={canWrite} />);
const type = (testId: string, value: string) => fireEvent.change(screen.getByTestId(testId), { target: { value } });

describe('ApplyTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    signIn(ME);
    api.mode.mockResolvedValue(status());
    api.modeComparison.mockResolvedValue(COMPARISON);
  });
  afterEach(() => sessionStorage.clear());

  describe('current state', () => {
    it.each(Object.values(AUTHZ_MODE))('says mode %s in plain words', async (mode) => {
      api.mode.mockResolvedValue(status({ mode: mode as AuthzMode, enforcing: mode === AUTHZ_MODE.ENFORCE }));
      renderTab();
      expect(await screen.findByTestId('apply-state-mode')).toHaveTextContent(T.state[mode]);
      expect(screen.getByTestId('apply-state')).toHaveAttribute('data-mode', mode);
      expect(screen.queryByTestId('apply-not-in-effect')).toBeNull();
      expect(screen.queryByTestId('apply-enforce-unavailable')).toBeNull();
    });

    it('warns when the chosen mode is ENFORCE but it is not in effect right now', async () => {
      api.mode.mockResolvedValue(status({ mode: AUTHZ_MODE.ENFORCE, enforcing: false }));
      renderTab();
      expect(await screen.findByTestId('apply-not-in-effect')).toHaveTextContent(T.notInEffect);
    });

    it('says so when this build cannot enforce, and offers no request to enforce', async () => {
      api.mode.mockResolvedValue(status({ enforceAvailable: false }));
      renderTab();
      expect(await screen.findByTestId('apply-enforce-unavailable')).toHaveTextContent(T.enforceUnavailable);
      expect(screen.queryByTestId('apply-request')).toBeNull();
      // The trial run stays available.
      expect(screen.getByTestId(`apply-switch-${AUTHZ_MODE.SHADOW}`)).toBeInTheDocument();
    });

    it('a failed load shows the translated error with a retry, and no actions', async () => {
      api.mode.mockRejectedValueOnce(apiError(503, AUTHZ_MODE_ERROR.UNAVAILABLE));
      renderTab();
      expect(await screen.findByTestId('apply-load-error')).toHaveTextContent(L.errors.AUTHZ_UNAVAILABLE);
      expect(screen.queryByTestId('apply-actions')).toBeNull();
      fireEvent.click(screen.getByTestId('apply-load-error-retry'));
      expect(await screen.findByTestId('apply-state-mode')).toBeInTheDocument();
    });
  });

  describe('comparison', () => {
    it('shows the numbers and the people, those who lose something first', async () => {
      renderTab();
      await screen.findByTestId('apply-person-loser');
      expect(screen.getByTestId('apply-summary-people')).toHaveTextContent('12');
      expect(screen.getByTestId('apply-summary-affected')).toHaveTextContent('3');
      expect(screen.getByTestId('apply-summary-losing')).toHaveTextContent('1');
      expect(screen.getByTestId('apply-summary-gaining')).toHaveTextContent('2');
      expect(screen.getByTestId('apply-summary-changing')).toHaveTextContent('1');
      expect(screen.getAllByTestId(/^apply-person-/).map((el) => el.getAttribute('data-testid'))).toEqual([
        'apply-person-loser',
        'apply-person-narrowed',
        'apply-person-gainer',
      ]);
      // The same words as the preview of a change: permission and reach by name, teams by name.
      expect(screen.getByTestId('apply-person-loser')).toHaveTextContent(`${L.preview.lost}: Đơn thư · Xoá (${L.reaches.ALL})`);
      expect(screen.getByTestId('apply-person-gainer')).toHaveTextContent(`${L.preview.gained}: Vụ án · Xem (${L.reaches.TEAM_TREE})`);
      expect(screen.getByTestId('apply-person-narrowed')).toHaveTextContent(L.preview.teamsLost('Tổ CT số 2'));
      expect(screen.queryByTestId('apply-nobody')).toBeNull();
    });

    it('"loses" follows the server: a permission kept at a narrower reach counts, with no team lost; a wider one does not', async () => {
      api.modeComparison.mockResolvedValue({
        ...COMPARISON,
        impacts: [
          { userId: 'wider', name: 'Người Rộng Hơn', gained: [], lost: [], changed: [{ permission: 'read:Case', before: REACH.TEAM, after: REACH.TEAM_TREE, wider: true }] },
          { userId: 'tighter', name: 'Người Hẹp Hơn', gained: [], lost: [], changed: [{ permission: 'read:Case', before: REACH.TEAM_TREE, after: REACH.TEAM, narrower: true }] },
        ],
      });
      renderTab();
      await screen.findByTestId('apply-person-tighter');
      expect(screen.getAllByTestId(/^apply-person-/).map((el) => el.getAttribute('data-testid'))).toEqual(['apply-person-tighter', 'apply-person-wider']);
      expect(screen.getByTestId('apply-narrower-tighter-read:Case')).toHaveTextContent(L.preview.narrower);
      expect(screen.getByTestId('apply-wider-wider-read:Case')).toHaveTextContent(L.preview.wider);
      expect(screen.queryByTestId('apply-narrower-wider-read:Case')).toBeNull();
    });

    it('says that nobody changes when nobody does', async () => {
      api.modeComparison.mockResolvedValue(NOBODY);
      renderTab();
      expect(await screen.findByTestId('apply-nobody')).toHaveTextContent(T.nobody);
      expect(screen.getByTestId('apply-summary-affected')).toHaveTextContent('0');
    });

    it('"Tải lại" asks the server again for the comparison and the state', async () => {
      renderTab();
      await screen.findByTestId('apply-person-loser');
      fireEvent.click(screen.getByTestId('apply-reload'));
      await waitFor(() => expect(api.modeComparison).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(api.mode).toHaveBeenCalledTimes(2));
    });

    it('a failed comparison is an error with a retry, never "nobody changes", and nothing can be asked for', async () => {
      api.modeComparison.mockRejectedValue(apiError(500, 'INTERNAL'));
      renderTab();
      expect(await screen.findByTestId('apply-comparison-load-error')).toBeInTheDocument();
      expect(screen.queryByTestId('apply-nobody')).toBeNull();
      type('apply-request-reason', 'Lý do');
      expect(screen.getByTestId('apply-read')).toBeDisabled();
      expect(screen.getByTestId('apply-request-submit')).toBeDisabled();
    });
  });

  describe('asking to enforce', () => {
    it('the request stays disabled until there is a reason and the box is ticked', async () => {
      renderTab();
      await screen.findByTestId('apply-person-loser');
      const submit = screen.getByTestId('apply-request-submit');
      expect(submit).toBeDisabled();

      type('apply-request-reason', '   ');
      fireEvent.click(screen.getByTestId('apply-read'));
      expect(submit).toBeDisabled();

      type('apply-request-reason', 'Đã rà soát');
      expect(submit).toBeEnabled();

      fireEvent.click(screen.getByTestId('apply-read'));
      expect(submit).toBeDisabled();
      expect(api.requestEnforce).not.toHaveBeenCalled();
    });

    it('sends the reason with the fingerprint of the comparison on screen, then reloads', async () => {
      api.requestEnforce.mockResolvedValue({});
      renderTab();
      await screen.findByTestId('apply-person-loser');
      type('apply-request-reason', '  Đã rà soát  ');
      fireEvent.click(screen.getByTestId('apply-read'));
      fireEvent.click(screen.getByTestId('apply-request-submit'));

      await waitFor(() => expect(api.requestEnforce).toHaveBeenCalledWith({ reason: 'Đã rà soát', acknowledge: 'fp-1' }));
      expect(await screen.findByTestId('apply-notice')).toHaveTextContent(T.done.requested);
      await waitFor(() => expect(api.mode).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(api.modeComparison).toHaveBeenCalledTimes(2));
    });

    it('a comparison that changed meanwhile: the message in words, both reloaded, and the box unticked', async () => {
      api.requestEnforce.mockRejectedValue(apiError(409, AUTHZ_MODE_ERROR.COMPARISON_CHANGED));
      renderTab();
      await screen.findByTestId('apply-person-loser');
      type('apply-request-reason', 'Đã rà soát');
      fireEvent.click(screen.getByTestId('apply-read'));
      expect(screen.getByTestId('apply-read')).toBeChecked();
      fireEvent.click(screen.getByTestId('apply-request-submit'));

      expect(await screen.findByTestId('apply-error')).toHaveTextContent(L.errors.AUTHZ_MODE_COMPARISON_CHANGED);
      expect(screen.getByTestId('apply-read')).not.toBeChecked();
      expect(screen.getByTestId('apply-request-submit')).toBeDisabled();
      await waitFor(() => expect(api.modeComparison).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(api.mode).toHaveBeenCalledTimes(2));
      // The reason typed is kept: only the reading has to be done again.
      expect(screen.getByTestId('apply-request-reason')).toHaveValue('Đã rà soát');
    });

    it('a tick given for one comparison does not count for another one loaded later', async () => {
      api.modeComparison.mockResolvedValueOnce(COMPARISON).mockResolvedValue({ ...COMPARISON, fingerprint: 'fp-2' });
      renderTab();
      await screen.findByTestId('apply-person-loser');
      fireEvent.click(screen.getByTestId('apply-read'));
      expect(screen.getByTestId('apply-read')).toBeChecked();
      fireEvent.click(screen.getByTestId('apply-reload'));
      await waitFor(() => expect(screen.getByTestId('apply-read')).not.toBeChecked());
    });

    it('with a request waiting there is no second request form', async () => {
      api.mode.mockResolvedValue(status({ pending: change({ id: 'r1' }) }));
      renderTab();
      await screen.findByTestId('apply-pending');
      expect(screen.queryByTestId('apply-request')).toBeNull();
    });
  });

  describe('a request waiting for a second administrator', () => {
    it('shows who asked, why and until when', async () => {
      const pending = change({ id: 'r1' });
      api.mode.mockResolvedValue(status({ pending }));
      renderTab();
      const box = await screen.findByTestId('apply-pending');
      expect(box).toHaveTextContent(T.pendingBy('Trần Thị B', formatVNDateTime(pending.createdAt)));
      expect(box).toHaveTextContent(T.pendingReason('Đã rà soát xong'));
      expect(box).toHaveTextContent(T.pendingExpires(formatVNDateTime(pending.expiresAt)));
    });

    it('the asker can withdraw and cannot approve', async () => {
      api.mode.mockResolvedValue(status({ pending: change({ id: 'r1', requestedById: ME }) }));
      api.closeEnforceRequest.mockResolvedValue({});
      renderTab();
      await screen.findByTestId('apply-pending');
      expect(screen.getByTestId('apply-needs-second')).toHaveTextContent(T.needsSecond);
      expect(screen.queryByTestId('apply-approve')).toBeNull();
      expect(screen.queryByTestId('apply-reject')).toBeNull();
      expect(screen.queryByTestId('apply-read')).toBeNull();

      fireEvent.click(screen.getByTestId('apply-withdraw'));
      await waitFor(() => expect(api.closeEnforceRequest).toHaveBeenCalledWith('r1'));
      expect(await screen.findByTestId('apply-notice')).toHaveTextContent(T.done.withdrawn);
    });

    it('another administrator approves with the fingerprint on screen, only after ticking the box', async () => {
      api.mode.mockResolvedValue(status({ pending: change({ id: 'r1' }) }));
      api.approveEnforce.mockResolvedValue({});
      renderTab();
      await screen.findByTestId('apply-pending');
      await screen.findByTestId('apply-person-loser');
      expect(screen.queryByTestId('apply-withdraw')).toBeNull();
      expect(screen.getByTestId('apply-reject')).toBeInTheDocument();
      expect(screen.getByTestId('apply-approve')).toBeDisabled();

      fireEvent.click(screen.getByTestId('apply-read'));
      fireEvent.click(screen.getByTestId('apply-approve'));
      await waitFor(() => expect(api.approveEnforce).toHaveBeenCalledWith('r1', { acknowledge: 'fp-1' }));
      expect(await screen.findByTestId('apply-notice')).toHaveTextContent(T.done.approved);
    });

    it('another administrator can reject without ticking anything', async () => {
      api.mode.mockResolvedValue(status({ pending: change({ id: 'r1' }) }));
      api.closeEnforceRequest.mockResolvedValue({});
      renderTab();
      fireEvent.click(await screen.findByTestId('apply-reject'));
      await waitFor(() => expect(api.closeEnforceRequest).toHaveBeenCalledWith('r1'));
      expect(await screen.findByTestId('apply-notice')).toHaveTextContent(T.done.rejected);
      expect(api.approveEnforce).not.toHaveBeenCalled();
    });

    it('an approval on a comparison that changed: explained, reloaded, unticked', async () => {
      api.mode.mockResolvedValue(status({ pending: change({ id: 'r1' }) }));
      api.approveEnforce.mockRejectedValue(apiError(409, AUTHZ_MODE_ERROR.COMPARISON_CHANGED));
      renderTab();
      await screen.findByTestId('apply-person-loser');
      fireEvent.click(await screen.findByTestId('apply-read'));
      fireEvent.click(screen.getByTestId('apply-approve'));
      expect(await screen.findByTestId('apply-error')).toHaveTextContent(L.errors.AUTHZ_MODE_COMPARISON_CHANGED);
      expect(screen.getByTestId('apply-read')).not.toBeChecked();
      expect(screen.getByTestId('apply-approve')).toBeDisabled();
      await waitFor(() => expect(api.modeComparison).toHaveBeenCalledTimes(2));
    });

    it('a refusal for being the asker is said in words, not as a code', async () => {
      // The profile is not loaded, so the screen cannot tell who is asking: the server decides.
      sessionStorage.clear();
      api.mode.mockResolvedValue(status({ pending: change({ id: 'r1', requestedById: ME }) }));
      api.approveEnforce.mockRejectedValue(apiError(403, AUTHZ_MODE_ERROR.SECOND_ADMIN_REQUIRED));
      renderTab();
      await screen.findByTestId('apply-person-loser');
      fireEvent.click(await screen.findByTestId('apply-read'));
      fireEvent.click(screen.getByTestId('apply-approve'));
      const box = await screen.findByTestId('apply-error');
      expect(box).toHaveTextContent(L.errors.AUTHZ_MODE_SECOND_ADMIN_REQUIRED);
      expect(box).not.toHaveTextContent(AUTHZ_MODE_ERROR.SECOND_ADMIN_REQUIRED);
    });
  });

  describe('switching at once', () => {
    it('while enforcing: "switch off" asks for a reason and sends { mode: OFF, reason }', async () => {
      api.mode.mockResolvedValue(status({ mode: AUTHZ_MODE.ENFORCE, enforcing: true }));
      api.setMode.mockResolvedValue({});
      renderTab();
      const off = await screen.findByTestId(`apply-switch-${AUTHZ_MODE.OFF}`);
      expect(off).toHaveTextContent(T.switchOff);
      // Enforcing already: nothing to ask for, no trial run to start.
      expect(screen.queryByTestId('apply-request')).toBeNull();
      expect(screen.queryByTestId(`apply-switch-${AUTHZ_MODE.SHADOW}`)).toBeNull();

      fireEvent.click(off);
      expect(screen.getByTestId('apply-switch-confirm')).toBeDisabled();
      type('apply-switch-reason', '  Nhiều người báo thiếu quyền  ');
      fireEvent.click(screen.getByTestId('apply-switch-confirm'));

      await waitFor(() => expect(api.setMode).toHaveBeenCalledWith({ mode: AUTHZ_MODE.OFF, reason: 'Nhiều người báo thiếu quyền' }));
      expect(await screen.findByTestId('apply-notice')).toHaveTextContent(T.done.switchedOff);
      await waitFor(() => expect(api.mode).toHaveBeenCalledTimes(2));
    });

    it('while off: the trial run can be started, with a reason', async () => {
      api.setMode.mockResolvedValue({});
      renderTab();
      const on = await screen.findByTestId(`apply-switch-${AUTHZ_MODE.SHADOW}`);
      expect(on).toHaveTextContent(T.shadowOn);
      expect(screen.queryByTestId(`apply-switch-${AUTHZ_MODE.OFF}`)).toBeNull();
      fireEvent.click(on);
      type('apply-switch-reason', 'Xem trước một tuần');
      fireEvent.click(screen.getByTestId('apply-switch-confirm'));
      await waitFor(() => expect(api.setMode).toHaveBeenCalledWith({ mode: AUTHZ_MODE.SHADOW, reason: 'Xem trước một tuần' }));
      expect(await screen.findByTestId('apply-notice')).toHaveTextContent(T.done.shadowOn);
    });

    it('while on trial: the trial run can be stopped, with a reason', async () => {
      api.mode.mockResolvedValue(status({ mode: AUTHZ_MODE.SHADOW }));
      api.setMode.mockResolvedValue({});
      renderTab();
      const stop = await screen.findByTestId(`apply-switch-${AUTHZ_MODE.OFF}`);
      expect(stop).toHaveTextContent(T.shadowOff);
      expect(screen.queryByTestId(`apply-switch-${AUTHZ_MODE.SHADOW}`)).toBeNull();
      fireEvent.click(stop);
      type('apply-switch-reason', 'Đã xem đủ');
      fireEvent.click(screen.getByTestId('apply-switch-confirm'));
      await waitFor(() => expect(api.setMode).toHaveBeenCalledWith({ mode: AUTHZ_MODE.OFF, reason: 'Đã xem đủ' }));
      expect(await screen.findByTestId('apply-notice')).toHaveTextContent(T.done.shadowOff);
    });

    it('cancelling the reason form switches nothing', async () => {
      renderTab();
      fireEvent.click(await screen.findByTestId(`apply-switch-${AUTHZ_MODE.SHADOW}`));
      fireEvent.click(screen.getByTestId('apply-switch-cancel'));
      expect(screen.queryByTestId('apply-switch-form')).toBeNull();
      expect(api.setMode).not.toHaveBeenCalled();
    });

    it('warns that a waiting request lapses when the mode is switched', async () => {
      api.mode.mockResolvedValue(status({ pending: change({ id: 'r1' }) }));
      renderTab();
      fireEvent.click(await screen.findByTestId(`apply-switch-${AUTHZ_MODE.SHADOW}`));
      expect(screen.getByTestId('apply-switch-lapses')).toHaveTextContent(T.pendingLapses);
    });

    it.each([AUTHZ_MODE_ERROR.ALREADY, AUTHZ_MODE_ERROR.ADMIN_ONLY, AUTHZ_MODE_ERROR.WOULD_LOCK_OUT, AUTHZ_MODE_ERROR.UNAVAILABLE])(
      'a refused switch (%s) is explained in words',
      async (code) => {
        api.setMode.mockRejectedValue(apiError(409, code));
        renderTab();
        fireEvent.click(await screen.findByTestId(`apply-switch-${AUTHZ_MODE.SHADOW}`));
        type('apply-switch-reason', 'Lý do');
        fireEvent.click(screen.getByTestId('apply-switch-confirm'));
        const box = await screen.findByTestId('apply-error');
        expect(box).toHaveTextContent(L.errors[code]);
        expect(box).not.toHaveTextContent(code);
      },
    );
  });

  describe('without the right to change', () => {
    it('the state, the comparison and the history are shown, and no action', async () => {
      api.mode.mockResolvedValue(status({ pending: change({ id: 'r1' }), history: [change({ id: 'r1' })] }));
      renderTab(false);
      await screen.findByTestId('apply-person-loser');
      expect(screen.getByTestId('apply-state-mode')).toBeInTheDocument();
      expect(screen.getByTestId('apply-history-row-r1')).toBeInTheDocument();
      expect(screen.queryByTestId('apply-actions')).toBeNull();
      expect(screen.queryByTestId('apply-approve')).toBeNull();
    });
  });

  describe('history', () => {
    it('lists each change: from and to, the status in words, who asked, who decided, and why', async () => {
      const applied = change({
        id: 'h2',
        status: MODE_CHANGE_STATUS.APPLIED,
        decidedById: ME,
        decidedByName: 'Nguyễn Văn A',
        decidedAt: '2026-11-14T03:00:00.000Z',
        expiresAt: null,
      });
      const off = change({
        id: 'h3',
        fromMode: AUTHZ_MODE.ENFORCE,
        toMode: AUTHZ_MODE.OFF,
        status: MODE_CHANGE_STATUS.APPLIED,
        reason: 'Về như cũ',
        expiresAt: null,
      });
      const expired = change({ id: 'h1', expiresAt: '2020-01-01T00:00:00.000Z' });
      api.mode.mockResolvedValue(status({ history: [off, applied, expired] }));
      renderTab();

      const row = await screen.findByTestId('apply-history-row-h2');
      expect(row).toHaveTextContent(T.historyChange(T.modeNames.OFF, T.modeNames.ENFORCE));
      expect(within(row).getByTestId('apply-history-status-h2')).toHaveTextContent(T.statuses.APPLIED);
      expect(row).toHaveTextContent(formatVNDateTime(applied.createdAt));
      expect(row).toHaveTextContent(T.historyAsked('Trần Thị B'));
      expect(row).toHaveTextContent(T.historyDecided('Nguyễn Văn A', formatVNDateTime(applied.decidedAt)));
      expect(row).toHaveTextContent(T.historyReason('Đã rà soát xong'));

      expect(screen.getByTestId('apply-history-row-h3')).toHaveTextContent(T.historyChange(T.modeNames.ENFORCE, T.modeNames.OFF));
      // A request nobody approved in time no longer reads "waiting".
      expect(screen.getByTestId('apply-history-status-h1')).toHaveTextContent(T.statusExpired);
      expect(screen.getAllByTestId(/^apply-history-row-/).map((el) => el.getAttribute('data-testid'))).toEqual([
        'apply-history-row-h3',
        'apply-history-row-h2',
        'apply-history-row-h1',
      ]);
    });

    it.each(Object.values(MODE_CHANGE_STATUS))('status %s is shown in words', async (value) => {
      api.mode.mockResolvedValue(status({ history: [change({ id: 'h', status: value })] }));
      renderTab();
      expect(await screen.findByTestId('apply-history-status-h')).toHaveTextContent(T.statuses[value]);
    });

    it('an empty history says so', async () => {
      renderTab();
      expect(await screen.findByTestId('apply-history-empty')).toHaveTextContent(T.historyEmpty);
    });
  });
});
