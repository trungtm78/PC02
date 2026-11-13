import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { TemplatesTab } from '../components/TemplatesTab';
import { permissionsApi } from '../api';
import { permissions as L } from '@/locales/permissions.vi';
import { AUTHZ_ERROR, PROBLEM, REACH } from '../types';
import { RESOURCES, apiError } from './fixtures';
import { INDEX, TEMPLATES, renderWithClient } from './harness';

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  permissionsApi: {
    templates: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    copyTemplate: vi.fn(),
    archiveTemplate: vi.fn(),
    restoreTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    preview: vi.fn(),
    createStarterTemplates: vi.fn(),
  },
}));

const api = vi.mocked(permissionsApi);
const OK = { changed: true, changeSetId: 'cs1' };
const renderTab = (canWrite = true) => renderWithClient(<TemplatesTab resources={RESOURCES} index={INDEX} canWrite={canWrite} />);
const box = (id: string) => screen.getByTestId(id) as HTMLInputElement;

describe('TemplatesTab', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.templates.mockResolvedValue(TEMPLATES);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });
  afterEach(() => vi.restoreAllMocks());

  it('lists the templates in use with how many teams use each, and the archived ones behind the filter', async () => {
    renderTab();
    const row = await screen.findByTestId('template-row-tpl-entry');
    expect(row).toHaveTextContent('Cán bộ nhập liệu');
    expect(row).toHaveTextContent(L.templates.usedBy(2));
    expect(screen.queryByTestId('template-row-tpl-old')).toBeNull();
    expect(screen.getByTestId('templates-filter-ACTIVE')).toHaveTextContent('(2)');

    fireEvent.click(screen.getByTestId('templates-filter-ARCHIVED'));
    expect(screen.getByTestId('template-row-tpl-old')).toBeInTheDocument();
    expect(screen.getByTestId('template-restore-tpl-old')).toBeInTheDocument();
  });

  it('a failed load shows the error with a retry, never "no templates yet"', async () => {
    api.templates.mockRejectedValueOnce(apiError(500, 'INTERNAL'));
    renderTab();
    expect(await screen.findByTestId('templates-load-error')).toBeInTheDocument();
    expect(screen.queryByText(L.templates.empty.ACTIVE)).toBeNull();
    expect(screen.getByTestId('templates-empty')).toHaveTextContent(L.templates.notLoaded);

    api.templates.mockResolvedValue(TEMPLATES);
    fireEvent.click(screen.getByTestId('templates-load-error-retry'));
    expect(await screen.findByTestId('template-row-tpl-entry')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('templates-load-error')).toBeNull());
  });

  it('without the right to change, there is no add, copy, archive or delete: only a look', async () => {
    renderTab(false);
    await screen.findByTestId('template-row-tpl-entry');
    expect(screen.queryByTestId('template-add')).toBeNull();
    expect(screen.queryByTestId('template-copy-tpl-entry')).toBeNull();
    expect(screen.queryByTestId('template-archive-tpl-entry')).toBeNull();
    expect(screen.queryByTestId('template-delete-tpl-entry')).toBeNull();

    fireEvent.click(screen.getByTestId('template-edit-tpl-entry'));
    expect(screen.queryByTestId('template-save')).toBeNull();
    expect(box('perm-view-petitions-OWN')).toBeDisabled();
  });

  describe('starter templates', () => {
    const STARTERS = [
      { id: 's1', code: 'STARTER_AS_TODAY' },
      { id: 's2', code: 'STARTER_OWN_ONLY' },
      { id: 's3', code: 'STARTER_VIEW_ONLY' },
    ];

    it('without the right to change there is no button and no hint', async () => {
      renderTab(false);
      await screen.findByTestId('template-row-tpl-entry');
      expect(screen.queryByTestId('template-starters')).toBeNull();
      expect(screen.queryByTestId('template-starters-hint')).toBeNull();
    });

    it('creates them, says how many were made, and loads the list again', async () => {
      api.createStarterTemplates.mockResolvedValue({ ...OK, created: STARTERS, existing: [] });
      renderTab();
      const button = await screen.findByTestId('template-starters');
      expect(button).toHaveTextContent(L.templates.starters);
      expect(screen.getByTestId('template-starters-hint')).toHaveTextContent(L.templates.startersHint);
      await screen.findByTestId('template-row-tpl-entry');

      fireEvent.click(button);
      await waitFor(() => expect(api.createStarterTemplates).toHaveBeenCalledTimes(1));
      expect(await screen.findByTestId('templates-notice')).toHaveTextContent(L.templates.startersCreated(3));
      await waitFor(() => expect(api.templates).toHaveBeenCalledTimes(2));
    });

    it('counts only the ones made this time', async () => {
      api.createStarterTemplates.mockResolvedValue({ ...OK, created: STARTERS.slice(0, 1), existing: ['STARTER_OWN_ONLY', 'STARTER_VIEW_ONLY'] });
      renderTab();
      fireEvent.click(await screen.findByTestId('template-starters'));
      expect(await screen.findByTestId('templates-notice')).toHaveTextContent(L.templates.startersCreated(1));
    });

    it('says they are already there when nothing was made', async () => {
      api.createStarterTemplates.mockResolvedValue({ changed: false, changeSetId: null, created: [], existing: STARTERS.map((s) => s.code) });
      renderTab();
      fireEvent.click(await screen.findByTestId('template-starters'));
      const notice = await screen.findByTestId('templates-notice');
      expect(notice).toHaveTextContent(L.templates.startersExisting);
      expect(notice).not.toHaveTextContent(L.templates.startersCreated(0));
    });

    it('a missing officer role is explained in words, not as a code', async () => {
      api.createStarterTemplates.mockRejectedValue(apiError(404, AUTHZ_ERROR.STARTER_ROLE_NOT_FOUND));
      renderTab();
      fireEvent.click(await screen.findByTestId('template-starters'));
      const error = await screen.findByTestId('templates-error');
      expect(error).toHaveTextContent(L.errors.STARTER_ROLE_NOT_FOUND);
      expect(error).not.toHaveTextContent(AUTHZ_ERROR.STARTER_ROLE_NOT_FOUND);
      expect(screen.queryByTestId('templates-notice')).toBeNull();
    });

    it('an invalid starter lists the reasons in plain words', async () => {
      api.createStarterTemplates.mockRejectedValue(apiError(400, AUTHZ_ERROR.INVALID, [{ code: PROBLEM.ABOVE_OWN, permission: 'delete:User' }]));
      renderTab();
      fireEvent.click(await screen.findByTestId('template-starters'));
      expect(await screen.findByTestId('templates-error-reasons')).toHaveTextContent(L.problems.ABOVE_OWN('Người dùng · Xoá', '', ''));
    });
  });

  it('creating: the matrix keeps "no wider than view", and the exact document is sent', async () => {
    api.createTemplate.mockResolvedValue({ ...OK, id: 'new' });
    renderTab();
    fireEvent.click(await screen.findByTestId('template-add'));

    expect(box('perm-cap-petitions-edit')).toBeDisabled();
    fireEvent.click(box('perm-view-petitions-ALL'));
    fireEvent.click(box('perm-cap-petitions-edit'));
    fireEvent.click(box('perm-view-petitions-OWN'));
    fireEvent.click(box('perm-view-calendar'));
    fireEvent.change(box('template-name'), { target: { value: '  Cán bộ mới ' } });
    fireEvent.click(screen.getByTestId('template-save'));

    await waitFor(() =>
      expect(api.createTemplate).toHaveBeenCalledWith({
        name: 'Cán bộ mới',
        description: null,
        entries: { 'read:Petition': REACH.OWN, 'edit:Petition': REACH.OWN, 'read:Calendar': REACH.ALL },
      }),
    );
    expect(await screen.findByTestId('templates-notice')).toHaveTextContent(L.templates.done.created);
  });

  it('a template without a name is not sent', async () => {
    renderTab();
    fireEvent.click(await screen.findByTestId('template-add'));
    fireEvent.click(screen.getByTestId('template-save'));
    expect(screen.getByTestId('template-local-error')).toHaveTextContent(L.editor.nameRequired);
    expect(api.createTemplate).not.toHaveBeenCalled();
  });

  it('group and column ticks fill the matrix', async () => {
    renderTab();
    fireEvent.click(await screen.findByTestId('template-add'));
    fireEvent.click(box('perm-group-business'));
    expect(box('perm-view-petitions-TEAM_TREE').checked).toBe(true);
    expect(box('perm-view-calendar').checked).toBe(true);
    fireEvent.click(box('perm-col-delete'));
    expect(box('perm-cap-petitions-delete').checked).toBe(true);
    expect(box('perm-cap-users-delete').checked).toBe(false);
  });

  it('"exactly this team" appears only under Nâng cao', async () => {
    renderTab();
    fireEvent.click(await screen.findByTestId('template-add'));
    expect(screen.queryByTestId('perm-view-petitions-TEAM')).toBeNull();
    fireEvent.click(screen.getByTestId('template-advanced'));
    expect(screen.getByTestId('perm-view-petitions-TEAM')).toBeInTheDocument();
  });

  it('editing sends the whole document with the revision it was read at', async () => {
    api.updateTemplate.mockResolvedValue(OK);
    renderTab();
    fireEvent.click(await screen.findByTestId('template-edit-tpl-entry'));
    expect(box('perm-view-petitions-OWN').checked).toBe(true);
    expect(screen.getByTestId('template-save')).toBeDisabled();

    fireEvent.click(box('perm-cap-petitions-delete'));
    expect(screen.getByTestId('template-unsaved')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('template-save'));

    await waitFor(() =>
      expect(api.updateTemplate).toHaveBeenCalledWith('tpl-entry', {
        name: 'Cán bộ nhập liệu',
        description: 'Nhập và sửa hồ sơ của mình',
        entries: { 'read:Petition': REACH.OWN, 'write:Petition': REACH.OWN, 'delete:Petition': REACH.OWN },
        expectedRevision: 3,
      }),
    );
  });

  it('a newly ticked sensitive permission is marked and cannot be saved without a reason', async () => {
    api.updateTemplate.mockResolvedValue(OK);
    renderTab();
    fireEvent.click(await screen.findByTestId('template-edit-tpl-lead'));
    expect(screen.getByTestId('perm-row-users')).toHaveTextContent(L.matrix.sensitive);
    // Already-held sensitive permissions ask for nothing.
    expect(screen.queryByTestId('template-sensitive-note')).toBeNull();

    fireEvent.click(box('perm-cap-users-delete'));
    expect(screen.getByTestId('template-sensitive-note')).toHaveTextContent('Người dùng · Xoá');
    fireEvent.click(screen.getByTestId('template-save'));
    expect(screen.getByTestId('template-local-error')).toHaveTextContent(L.common.reasonMissing);
    expect(api.updateTemplate).not.toHaveBeenCalled();

    fireEvent.change(box('template-reason'), { target: { value: 'Tổ trưởng quản lý tài khoản' } });
    fireEvent.click(screen.getByTestId('template-save'));
    await waitFor(() => expect(api.updateTemplate).toHaveBeenCalledTimes(1));
    expect(api.updateTemplate.mock.calls[0][1]).toMatchObject({ reason: 'Tổ trưởng quản lý tài khoản', expectedRevision: 1 });
  });

  it('somebody else changed it: the translated message and a reload that fetches the list again', async () => {
    api.updateTemplate.mockRejectedValue(apiError(409, AUTHZ_ERROR.REVISION_CONFLICT, [{ type: 'template', id: 'tpl-entry' }]));
    renderTab();
    fireEvent.click(await screen.findByTestId('template-edit-tpl-entry'));
    fireEvent.click(box('perm-cap-petitions-delete'));
    fireEvent.click(screen.getByTestId('template-save'));

    expect(await screen.findByTestId('template-error')).toHaveTextContent(L.errors.REVISION_CONFLICT);
    expect(screen.getByTestId('template-editor')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('template-error-reload'));
    await waitFor(() => expect(api.templates).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('template-row-tpl-entry')).toBeInTheDocument();
  });

  it('an invalid change lists the reasons in plain words', async () => {
    api.updateTemplate.mockRejectedValue(
      apiError(400, AUTHZ_ERROR.INVALID, [
        { code: PROBLEM.ABOVE_OWN, permission: 'delete:Petition', type: 'template', id: 'tpl-entry' },
        { code: PROBLEM.WIDER_THAN_VIEW, permission: 'delete:Petition', reach: REACH.ALL, view: 'read:Petition', viewReach: REACH.OWN },
      ]),
    );
    renderTab();
    fireEvent.click(await screen.findByTestId('template-edit-tpl-entry'));
    fireEvent.click(box('perm-cap-petitions-delete'));
    fireEvent.click(screen.getByTestId('template-save'));

    const reasons = await screen.findByTestId('template-error-reasons');
    expect(reasons).toHaveTextContent(L.problems.ABOVE_OWN('Đơn thư · Xoá', '', ''));
    expect(reasons).toHaveTextContent(L.problems.WIDER_THAN_VIEW('Đơn thư · Xoá', 'Toàn bộ', 'Chỉ của mình'));
    expect(screen.queryByTestId('template-error-reload')).toBeNull();
  });

  it('copying asks for a name; a source holding a sensitive permission also needs a reason', async () => {
    api.copyTemplate.mockResolvedValue({ ...OK, id: 'copy' });
    renderTab();
    fireEvent.click(await screen.findByTestId('template-copy-tpl-entry'));
    expect(screen.queryByTestId('template-copy-reason')).toBeNull();
    fireEvent.click(screen.getByTestId('template-copy-confirm'));
    await waitFor(() => expect(api.copyTemplate).toHaveBeenCalledWith('tpl-entry', { name: L.templates.copyDefault('Cán bộ nhập liệu') }));

    fireEvent.click(await screen.findByTestId('template-copy-tpl-lead'));
    expect(screen.getByTestId('template-copy-confirm')).toBeDisabled();
    fireEvent.change(box('template-copy-name'), { target: { value: 'Lãnh đạo tổ 2' } });
    fireEvent.change(box('template-copy-reason'), { target: { value: 'Tách tổ' } });
    fireEvent.click(screen.getByTestId('template-copy-confirm'));
    await waitFor(() => expect(api.copyTemplate).toHaveBeenLastCalledWith('tpl-lead', { name: 'Lãnh đạo tổ 2', reason: 'Tách tổ' }));
  });

  it('archive and restore send the revision; archive asks first', async () => {
    api.archiveTemplate.mockResolvedValue(OK);
    api.restoreTemplate.mockResolvedValue(OK);
    renderTab();
    fireEvent.click(await screen.findByTestId('template-archive-tpl-entry'));
    expect(window.confirm).toHaveBeenCalledWith(L.templates.confirmArchive('Cán bộ nhập liệu'));
    await waitFor(() => expect(api.archiveTemplate).toHaveBeenCalledWith('tpl-entry', 3));

    fireEvent.click(screen.getByTestId('templates-filter-ARCHIVED'));
    fireEvent.click(screen.getByTestId('template-restore-tpl-old'));
    await waitFor(() => expect(api.restoreTemplate).toHaveBeenCalledWith('tpl-old', 5));
  });

  it('delete is offered only for a template no team uses; a refusal names the teams', async () => {
    api.deleteTemplate.mockRejectedValue(apiError(409, AUTHZ_ERROR.TEMPLATE_IN_USE, [{ teamId: 'to2', name: 'Tổ CT số 2' }]));
    renderTab();
    expect(await screen.findByTestId('template-delete-tpl-entry')).toBeDisabled();
    fireEvent.click(screen.getByTestId('template-delete-tpl-lead'));
    await waitFor(() => expect(api.deleteTemplate).toHaveBeenCalledWith('tpl-lead', 1)); // with the revision that was read
    const error = await screen.findByTestId('templates-error');
    expect(error).toHaveTextContent(L.errors.TEMPLATE_IN_USE);
    expect(error).toHaveTextContent('Tổ CT số 2');
  });

  it('declining the confirmation deletes nothing', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    renderTab();
    fireEvent.click(await screen.findByTestId('template-delete-tpl-lead'));
    expect(api.deleteTemplate).not.toHaveBeenCalled();
  });
});
