import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { TeamsTab } from '../components/TeamsTab';
import { flattenTeams, teamChip } from '../teamTree';
import { permissionsApi } from '../api';
import { permissions as L } from '@/locales/permissions.vi';
import { AUDIENCE, AUTHZ_ERROR, EFFECT, PROBLEM, REACH, TEAM_MODE } from '../types';
import { apiError } from './fixtures';
import { INDEX, TEAMS, TEMPLATES, renderWithClient } from './harness';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  permissionsApi: {
    teams: vi.fn(),
    templates: vi.fn(),
    saveTeam: vi.fn(),
    removeTeamConfig: vi.fn(),
    applyTeams: vi.fn(),
    preview: vi.fn(),
  },
}));

const api = vi.mocked(permissionsApi);
const OK = { changed: true, changeSetId: 'cs1' };
const T = L.teams;
const renderTab = (canWrite = true, initialTeamId?: string) =>
  renderWithClient(<TeamsTab index={INDEX} canWrite={canWrite} initialTeamId={initialTeamId} />);
const el = (id: string) => screen.getByTestId(id) as HTMLInputElement & HTMLSelectElement;
const PREVIEW = {
  people: 40,
  teamNames: { a: 'Tổ A', b: 'Tổ B' },
  impacts: [
    {
      userId: 'u1',
      name: 'Nguyễn Văn A',
      gained: [{ permission: 'delete:Petition', before: null, after: REACH.TEAM_TREE }],
      lost: [{ permission: 'read:Calendar', before: REACH.ALL, after: null }],
      changed: [{ permission: 'read:Case', before: REACH.TEAM, after: REACH.TEAM, teamsGained: ['b'], teamsLost: ['a'] }],
    },
  ],
};

describe('team tree helpers', () => {
  it('orders children under their parent with a depth; an orphan is a root', () => {
    const flat = flattenTeams([...TEAMS, { ...TEAMS[1], teamId: 'lost', name: 'Aaa', parentId: 'gone' }]);
    expect(flat.map((r) => [r.team.teamId, r.depth])).toEqual([
      ['lost', 0],
      ['doi', 0],
      ['to2', 1],
      ['phuong', 0],
    ]);
  });

  it('a cycle of parents still lists every team', () => {
    const a = { ...TEAMS[2], teamId: 'a', parentId: 'b' };
    const b = { ...TEAMS[2], teamId: 'b', parentId: 'a' };
    expect(flattenTeams([a, b]).map((r) => r.team.teamId).sort()).toEqual(['a', 'b']);
  });

  it('says where a team gets its permissions from', () => {
    expect(teamChip(TEAMS[0])).toEqual({ text: T.chipExplicit, own: true });
    expect(teamChip(TEAMS[1])).toEqual({ text: T.chipInherit('Đội 2'), own: false });
    expect(teamChip(TEAMS[2])).toEqual({ text: T.chipRole, own: false });
  });
});

describe('TeamsTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.teams.mockResolvedValue(TEAMS);
    api.templates.mockResolvedValue(TEMPLATES);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it('shows the tree with a chip per team, children indented', async () => {
    renderTab();
    expect(await screen.findByTestId('team-chip-doi')).toHaveTextContent(T.chipExplicit);
    expect(screen.getByTestId('team-chip-to2')).toHaveTextContent(T.chipInherit('Đội 2'));
    expect(screen.getByTestId('team-chip-phuong')).toHaveTextContent(T.chipRole);
    expect(screen.getByTestId('team-row-to2')).toHaveAttribute('data-depth', '1');
    expect(screen.queryByTestId('team-config-panel')).toBeNull();
  });

  it('a failed load shows the error with a retry, never "no teams"', async () => {
    api.teams.mockRejectedValueOnce(apiError(500, 'INTERNAL'));
    renderTab();
    expect(await screen.findByTestId('teams-load-error')).toBeInTheDocument();
    expect(screen.queryByText(T.empty)).toBeNull();

    fireEvent.click(screen.getByTestId('teams-load-error-retry'));
    expect(await screen.findByTestId('team-row-doi')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('teams-load-error')).toBeNull());
  });

  it('opens on the team named in the link, with its templates; an archived template is offered only where it is already chosen', async () => {
    api.teams.mockResolvedValue([{ ...TEAMS[0], config: { ...TEAMS[0].config!, leaderTemplateId: 'tpl-old' } }, TEAMS[1], TEAMS[2]]);
    renderTab(true, 'doi');
    await screen.findByTestId('team-config-panel');
    expect(el('team-mode-EXPLICIT').checked).toBe(true);
    expect(el('team-member-template').value).toBe('tpl-entry');
    expect(el('team-leader-template').value).toBe('tpl-old');
    const names = (id: string) => [...el(id).options].map((o) => o.textContent);
    expect(names('team-leader-template')).toContain(`Mẫu cũ ${T.archivedSuffix}`);
    expect(names('team-member-template')).not.toContain(`Mẫu cũ ${T.archivedSuffix}`);
    expect(names('team-leader-template')[0]).toBe(T.sameAsMember);
  });

  it('a team that follows another says whom; one nobody governs says "as today"', async () => {
    renderTab();
    fireEvent.click(await screen.findByTestId('team-row-to2'));
    expect(screen.getByTestId('team-inherit-note')).toHaveTextContent(T.inheritFrom('Đội 2'));
    expect(screen.queryByTestId('team-member-template')).toBeNull();
    fireEvent.click(screen.getByTestId('team-row-phuong'));
    expect(screen.getByTestId('team-inherit-note')).toHaveTextContent(T.inheritRole);
    expect(screen.queryByTestId('team-remove-own')).toBeNull();
  });

  it('saving sends the whole configuration with the revision it was read at (0 for a team without one)', async () => {
    api.saveTeam.mockResolvedValue(OK);
    renderTab();
    fireEvent.click(await screen.findByTestId('team-row-to2'));
    expect(screen.getByTestId('team-save')).toBeDisabled();
    fireEvent.click(el('team-mode-EXPLICIT'));
    fireEvent.change(el('team-member-template'), { target: { value: 'tpl-entry' } });
    expect(screen.getByTestId('team-unsaved')).toBeInTheDocument();
    fireEvent.change(el('team-reason'), { target: { value: ' Tách quyền ' } });
    fireEvent.click(screen.getByTestId('team-save'));

    await waitFor(() =>
      expect(api.saveTeam).toHaveBeenCalledWith('to2', {
        mode: TEAM_MODE.EXPLICIT,
        memberTemplateId: 'tpl-entry',
        leaderTemplateId: null,
        overrides: [],
        expectedRevision: 0,
        reason: 'Tách quyền',
      }),
    );
    expect(await screen.findByTestId('teams-notice')).toHaveTextContent(L.common.saved);
  });

  it('overrides sit behind Nâng cao and are sent as rows', async () => {
    api.saveTeam.mockResolvedValue(OK);
    renderTab(true, 'doi');
    await screen.findByTestId('team-config-panel');
    expect(screen.queryByTestId('team-advanced')).toBeNull();
    fireEvent.click(screen.getByTestId('team-advanced-toggle'));
    fireEvent.click(screen.getByTestId('team-override-add'));
    fireEvent.change(el('team-override-0-permission'), { target: { value: 'delete:Petition' } });
    fireEvent.change(el('team-override-0-reach'), { target: { value: REACH.OWN } });
    fireEvent.change(el('team-override-0-audience'), { target: { value: AUDIENCE.LEADER } });
    fireEvent.change(el('team-override-0-reason'), { target: { value: 'Trực thay' } });
    fireEvent.click(screen.getByTestId('team-override-add'));
    fireEvent.change(el('team-override-1-permission'), { target: { value: 'read:Calendar' } });
    fireEvent.change(el('team-override-1-effect'), { target: { value: EFFECT.MUTE } });
    expect(screen.queryByTestId('team-override-1-reach')).toBeNull();
    fireEvent.click(screen.getByTestId('team-save'));

    await waitFor(() => expect(api.saveTeam).toHaveBeenCalledTimes(1));
    expect(api.saveTeam.mock.calls[0]).toEqual([
      'doi',
      {
        mode: TEAM_MODE.EXPLICIT,
        memberTemplateId: 'tpl-entry',
        leaderTemplateId: 'tpl-lead',
        overrides: [
          { permission: 'delete:Petition', effect: EFFECT.GRANT, reach: REACH.OWN, reason: 'Trực thay', expiresAt: null, audience: AUDIENCE.LEADER },
          { permission: 'read:Calendar', effect: EFFECT.MUTE, reach: null, reason: '', expiresAt: null, audience: AUDIENCE.ALL },
        ],
        expectedRevision: 4,
      },
    ]);
  });

  it('preview says how many people are touched and what each gains, loses and keeps differently', async () => {
    api.preview.mockResolvedValue(PREVIEW);
    renderTab(true, 'doi');
    await screen.findByTestId('team-config-panel');
    fireEvent.change(el('team-leader-template'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('team-preview-btn'));

    expect(await screen.findByTestId('team-preview-count')).toHaveTextContent(L.preview.affected(1, 40));
    expect(api.preview).toHaveBeenCalledWith({
      teams: [{ teamId: 'doi', config: { mode: TEAM_MODE.EXPLICIT, memberTemplateId: 'tpl-entry', leaderTemplateId: null, overrides: [] } }],
    });
    const person = screen.getByTestId('team-preview-person-u1');
    expect(person).toHaveTextContent('Nguyễn Văn A');
    expect(person).toHaveTextContent(`${L.preview.gained}: Đơn thư · Xoá (Cả tổ)`);
    expect(person).toHaveTextContent(`${L.preview.lost}: Lịch · Xem (Có)`);
    expect(person).toHaveTextContent('Vụ án · Xem: vẫn là Chỉ đúng tổ, thêm Tổ B, bớt Tổ A');
    expect(api.saveTeam).not.toHaveBeenCalled();
  });

  it('somebody else changed it: the translated message and a reload that fetches the teams again', async () => {
    api.saveTeam.mockRejectedValue(apiError(409, AUTHZ_ERROR.REVISION_CONFLICT, [{ type: 'team', id: 'doi' }]));
    renderTab(true, 'doi');
    await screen.findByTestId('team-config-panel');
    fireEvent.change(el('team-leader-template'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('team-save'));

    expect(await screen.findByTestId('team-error')).toHaveTextContent(L.errors.REVISION_CONFLICT);
    fireEvent.click(screen.getByTestId('team-error-reload'));
    await waitFor(() => expect(api.teams).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByTestId('team-error')).toBeNull());
    expect(el('team-leader-template').value).toBe('tpl-lead');
  });

  it('an invalid change lists the reasons in plain words', async () => {
    api.saveTeam.mockRejectedValue(
      apiError(400, AUTHZ_ERROR.INVALID, [
        { code: PROBLEM.TEMPLATE_ARCHIVED, templateId: 'tpl-old', type: 'team', id: 'doi' },
        { code: PROBLEM.OVERRIDE_REASON_REQUIRED, permission: 'read:Calendar' },
      ]),
    );
    renderTab(true, 'doi');
    await screen.findByTestId('team-config-panel');
    fireEvent.change(el('team-leader-template'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('team-save'));
    const reasons = await screen.findByTestId('team-error-reasons');
    expect(reasons).toHaveTextContent(L.problems.TEMPLATE_ARCHIVED('', '', ''));
    expect(reasons).toHaveTextContent(L.problems.OVERRIDE_REASON_REQUIRED('Lịch · Xem', '', ''));
  });

  it('"Bỏ thiết lập riêng" asks first, then removes the team\'s own configuration', async () => {
    api.removeTeamConfig.mockResolvedValue(OK);
    renderTab(true, 'doi');
    fireEvent.click(await screen.findByTestId('team-remove-own'));
    expect(window.confirm).toHaveBeenCalledWith(T.confirmRemove('Đội 2'));
    await waitFor(() => expect(api.removeTeamConfig).toHaveBeenCalledWith('doi', 4)); // with the revision that was read
    expect(await screen.findByTestId('teams-notice')).toHaveTextContent(T.removed);
  });

  it('"Chép từ tổ…" fills the form from another team without saving', async () => {
    renderTab();
    fireEvent.click(await screen.findByTestId('team-row-phuong'));
    fireEvent.change(el('team-copy-from'), { target: { value: 'doi' } });
    expect(el('team-mode-EXPLICIT').checked).toBe(true);
    expect(el('team-member-template').value).toBe('tpl-entry');
    expect(screen.getByTestId('team-copied')).toHaveTextContent(T.copied('Đội 2'));
    expect(screen.getByTestId('team-unsaved')).toBeInTheDocument();
    expect(api.saveTeam).not.toHaveBeenCalled();
  });

  it('"Áp cho nhiều tổ…" needs a preview of the very selection, then sends every team\'s revision', async () => {
    api.preview.mockResolvedValue({ people: 40, impacts: [] });
    api.applyTeams.mockResolvedValue(OK);
    renderTab(true, 'doi');
    fireEvent.click(await screen.findByTestId('team-apply-many'));
    expect(el('team-apply-pick-doi').checked).toBe(true);
    fireEvent.click(el('team-apply-pick-phuong'));
    expect(screen.getByTestId('team-apply-confirm')).toBeDisabled();

    fireEvent.click(screen.getByTestId('team-apply-preview-btn'));
    expect(await screen.findByTestId('team-apply-preview-count')).toHaveTextContent(L.preview.nobody(40));
    const config = { mode: TEAM_MODE.EXPLICIT, memberTemplateId: 'tpl-entry', leaderTemplateId: 'tpl-lead', overrides: [] };
    expect(api.preview).toHaveBeenCalledWith({ teams: [{ teamId: 'doi', config }, { teamId: 'phuong', config }] });

    // Another selection: the preview no longer counts.
    fireEvent.click(el('team-apply-pick-to2'));
    expect(screen.getByTestId('team-apply-confirm')).toBeDisabled();
    fireEvent.click(el('team-apply-pick-to2'));
    fireEvent.click(screen.getByTestId('team-apply-confirm'));

    await waitFor(() =>
      expect(api.applyTeams).toHaveBeenCalledWith({ teamIds: ['doi', 'phuong'], config, expected: { doi: 4, phuong: 0 } }),
    );
    expect(await screen.findByTestId('teams-notice')).toHaveTextContent(T.applied(2));
  });

  it('a refused apply is explained inside the dialog', async () => {
    api.preview.mockResolvedValue({ people: 40, impacts: [] });
    api.applyTeams.mockRejectedValue(apiError(400, AUTHZ_ERROR.EXPECTED_REVISION_REQUIRED));
    renderTab(true, 'doi');
    fireEvent.click(await screen.findByTestId('team-apply-many'));
    fireEvent.click(screen.getByTestId('team-apply-preview-btn'));
    await screen.findByTestId('team-apply-preview-count');
    fireEvent.click(screen.getByTestId('team-apply-confirm'));
    expect(await screen.findByTestId('team-apply-error')).toHaveTextContent(L.errors.EXPECTED_REVISION_REQUIRED);
    expect(screen.getByTestId('team-apply-error-reload')).toBeInTheDocument();
  });

  it('without the right to change: the configuration can be read and previewed, nothing can be written', async () => {
    renderTab(false, 'doi');
    await screen.findByTestId('team-config-panel');
    expect(el('team-member-template')).toBeDisabled();
    expect(screen.getByTestId('team-preview-btn')).toBeInTheDocument();
    for (const id of ['team-save', 'team-remove-own', 'team-apply-many', 'team-copy-from', 'team-reason']) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });
});
