import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { LookupTab } from '../components/LookupTab';
import { effectiveSections, grantWhy, reachesDetail } from '../effective';
import { permissionsApi } from '../api';
import { permissions as L } from '@/locales/permissions.vi';
import { AUTHZ_ERROR, AUTHZ_MODE, EFFECT, GRANT_SOURCE, PROBLEM, REACH, type EffectiveGrant, type EffectiveView } from '../types';
import { RESOURCES, apiError } from './fixtures';
import { INDEX, renderWithClient } from './harness';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  permissionsApi: { effective: vi.fn(), userOverrides: vi.fn(), saveUserOverrides: vi.fn(), preview: vi.fn() },
}));
const officers = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/hooks/useOfficerOptions', () => ({ useOfficerOptions: () => officers.value }));

const api = vi.mocked(permissionsApi);
const T = L.lookup;
const el = (id: string) => screen.getByTestId(id) as HTMLInputElement & HTMLSelectElement;
const grant = (g: Partial<EffectiveGrant>): EffectiveGrant => ({
  reach: REACH.TEAM_TREE,
  source: GRANT_SOURCE.TEMPLATE,
  teamId: 'to2',
  teamName: 'Tổ CT số 2',
  configTeamId: 'to2',
  configTeamName: 'Tổ CT số 2',
  templateId: 'tpl-lead',
  templateName: 'Lãnh đạo tổ',
  asLeader: true,
  ...g,
});
const VIEW: EffectiveView = {
  userId: 'u1',
  mode: AUTHZ_MODE.OFF,
  admin: false,
  teams: [{ id: 'to2', name: 'Tổ CT số 2' }],
  validUntil: null,
  permissions: [
    {
      permission: 'read:Petition',
      resource: 'petitions',
      reach: REACH.TEAM_TREE,
      grants: [grant({})],
      mutedBy: [],
      reaches: { all: false, own: true, teams: [{ id: 'to2', name: 'Tổ CT số 2' }, { id: 'to3', name: 'Tổ 3' }], unassigned: true },
    },
    {
      permission: 'delete:Petition',
      resource: 'petitions',
      reach: null,
      grants: [],
      mutedBy: [{ source: GRANT_SOURCE.TEAM_OVERRIDE, teamId: 'x', teamName: 'Tổ X' }],
      reaches: null,
    },
    { permission: 'edit:Petition', resource: 'petitions', reach: null, grants: [], mutedBy: [], reaches: null },
    { permission: 'read:Calendar', resource: 'calendar', reach: REACH.ALL, grants: [grant({ source: GRANT_SOURCE.ROLE, reach: REACH.ALL })], mutedBy: [], reaches: null },
  ],
};
const OWN = { overrides: [{ permission: 'read:Case', effect: EFFECT.GRANT, reach: REACH.OWN, reason: 'Hỗ trợ', expiresAt: null }], token: 'tok-1' };
const renderTab = (canWrite = true, initialUserId?: string) =>
  renderWithClient(<LookupTab resources={RESOURCES} index={INDEX} canWrite={canWrite} initialUserId={initialUserId} />);

describe('effective lines', () => {
  it('says where a grant comes from', () => {
    expect(grantWhy(grant({}))).toBe('Tổ CT số 2, mẫu "Lãnh đạo tổ" (tổ trưởng)');
    expect(grantWhy(grant({ asLeader: false, configTeamId: 'doi', configTeamName: 'Đội 2' }))).toBe(
      `Tổ CT số 2, mẫu "Lãnh đạo tổ" (thành viên), ${T.why.via('Đội 2')}`,
    );
    expect(grantWhy(grant({ source: GRANT_SOURCE.ROLE }))).toBe(T.why.role);
    expect(grantWhy(grant({ source: GRANT_SOURCE.TEAM_OVERRIDE }))).toBe(T.why.teamOverride('Tổ CT số 2'));
    expect(grantWhy(grant({ source: GRANT_SOURCE.USER_OVERRIDE }))).toBe(T.why.userOverride);
  });

  it('spells out what a scoped permission reaches, and nothing when it reaches everything', () => {
    expect(reachesDetail(VIEW.permissions[0].reaches)).toBe(`${T.reachesOwn}; Tổ CT số 2, Tổ 3; ${T.reachesUnassigned}`);
    expect(reachesDetail({ all: true, own: true, teams: [], unassigned: true })).toBeNull();
    expect(reachesDetail(null)).toBeNull();
  });

  it('leaves out what the person simply does not have, unless asked to show everything', () => {
    const lines = effectiveSections(RESOURCES, VIEW, false).flatMap((s) => s.lines.map((l) => l.permission));
    expect(lines).toEqual(['read:Petition', 'delete:Petition', 'read:Calendar']);
    const all = effectiveSections(RESOURCES, VIEW, true);
    expect(all).toHaveLength(RESOURCES.length);
    expect(all[0].lines.find((l) => l.permission === 'edit:Petition')).toMatchObject({ held: false, reach: L.reachNone, why: T.why.none });
  });
});

describe('LookupTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    officers.value = {
      data: [
        { value: 'u1', label: 'Nguyễn Văn A', teams: [] },
        { value: 'u2', label: 'Trần Thị B', teams: [] },
      ],
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    };
    api.effective.mockResolvedValue(VIEW);
    api.userOverrides.mockResolvedValue(OWN);
  });

  it('asks to pick a person first, and narrows the list by name', async () => {
    renderTab();
    expect(screen.getByText(T.prompt)).toBeInTheDocument();
    expect(api.effective).not.toHaveBeenCalled();
    fireEvent.change(el('lookup-search'), { target: { value: 'trần' } });
    expect([...el('lookup-user').options].map((o) => o.textContent)).toEqual([T.pickPlaceholder, 'Trần Thị B']);
  });

  it('shows the teams, and per permission how far and why, in plain words', async () => {
    renderTab();
    fireEvent.change(el('lookup-user'), { target: { value: 'u1' } });
    expect(await screen.findByTestId('lookup-teams')).toHaveTextContent(T.teams('Tổ CT số 2'));
    expect(api.effective).toHaveBeenCalledWith('u1');

    const view = screen.getByTestId('lookup-line-read:Petition');
    expect(view).toHaveTextContent('Đơn thư · Xem: Cả tổ ← vì: Tổ CT số 2, mẫu "Lãnh đạo tổ" (tổ trưởng)');
    expect(view).toHaveTextContent('Tổ CT số 2, Tổ 3');
    expect(view).toHaveTextContent(T.reachesUnassigned);
    expect(screen.getByTestId('lookup-line-delete:Petition')).toHaveTextContent(`Đơn thư · Xoá: Không ← vì: ${T.why.mutedByTeam('Tổ X')}`);
    expect(screen.getByTestId('lookup-line-read:Calendar')).toHaveTextContent(`Lịch · Xem: Có ← vì: ${T.why.role}`);
    expect(screen.queryByTestId('lookup-line-edit:Petition')).toBeNull();

    fireEvent.click(el('lookup-show-all'));
    expect(screen.getByTestId('lookup-line-edit:Petition')).toHaveTextContent(`Đơn thư · Sửa: Không ← vì: ${T.why.none}`);
  });

  it('opens on the person named in the link, even one who is not in the list', async () => {
    renderTab(true, 'u9');
    await screen.findByTestId('lookup-effective');
    expect(api.effective).toHaveBeenCalledWith('u9');
    expect(el('lookup-user').value).toBe('u9');
  });

  it('a failed look-up shows the error with a retry, not "has no permissions"', async () => {
    api.effective.mockRejectedValueOnce(apiError(500, 'INTERNAL'));
    renderTab(true, 'u1');
    expect(await screen.findByTestId('lookup-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('lookup-nothing')).toBeNull();
    fireEvent.click(screen.getByTestId('lookup-load-error-retry'));
    expect(await screen.findByTestId('lookup-effective')).toBeInTheDocument();
  });

  it('a failed list of people is said, with a retry', () => {
    const refetch = vi.fn();
    officers.value = { data: undefined, isError: true, error: new Error('mất mạng'), isFetching: false, refetch };
    renderTab();
    expect(screen.getByTestId('lookup-people-error')).toHaveTextContent('mất mạng');
    fireEvent.click(screen.getByTestId('lookup-people-error-retry'));
    expect(refetch).toHaveBeenCalled();
  });

  it("saves the person's own overrides as the whole list, with the token it was read at", async () => {
    api.saveUserOverrides.mockResolvedValue({ changed: true, changeSetId: 'cs' });
    renderTab(true, 'u1');
    expect(await screen.findByTestId('user-override-0-row')).toBeInTheDocument();
    expect(el('user-override-0-permission').value).toBe('read:Case');
    expect(screen.queryByTestId('user-override-0-audience')).toBeNull();
    expect(screen.getByTestId('user-overrides-save')).toBeDisabled();

    fireEvent.click(screen.getByTestId('user-override-add'));
    fireEvent.change(el('user-override-1-permission'), { target: { value: 'read:Calendar' } });
    fireEvent.change(el('user-override-1-reason'), { target: { value: ' Trực ban ' } });
    fireEvent.click(screen.getByTestId('user-overrides-save'));

    await waitFor(() =>
      expect(api.saveUserOverrides).toHaveBeenCalledWith('u1', {
        overrides: [OWN.overrides[0], { permission: 'read:Calendar', effect: EFFECT.GRANT, reach: REACH.ALL, reason: 'Trực ban', expiresAt: null }],
        expectedToken: 'tok-1',
      }),
    );
    expect(await screen.findByTestId('user-overrides-notice')).toHaveTextContent(L.common.saved);
  });

  it('removing every row and saving sends an empty list', async () => {
    api.saveUserOverrides.mockResolvedValue({ changed: true, changeSetId: 'cs' });
    renderTab(true, 'u1');
    fireEvent.click(await screen.findByTestId('user-override-0-remove'));
    fireEvent.click(screen.getByTestId('user-overrides-save'));
    await waitFor(() => expect(api.saveUserOverrides).toHaveBeenCalledWith('u1', { overrides: [], expectedToken: 'tok-1' }));
  });

  it('a stale token: the translated message and a reload that reads the overrides again', async () => {
    api.saveUserOverrides.mockRejectedValue(apiError(409, AUTHZ_ERROR.REVISION_CONFLICT, [{ type: 'user', id: 'u1' }]));
    renderTab(true, 'u1');
    fireEvent.click(await screen.findByTestId('user-override-0-remove'));
    fireEvent.click(screen.getByTestId('user-overrides-save'));
    expect(await screen.findByTestId('user-overrides-error')).toHaveTextContent(L.errors.REVISION_CONFLICT);

    api.userOverrides.mockResolvedValue({ ...OWN, token: 'tok-2' });
    fireEvent.click(screen.getByTestId('user-overrides-error-reload'));
    await waitFor(() => expect(api.userOverrides).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('user-override-0-row')).toBeInTheDocument();
    expect(screen.queryByTestId('user-overrides-error')).toBeNull();
  });

  it('an invalid list names the reasons', async () => {
    api.saveUserOverrides.mockRejectedValue(apiError(400, AUTHZ_ERROR.INVALID, [{ code: PROBLEM.OVERRIDE_EXPIRED, permission: 'read:Case' }]));
    renderTab(true, 'u1');
    await screen.findByTestId('user-override-0-row');
    fireEvent.change(el('user-override-0-reason'), { target: { value: 'Khác' } });
    fireEvent.click(screen.getByTestId('user-overrides-save'));
    expect(await screen.findByTestId('user-overrides-error-reasons')).toHaveTextContent(L.problems.OVERRIDE_EXPIRED('Vụ án · Xem', '', ''));
  });

  it("a failed load of the person's overrides is an error with a retry, not an empty list", async () => {
    api.userOverrides.mockRejectedValueOnce(apiError(404, AUTHZ_ERROR.USER_NOT_FOUND));
    renderTab(true, 'u1');
    expect(await screen.findByTestId('user-overrides-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('user-override-empty')).toBeNull();
    expect(screen.queryByTestId('user-overrides-save')).toBeNull();
    fireEvent.click(screen.getByTestId('user-overrides-load-error-retry'));
    expect(await screen.findByTestId('user-override-0-row')).toBeInTheDocument();
  });

  it('without the right to change, the overrides are read-only', async () => {
    renderTab(false, 'u1');
    expect(await screen.findByTestId('user-override-0-permission')).toBeDisabled();
    for (const id of ['user-overrides-save', 'user-override-add', 'user-override-0-remove', 'user-overrides-reason']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });
});
