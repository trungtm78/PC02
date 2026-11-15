import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProcessingFlowEditorPage from '../ProcessingFlowEditorPage';
import { processingFlowApi } from '@/features/processing-flow/api';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { apiError, boundType, detail, detailPublished, stepDto, version, versionSummary } from '@/features/processing-flow/__tests__/fixtures';
import type { FlowDetailDto, SchedulePreviewDto } from '@/features/processing-flow/types';

vi.mock('@/features/processing-flow/api', () => ({
  processingFlowApi: {
    get: vi.fn(),
    update: vi.fn(),
    setBindings: vi.fn(),
    createDraft: vi.fn(),
    saveSteps: vi.fn(),
    deleteDraft: vi.fn(),
    publish: vi.fn(),
    verifyLegal: vi.fn(),
    unverifyLegal: vi.fn(),
    previewSchedule: vi.fn(),
  },
}));
vi.mock('@/features/processing-flow/useTeamChoices', () => ({
  useTeamChoices: () => ({ data: [{ id: 't5', name: 'Tổ 5' }, { id: 't9', name: 'Tổ 9' }] }),
}));
vi.mock('@/hooks/useDirectoryOptions', () => ({
  useDirectoryOptions: () => ({ data: [{ value: 'd-new', label: 'Tin báo (TB)' }, { value: 'd-Khiếu nại', label: 'Khiếu nại (KN)' }, { value: 'd-other', label: 'Phản ánh (PA)' }] }),
}));
vi.mock('@/hooks/useOfficerOptions', () => ({
  useOfficerOptions: () => ({ data: [{ value: 'u1', label: 'Phạm D', teams: [] }] }),
}));
const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissions: held.value }) }));

const api = vi.mocked(processingFlowApi);

const PREVIEW: SchedulePreviewDto = {
  steps: [{ stepIndex: 0, stepKey: 's1', startAt: '2026-11-30T17:00:00.000Z', dueAt: '2026-12-03T17:00:00.000Z', provisional: false, greenFrom: '2026-12-01T17:00:00.000Z', yellowFrom: '2026-12-02T17:00:00.000Z', redFrom: '2026-12-03T17:00:00.000Z', variant: null, problem: null }],
  recordDeadline: null,
  provisional: false,
  issues: [],
};

function renderPage(id = 'f1') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[`/admin/quy-trinh/${id}`]}>
        <Routes>
          <Route path="/admin/quy-trinh" element={<output data-testid="list-page" />} />
          <Route path="/admin/quy-trinh/:id" element={<ProcessingFlowEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** A flow with a draft, one step, nothing published. */
const DRAFT = (): FlowDetailDto => detail({ name: 'Khiếu nại', recordKind: 'PETITION' });

beforeEach(() => {
  vi.resetAllMocks();
  held.value = null;
  api.get.mockResolvedValue(DRAFT());
  api.previewSchedule.mockResolvedValue(PREVIEW);
});

const lastPreviewBody = () => api.previewSchedule.mock.calls.at(-1)?.[0];

describe('the editor of a draft', () => {
  it('shows the name, the record kind, the version number and its status, and the steps', async () => {
    renderPage();
    expect(await screen.findByTestId('editor-title')).toHaveTextContent('Khiếu nại');
    expect(screen.getByTestId('editor-record-kind')).toHaveTextContent('Đơn thư');
    expect(screen.getByTestId('editor-version-line')).toHaveTextContent('Phiên bản 1 · nháp');
    expect(screen.getByTestId('step-0-name')).toHaveValue('Tiếp nhận');
    expect(screen.getByTestId('step-0-anchor')).toHaveValue('RECEIVED');
    expect(screen.getByTestId('step-0-duration')).toHaveValue(3);
  });

  it('warns how many steps have not been compared with the source text', async () => {
    api.get.mockResolvedValue(
      detail({ draft: version({ id: 'v1', revision: 7 }, [stepDto({ stepKey: 'a' }), stepDto({ stepKey: 'b', legalVerifiedAt: '2026-11-01T03:00:00.000Z', legalVerifiedById: 'u1' }), stepDto({ stepKey: 'c' })]) }),
    );
    renderPage();
    expect(await screen.findByTestId('editor-unverified')).toHaveTextContent(L.editor.unverifiedWarning(2));
  });

  it('only offers the anchors valid for the kind of record', async () => {
    renderPage();
    const select = await screen.findByTestId('step-0-anchor');
    const values = within(select).getAllByRole('option').map((o) => (o as HTMLOptionElement).value);
    expect(values).not.toContain('PROSECUTED');
    expect(values).not.toContain('PREVIOUS_STEP_DONE'); // first step
    expect(values).toContain('ACCEPTED');
  });
});

describe('editing steps', () => {
  it('an edit goes into the next preview request (debounced), with the step as it is on screen', async () => {
    renderPage();
    await screen.findByTestId('step-0-name');
    await waitFor(() => expect(api.previewSchedule).toHaveBeenCalled());
    fireEvent.change(screen.getByTestId('step-0-duration'), { target: { value: '15' } });
    await waitFor(() => expect(lastPreviewBody()?.steps[0].durationValue).toBe(15), { timeout: 3000 });
    expect(lastPreviewBody()?.recordKind).toBe('PETITION');
    expect(lastPreviewBody()?.anchors).toMatchObject({ RECEIVED: '2026-12-01' });
  });

  it('"+ Thêm bước" copies the units, duration and thresholds of the row above', async () => {
    api.get.mockResolvedValue(detail({ draft: version({ id: 'v1', revision: 7 }, [stepDto({ stepKey: 'a', durationValue: 20, redDays: 1, yellowDays: 3, greenDays: 5 })]) }));
    renderPage();
    fireEvent.click(await screen.findByTestId('editor-add-step'));
    expect(screen.getByTestId('step-1-name')).toHaveValue(L.editor.steps.newStepName);
    expect(screen.getByTestId('step-1-duration')).toHaveValue(20);
    expect(screen.getByTestId('step-1-yellow')).toHaveValue(3);
    expect(screen.getByTestId('step-1-anchor')).toHaveValue('PREVIOUS_STEP_DONE');
  });

  it('▲▼ reorder the steps and the first / last arrows are disabled', async () => {
    api.get.mockResolvedValue(detail({ draft: version({ id: 'v1', revision: 7 }, [stepDto({ stepKey: 'a', name: 'Một' }), stepDto({ stepKey: 'b', name: 'Hai' })]) }));
    renderPage();
    await screen.findByTestId('step-0-name');
    expect(screen.getByTestId('step-0-up')).toBeDisabled();
    expect(screen.getByTestId('step-1-down')).toBeDisabled();
    fireEvent.click(screen.getByTestId('step-1-up'));
    expect(screen.getByTestId('step-0-name')).toHaveValue('Hai');
    expect(screen.getByTestId('step-1-name')).toHaveValue('Một');
  });

  it('only one step can be the deadline of the record', async () => {
    api.get.mockResolvedValue(detail({ draft: version({ id: 'v1', revision: 7 }, [stepDto({ stepKey: 'a', setsRecordDeadline: true }), stepDto({ stepKey: 'b' })]) }));
    renderPage();
    await screen.findByTestId('step-0-name');
    fireEvent.click(screen.getByTestId('step-1-general'));
    expect(screen.getByTestId('step-0-general')).not.toBeChecked();
    expect(screen.getByTestId('step-1-general')).toBeChecked();
  });

  it('a case shows the duration per gravity of the crime; a petition does not', async () => {
    api.get.mockResolvedValue(detail({ recordKind: 'CASE', draft: version({ id: 'v1', revision: 7 }, [stepDto({ stepKey: 'a' })]) }));
    renderPage();
    fireEvent.click(await screen.findByTestId('step-0-details-toggle'));
    fireEvent.click(screen.getByTestId('step-0-add-variant'));
    expect(screen.getByTestId('step-0-variant-0-gravity')).toHaveValue('IT_NGHIEM_TRONG');
    // The case offers the day of prosecution.
    expect(within(screen.getByTestId('step-0-anchor')).getAllByRole('option').map((o) => (o as HTMLOptionElement).value)).toContain('PROSECUTED');
  });

  it('a petition has no variants table', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('step-0-details-toggle'));
    expect(screen.queryByTestId('step-0-variants')).toBeNull();
  });
});

describe('saving the draft', () => {
  it('is disabled until something changed, then sends the steps with the revision of the VERSION and exactly the allowed fields', async () => {
    api.saveSteps.mockImplementation(async () => ({ flow: DRAFT(), warnings: [] }));
    renderPage();
    const save = await screen.findByTestId('editor-save');
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByTestId('step-0-name'), { target: { value: 'Xác minh' } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() => expect(api.saveSteps).toHaveBeenCalledTimes(1));
    const [flowId, versionId, steps, revision] = api.saveSteps.mock.calls[0];
    expect([flowId, versionId, revision]).toEqual(['f1', 'v1', 7]);
    expect(steps[0].name).toBe('Xác minh');
    expect(steps[0].stepKey).toBe('s1');
    for (const forbidden of ['order', 'legalVerifiedAt', 'legalVerifiedById', 'key', 'teamName']) expect(steps[0]).not.toHaveProperty(forbidden);
    expect(Object.keys(steps[0].parties[0]).sort()).toEqual(['note', 'partyKind', 'role']);
    expect(await screen.findByTestId('editor-message')).toHaveTextContent(L.editor.saved);
  });

  it('shows the issues the server returns as warnings, in words, by step', async () => {
    api.saveSteps.mockResolvedValue({ flow: DRAFT(), warnings: [{ code: 'STEP_NEEDS_ONE_MAIN', stepIndex: 0, stepKey: 's1' }, { code: 'FLOW_HAS_NO_STEPS' }] });
    renderPage();
    fireEvent.change(await screen.findByTestId('step-0-name'), { target: { value: 'X' } });
    fireEvent.click(screen.getByTestId('editor-save'));
    const box = await screen.findByTestId('editor-warnings');
    expect(box).toHaveTextContent(L.errors.STEP_NEEDS_ONE_MAIN);
    expect(box).toHaveTextContent(L.errors.FLOW_HAS_NO_STEPS);
    expect(box).toHaveTextContent('Bước 1');
  });

  it('every control is disabled while the save is pending', async () => {
    api.saveSteps.mockReturnValue(new Promise(() => undefined));
    renderPage();
    fireEvent.change(await screen.findByTestId('step-0-name'), { target: { value: 'X' } });
    fireEvent.click(screen.getByTestId('editor-save'));
    await waitFor(() => expect(screen.getByTestId('editor-save')).toBeDisabled());
    expect(screen.getByTestId('editor-publish')).toBeDisabled();
    expect(screen.getByTestId('editor-add-step')).toBeDisabled();
  });

  it('REVISION_CONFLICT says somebody else changed it, reloads the flow, shows what the person typed but lets nothing be saved over the newer version (found by Codex)', async () => {
    api.saveSteps.mockRejectedValue(apiError(409, 'REVISION_CONFLICT'));
    // The refresh after the conflict brings the version somebody else saved meanwhile: revision 8, another name.
    api.get
      .mockResolvedValueOnce(DRAFT())
      .mockResolvedValue(detail({ draft: version({ id: 'v1', revision: 8 }, [stepDto({ name: 'Của người khác' })]) }));
    renderPage();
    fireEvent.change(await screen.findByTestId('step-0-name'), { target: { value: 'Việc tôi vừa gõ' } });
    fireEvent.click(screen.getByTestId('editor-save'));
    const conflict = await screen.findByTestId('editor-conflict');
    expect(conflict).toHaveTextContent(L.conflict.title);
    await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(1));
    // What the person typed is still on screen to compare with...
    expect(screen.getByTestId('step-0-name')).toHaveValue('Việc tôi vừa gõ');
    // ...but it cannot be written: the newer revision was never looked at.
    await waitFor(() => expect(screen.getByTestId('editor-conflict-reload')).toBeEnabled());
    expect(screen.getByTestId('editor-save')).toBeDisabled();
    expect(screen.getByTestId('editor-publish')).toBeDisabled();
    expect(screen.getByTestId('step-0-name')).toBeDisabled();
    expect(screen.getByTestId('editor-add-step')).toBeDisabled();
    expect(api.saveSteps).toHaveBeenCalledTimes(1);

    // Taking the newer version is the person's explicit act: its contents replace the screen, and it can be edited again.
    fireEvent.click(screen.getByTestId('editor-conflict-reload'));
    expect(screen.getByTestId('step-0-name')).toHaveValue('Của người khác');
    expect(screen.queryByTestId('editor-conflict')).toBeNull();
    fireEvent.change(screen.getByTestId('step-0-name'), { target: { value: 'Sau khi tải lại' } });
    api.saveSteps.mockResolvedValue({ flow: DRAFT(), warnings: [] });
    fireEvent.click(screen.getByTestId('editor-save'));
    await waitFor(() => expect(api.saveSteps).toHaveBeenCalledTimes(2));
    expect(api.saveSteps.mock.calls[1][3]).toBe(8);
    expect(api.saveSteps.mock.calls[1][2][0].name).toBe('Sau khi tải lại');
  });

  it('a conflict on the bindings or the name also locks every write until the newer flow is taken', async () => {
    api.setBindings.mockRejectedValue(apiError(409, 'REVISION_CONFLICT'));
    renderPage();
    fireEvent.change(await screen.findByTestId('binding-add-type'), { target: { value: 'd-new' } });
    expect(await screen.findByTestId('editor-conflict')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('editor-conflict-reload')).toBeEnabled());
    expect(screen.getByTestId('editor-edit-meta')).toBeDisabled();
    expect(screen.getByTestId('binding-add-type')).toBeDisabled();
    expect(screen.getByTestId('step-0-name')).toBeDisabled();
  });

  it('a refresh that FAILS after a conflict keeps the form, says so inline and offers to try again (found by Codex)', async () => {
    api.saveSteps.mockRejectedValue(apiError(409, 'REVISION_CONFLICT'));
    api.get.mockResolvedValueOnce(DRAFT()).mockRejectedValueOnce(apiError(500, 'INTERNAL_ERROR'));
    renderPage();
    fireEvent.change(await screen.findByTestId('step-0-name'), { target: { value: 'Việc tôi vừa gõ' } });
    fireEvent.click(screen.getByTestId('editor-save'));
    expect(await screen.findByTestId('editor-conflict')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('editor-refresh-failed')).toBeInTheDocument());
    // The page did not turn into an error screen: the typed text is still there.
    expect(screen.queryByTestId('editor-load-error')).toBeNull();
    expect(screen.getByTestId('step-0-name')).toHaveValue('Việc tôi vừa gõ');

    // Trying again fetches once more; nothing is adopted until it has arrived and the person has taken it.
    api.get.mockResolvedValue(detail({ draft: version({ id: 'v1', revision: 9 }, [stepDto({ name: 'Bản mới' })]) }));
    fireEvent.click(screen.getByTestId('editor-conflict-reload'));
    await waitFor(() => expect(screen.queryByTestId('editor-refresh-failed')).toBeNull());
    fireEvent.click(screen.getByTestId('editor-conflict-reload'));
    expect(screen.getByTestId('step-0-name')).toHaveValue('Bản mới');
  });

  it('editing after the publish panel was opened closes the panel, and a publish never goes out over unsaved edits (found by Codex)', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('editor-publish'));
    expect(await screen.findByTestId('editor-publish-panel')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('step-0-name'), { target: { value: 'Sửa sau khi mở xác nhận' } });
    expect(screen.queryByTestId('editor-publish-panel')).toBeNull();
    expect(api.publish).not.toHaveBeenCalled();
    expect(screen.getByTestId('step-0-name')).toHaveValue('Sửa sau khi mở xác nhận');
  });

  it('STEPS_INVALID is answered in words', async () => {
    api.saveSteps.mockRejectedValue(apiError(400, 'STEPS_INVALID', [{ stepIndex: 0, field: 'legalDocUrl' }]));
    renderPage();
    fireEvent.change(await screen.findByTestId('step-0-name'), { target: { value: 'X' } });
    fireEvent.click(screen.getByTestId('editor-save'));
    expect(await screen.findByTestId('editor-error')).toHaveTextContent(L.errors.STEPS_INVALID);
  });
});

describe('publishing', () => {
  it('asks first, in a sentence that names the version, and sends the revision of the version', async () => {
    api.publish.mockResolvedValue(detailPublished());
    renderPage();
    fireEvent.click(await screen.findByTestId('editor-publish'));
    expect(screen.getByTestId('editor-publish-sentence')).toHaveTextContent(L.publish.sentence(1));
    expect(api.publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('editor-publish-confirm'));
    await waitFor(() => expect(api.publish).toHaveBeenCalledWith('f1', 'v1', 7));
    expect(await screen.findByTestId('editor-message')).toHaveTextContent(L.publish.published(1));
    expect(screen.queryByTestId('editor-publish-panel')).toBeNull();
  });

  it('Thôi closes the question without publishing', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('editor-publish'));
    fireEvent.click(screen.getByTestId('editor-publish-cancel'));
    expect(screen.queryByTestId('editor-publish-panel')).toBeNull();
    expect(api.publish).not.toHaveBeenCalled();
  });

  it('is not possible with unsaved edits (the server publishes what is saved)', async () => {
    renderPage();
    fireEvent.change(await screen.findByTestId('step-0-name'), { target: { value: 'X' } });
    expect(screen.getByTestId('editor-publish')).toBeDisabled();
    expect(screen.getByTestId('editor-unsaved')).toHaveTextContent(L.editor.unsaved);
  });

  it('FLOW_INVALID lists every issue by step, in plain Vietnamese', async () => {
    api.publish.mockRejectedValue(
      apiError(409, 'FLOW_INVALID', [
        { code: 'STEP_NAME_REQUIRED', stepIndex: 0, stepKey: 's1' },
        { code: 'THRESHOLDS_NOT_ASCENDING', stepIndex: 0, stepKey: 's1' },
        { code: 'FLOW_HAS_NO_STEPS' },
      ]),
    );
    renderPage();
    fireEvent.click(await screen.findByTestId('editor-publish'));
    fireEvent.click(screen.getByTestId('editor-publish-confirm'));
    const list = await screen.findByTestId('editor-publish-invalid');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent(`Bước 1 (Tiếp nhận): ${L.errors.STEP_NAME_REQUIRED}`);
    expect(items[1]).toHaveTextContent(L.errors.THRESHOLDS_NOT_ASCENDING);
    expect(items[2]).toHaveTextContent(`${L.publish.flowLevel}: ${L.errors.FLOW_HAS_NO_STEPS}`);
  });

  it('TEAM_NOT_ACTIVE names the units that are no longer active', async () => {
    api.publish.mockRejectedValue(apiError(409, 'TEAM_NOT_ACTIVE', [{ stepIndex: 0, stepKey: 's1', teamId: 't9' }]));
    renderPage();
    fireEvent.click(await screen.findByTestId('editor-publish'));
    fireEvent.click(screen.getByTestId('editor-publish-confirm'));
    const box = await screen.findByTestId('editor-publish-teams');
    expect(box).toHaveTextContent('Bước 1 (Tiếp nhận): Tổ 9');
  });

  it('without the publish permission there is no Xuất bản button', async () => {
    held.value = ['read:ProcessingFlow', 'edit:ProcessingFlow'];
    renderPage();
    await screen.findByTestId('editor-save');
    expect(screen.queryByTestId('editor-publish')).toBeNull();
  });
});

describe('the legal basis check', () => {
  const user = '2026-11-01T03:00:00.000Z';

  it('"Đã đối chiếu văn bản gốc" sends the revision of the version and shows the result', async () => {
    api.verifyLegal.mockResolvedValue(
      detail({ draft: version({ id: 'v1', revision: 8 }, [stepDto({ legalVerifiedAt: user, legalVerifiedById: 'u1' })]) }),
    );
    renderPage();
    fireEvent.click(await screen.findByTestId('step-0-verify'));
    await waitFor(() => expect(api.verifyLegal).toHaveBeenCalledWith('f1', 'v1', 's1', 7));
    expect(await screen.findByTestId('step-0-verified-note')).toHaveTextContent('Phạm D');
    expect(screen.getByTestId('step-0-unverify')).toBeInTheDocument();
  });

  it('a verified step shows who and when, and can be un-verified with the revision', async () => {
    api.get.mockResolvedValue(detail({ draft: version({ id: 'v1', revision: 7 }, [stepDto({ legalVerifiedAt: user, legalVerifiedById: 'u1' })]) }));
    api.unverifyLegal.mockResolvedValue(detail());
    renderPage();
    expect(await screen.findByTestId('step-0-verified-note')).toHaveTextContent(/Phạm D · .*2026/);
    fireEvent.click(screen.getByTestId('step-0-unverify'));
    await waitFor(() => expect(api.unverifyLegal).toHaveBeenCalledWith('f1', 'v1', 's1', 7));
  });

  it('the control is not drawn at all without verify:ProcessingFlow', async () => {
    held.value = ['read:ProcessingFlow', 'edit:ProcessingFlow', 'publish:ProcessingFlow'];
    renderPage();
    await screen.findByTestId('step-0-name');
    expect(screen.queryByTestId('step-0-verify')).toBeNull();
    expect(screen.queryByTestId('step-0-unverify')).toBeNull();
    expect(screen.getByTestId('step-0-verify-state')).toHaveTextContent(L.editor.verify.pending);
  });

  it('is disabled while there are unsaved edits (the stamp belongs to the saved version)', async () => {
    renderPage();
    fireEvent.change(await screen.findByTestId('step-0-name'), { target: { value: 'X' } });
    expect(screen.getByTestId('step-0-verify')).toBeDisabled();
  });

  it('needs a legal basis to mark', async () => {
    api.get.mockResolvedValue(detail({ draft: version({ id: 'v1', revision: 7 }, [stepDto({ legalBasis: null })]) }));
    renderPage();
    expect(await screen.findByTestId('step-0-verify')).toBeDisabled();
  });

  it('LEGAL_BASIS_REQUIRED from the server is answered in words', async () => {
    api.verifyLegal.mockRejectedValue(apiError(409, 'LEGAL_BASIS_REQUIRED'));
    renderPage();
    fireEvent.click(await screen.findByTestId('step-0-verify'));
    expect(await screen.findByTestId('editor-error')).toHaveTextContent(L.errors.LEGAL_BASIS_REQUIRED);
  });
});

describe('a published version', () => {
  beforeEach(() => {
    api.get.mockResolvedValue(detailPublished());
  });

  it('is read-only: no save, no publish, no add, every field disabled', async () => {
    renderPage();
    expect(await screen.findByTestId('step-0-name')).toBeDisabled();
    expect(screen.getByTestId('step-0-duration')).toBeDisabled();
    expect(screen.getByTestId('step-0-anchor')).toBeDisabled();
    expect(screen.queryByTestId('editor-save')).toBeNull();
    expect(screen.queryByTestId('editor-publish')).toBeNull();
    expect(screen.queryByTestId('editor-add-step')).toBeNull();
    expect(screen.getByTestId('editor-readonly-note')).toHaveTextContent(L.editor.readOnly);
    expect(screen.getByTestId('editor-version-line')).toHaveTextContent('Phiên bản 2 · đang áp dụng');
  });

  it('"Tạo bản nháp mới" creates a draft and the editor opens on it', async () => {
    api.createDraft.mockResolvedValue({
      ...detailPublished(),
      draft: version({ id: 'v3', versionNo: 3, status: 'DRAFT', revision: 1 }, [stepDto({ name: 'Bản nháp mới' })]),
      draftVersionNo: 3,
    });
    renderPage();
    fireEvent.click(await screen.findByTestId('editor-new-draft'));
    await waitFor(() => expect(api.createDraft).toHaveBeenCalledWith('f1'));
    expect(await screen.findByTestId('step-0-name')).toHaveValue('Bản nháp mới');
    expect(screen.getByTestId('step-0-name')).toBeEnabled();
    expect(screen.getByTestId('editor-version-line')).toHaveTextContent('Phiên bản 3 · nháp');
  });

  it('the legal check is still allowed on a published version', async () => {
    api.verifyLegal.mockResolvedValue(detailPublished());
    renderPage();
    const button = await screen.findByTestId('step-0-verify');
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(api.verifyLegal).toHaveBeenCalledWith('f1', 'v2', 's1', 3));
  });

  it('with a draft too, it can be switched between the draft and the published version', async () => {
    api.get.mockResolvedValue({
      ...detailPublished(),
      draftVersionNo: 3,
      draft: version({ id: 'v3', versionNo: 3, status: 'DRAFT', revision: 1 }, [stepDto({ name: 'Nháp' })]),
    });
    renderPage();
    expect(await screen.findByTestId('step-0-name')).toHaveValue('Nháp');
    fireEvent.click(screen.getByTestId('editor-view-published'));
    expect(screen.getByTestId('step-0-name')).toHaveValue('Tiếp nhận');
    expect(screen.getByTestId('step-0-name')).toBeDisabled();
    fireEvent.click(screen.getByTestId('editor-view-draft'));
    expect(screen.getByTestId('step-0-name')).toHaveValue('Nháp');
  });

  it('the version tabs never throw unsaved edits away: the shown tab is a no-op and the other one waits for a save (found by Codex)', async () => {
    api.get.mockResolvedValue({
      ...detailPublished(),
      draftVersionNo: 3,
      draft: version({ id: 'v3', versionNo: 3, status: 'DRAFT', revision: 1 }, [stepDto({ name: 'Nháp' })]),
    });
    renderPage();
    fireEvent.change(await screen.findByTestId('step-0-name'), { target: { value: 'Nháp đang sửa dở' } });
    // Clicking the tab that is already shown must not reload the draft from the server's copy.
    fireEvent.click(screen.getByTestId('editor-view-draft'));
    expect(screen.getByTestId('step-0-name')).toHaveValue('Nháp đang sửa dở');
    // Looking at the published version would drop the edits: it has to wait until they are saved or undone.
    expect(screen.getByTestId('editor-view-published')).toBeDisabled();
    fireEvent.click(screen.getByTestId('editor-view-published'));
    expect(screen.getByTestId('step-0-name')).toHaveValue('Nháp đang sửa dở');
    // Undone by hand: the tab is free again.
    fireEvent.change(screen.getByTestId('step-0-name'), { target: { value: 'Nháp' } });
    expect(screen.getByTestId('editor-view-published')).toBeEnabled();
  });
});

describe('dropping a draft', () => {
  it('asks first and sends the revision of the version', async () => {
    api.deleteDraft.mockResolvedValue(detailPublished());
    api.get.mockResolvedValue({ ...detailPublished(), draftVersionNo: 3, draft: version({ id: 'v3', versionNo: 3, status: 'DRAFT', revision: 5 }, [stepDto()]) });
    renderPage();
    fireEvent.click(await screen.findByTestId('editor-delete-draft'));
    expect(api.deleteDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('editor-delete-draft-confirm'));
    await waitFor(() => expect(api.deleteDraft).toHaveBeenCalledWith('f1', 'v3', 5));
  });
});

describe('the history of versions', () => {
  it('lists every version with its status, who published it and when', async () => {
    api.get.mockResolvedValue(
      detail({
        versions: [
          versionSummary({ id: 'v3', versionNo: 3, status: 'DRAFT' }),
          versionSummary({ id: 'v2', versionNo: 2, status: 'PUBLISHED', publishedAt: '2026-10-02T03:00:00.000Z', publishedById: 'u1' }),
          versionSummary({ id: 'v1', versionNo: 1, status: 'SUPERSEDED', publishedAt: '2026-06-15T03:00:00.000Z', publishedById: 'u1' }),
        ],
      }),
    );
    renderPage();
    fireEvent.click(await screen.findByTestId('editor-history-btn'));
    const panel = screen.getByTestId('editor-history');
    expect(within(panel).getByTestId('history-row-3')).toHaveTextContent('nháp');
    expect(within(panel).getByTestId('history-row-2')).toHaveTextContent('đang áp dụng');
    expect(within(panel).getByTestId('history-row-2')).toHaveTextContent('Phạm D');
    expect(within(panel).getByTestId('history-row-2')).toHaveTextContent('02/10/2026');
    expect(within(panel).getByTestId('history-row-1')).toHaveTextContent('đã thay thế');
  });
});

describe('the information types a flow is applied to', () => {
  beforeEach(() => {
    api.get.mockResolvedValue(DRAFT_WITH_TYPES());
  });
  function DRAFT_WITH_TYPES(): FlowDetailDto {
    return detail({ boundTypes: [boundType('Khiếu nại', { renamed: true })], boundGroups: ['TO_CAO'] });
  }

  it('shows one chip per bound type and per deadline group (petition only), and flags a renamed type', async () => {
    renderPage();
    expect(await screen.findByTestId('binding-chip-d-Khiếu nại')).toHaveTextContent('Khiếu nại');
    expect(screen.getByTestId('binding-renamed-d-Khiếu nại')).toBeInTheDocument();
    expect(screen.getByTestId('binding-chip-group-TO_CAO')).toHaveTextContent('Tố cáo');
  });

  it('adding a type from the catalogue sends ALL the bound ids and the revision of the flow', async () => {
    api.setBindings.mockResolvedValue(DRAFT_WITH_TYPES());
    renderPage();
    const select = await screen.findByTestId('binding-add-type');
    // The type already bound is not offered again.
    expect(within(select).queryByRole('option', { name: 'Khiếu nại (KN)' })).toBeNull();
    fireEvent.change(select, { target: { value: 'd-new' } });
    await waitFor(() => expect(api.setBindings).toHaveBeenCalledWith('f1', ['d-Khiếu nại', 'd-new'], ['TO_CAO'], 4));
  });

  it('removing a chip sends the rest', async () => {
    api.setBindings.mockResolvedValue(DRAFT_WITH_TYPES());
    renderPage();
    fireEvent.click(await screen.findByTestId('binding-remove-d-Khiếu nại'));
    await waitFor(() => expect(api.setBindings).toHaveBeenCalledWith('f1', [], ['TO_CAO'], 4));
  });

  it('adding a deadline group sends it with the types', async () => {
    api.setBindings.mockResolvedValue(DRAFT_WITH_TYPES());
    renderPage();
    fireEvent.change(await screen.findByTestId('binding-add-group'), { target: { value: 'KHIEU_NAI' } });
    await waitFor(() => expect(api.setBindings).toHaveBeenCalledWith('f1', ['d-Khiếu nại'], ['TO_CAO', 'KHIEU_NAI'], 4));
  });

  it('a case has no deadline groups to pick', async () => {
    api.get.mockResolvedValue(detail({ recordKind: 'CASE' }));
    renderPage();
    await screen.findByTestId('binding-add-type');
    expect(screen.queryByTestId('binding-add-group')).toBeNull();
  });

  it('TYPE_ALREADY_BOUND names the flow that already holds the type', async () => {
    api.setBindings.mockRejectedValue(apiError(409, 'TYPE_ALREADY_BOUND', [{ directoryId: 'd-new', flowId: 'f2', flowName: 'Tố cáo' }]));
    renderPage();
    fireEvent.change(await screen.findByTestId('binding-add-type'), { target: { value: 'd-new' } });
    const error = await screen.findByTestId('binding-error');
    expect(error).toHaveTextContent(L.errors.TYPE_ALREADY_BOUND);
    expect(error).toHaveTextContent('"Tố cáo"');
    expect(error).toHaveTextContent('Tin báo');
  });

  it('says so when nothing is bound yet', async () => {
    api.get.mockResolvedValue(detail());
    renderPage();
    expect(await screen.findByTestId('binding-none')).toHaveTextContent(L.editor.bindings.none);
  });

  it('is not editable without edit:ProcessingFlow', async () => {
    held.value = ['read:ProcessingFlow'];
    renderPage();
    await screen.findByTestId('binding-chip-d-Khiếu nại');
    expect(screen.queryByTestId('binding-add-type')).toBeNull();
    expect(screen.queryByTestId('binding-remove-d-Khiếu nại')).toBeNull();
  });
});

describe('the name and description', () => {
  it('can be edited and saved with the revision of the flow', async () => {
    api.update.mockResolvedValue(detail({ name: 'Tên mới' }));
    renderPage();
    fireEvent.click(await screen.findByTestId('editor-edit-meta'));
    fireEvent.change(screen.getByTestId('meta-name'), { target: { value: 'Tên mới' } });
    fireEvent.click(screen.getByTestId('meta-default'));
    fireEvent.click(screen.getByTestId('meta-save'));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('f1', { name: 'Tên mới', description: null, isDefault: true, expectedRevision: 4 }));
  });

  it('DEFAULT_FLOW_EXISTS is answered in words', async () => {
    api.update.mockRejectedValue(apiError(409, 'DEFAULT_FLOW_EXISTS', [{ flowId: 'f2', name: 'Tố cáo' }]));
    renderPage();
    fireEvent.click(await screen.findByTestId('editor-edit-meta'));
    fireEvent.click(screen.getByTestId('meta-default'));
    fireEvent.click(screen.getByTestId('meta-save'));
    expect(await screen.findByTestId('editor-error')).toHaveTextContent(L.errors.DEFAULT_FLOW_EXISTS);
  });
});

describe('an archived flow, permissions and the switch', () => {
  it('an archived flow is read-only with a note, and shows its badge', async () => {
    api.get.mockResolvedValue(detail({ status: 'ARCHIVED' }));
    renderPage();
    expect(await screen.findByTestId('editor-badge-archived')).toBeInTheDocument();
    expect(screen.getByTestId('editor-archived-note')).toHaveTextContent(L.editor.archivedNote);
    expect(screen.getByTestId('step-0-name')).toBeDisabled();
    expect(screen.queryByTestId('editor-save')).toBeNull();
  });

  it('without edit permission the steps are read-only and there is no save', async () => {
    held.value = ['read:ProcessingFlow'];
    renderPage();
    expect(await screen.findByTestId('step-0-name')).toBeDisabled();
    expect(screen.queryByTestId('editor-save')).toBeNull();
  });

  it('a 404 without a code is the switch being off: the plain "chưa bật" state', async () => {
    api.get.mockRejectedValue(apiError(404, null));
    renderPage();
    expect(await screen.findByTestId('processing-flow-disabled')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('FLOW_NOT_FOUND says the flow is gone and links back to the list', async () => {
    api.get.mockRejectedValue(apiError(404, 'FLOW_NOT_FOUND'));
    renderPage();
    expect(await screen.findByTestId('editor-load-error')).toHaveTextContent(L.errors.FLOW_NOT_FOUND);
    expect(screen.queryByTestId('processing-flow-disabled')).toBeNull();
  });
});

describe('the chart under the table', () => {
  it('draws a bar per step from the answer of the server, and says when a deadline is provisional', async () => {
    api.previewSchedule.mockResolvedValue({ ...PREVIEW, steps: [{ ...PREVIEW.steps[0], provisional: true }], provisional: true });
    renderPage();
    expect(await screen.findByTestId('gantt-bar-0')).toBeInTheDocument();
    expect(screen.getByTestId('gantt-provisional-0')).toHaveAttribute('title', L.editor.schedule.provisionalTip);
  });

  it('a step the server could not schedule shows the reason instead of a bar', async () => {
    api.previewSchedule.mockResolvedValue({ ...PREVIEW, steps: [{ ...PREVIEW.steps[0], startAt: null, dueAt: null, greenFrom: null, yellowFrom: null, redFrom: null, problem: 'ANCHOR_DATE_MISSING' }] });
    renderPage();
    expect(await screen.findByTestId('gantt-problem-0')).toHaveTextContent(L.errors.ANCHOR_DATE_MISSING);
    expect(screen.queryByTestId('gantt-bar-0')).toBeNull();
  });

  it('a failed preview is explained under the table and does not stop editing', async () => {
    api.previewSchedule.mockRejectedValue(apiError(400, 'STEPS_INVALID'));
    renderPage();
    expect(await screen.findByTestId('gantt-error')).toHaveTextContent(L.errors.STEPS_INVALID);
    expect(screen.getByTestId('step-0-name')).toBeEnabled();
  });

  it('changing a sample date asks again with that date', async () => {
    renderPage();
    await screen.findByTestId('sample-RECEIVED');
    fireEvent.change(screen.getByTestId('sample-RECEIVED'), { target: { value: '2027-01-04' } });
    await waitFor(() => expect(lastPreviewBody()?.anchors).toMatchObject({ RECEIVED: '2027-01-04' }), { timeout: 3000 });
  });

  it('a case asks for the sample gravity of the crime', async () => {
    api.get.mockResolvedValue(detail({ recordKind: 'CASE' }));
    renderPage();
    fireEvent.change(await screen.findByTestId('sample-gravity'), { target: { value: 'NGHIEM_TRONG' } });
    await waitFor(() => expect(lastPreviewBody()?.conditions).toEqual({ CRIME_GRAVITY: 'NGHIEM_TRONG' }), { timeout: 3000 });
  });
});

describe('a person without read:ProcessingFlow', () => {
  it('sees the plain "no permission" state, not an error with a retry', async () => {
    api.get.mockRejectedValue(apiError(403, null));
    renderPage();
    expect(await screen.findByTestId('processing-flow-forbidden')).toBeInTheDocument();
    expect(screen.queryByTestId('editor-load-error')).toBeNull();
  });
});
