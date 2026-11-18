import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import WardAssignmentFormPage from '../WardAssignmentFormPage';
import { wardAssignmentsApi, wardInvestigatorsApi } from '@/features/ward-assignments/api';
import { saveDownloadedFile, wardDocsApi } from '@/features/ward-assignments/api/docs';
import type { WardAssignmentDetail, WardCan, WardInvestigator } from '@/features/ward-assignments/types';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';

vi.mock('@/features/ward-assignments/api', async (orig) => {
  const real = await orig<typeof import('@/features/ward-assignments/api')>();
  const fn = () => vi.fn();
  return {
    ...real,
    wardAssignmentsApi: {
      list: fn(), get: fn(), create: fn(), update: fn(), submit: fn(), withdraw: fn(), remove: fn(), archive: fn(), restore: fn(),
      returnIt: fn(), revokeReturn: fn(), approve: fn(), cancelApproval: fn(), followUp: fn(), extendDeadline: fn(), complete: fn(),
      reopen: fn(), returnReasons: fn(), followUpChoices: fn(), deletionImpact: fn(), removeWithData: fn(), unitChoices: fn(), addReturnReason: fn(), viewer: fn(), previousByCode: fn(),
    },
    wardInvestigatorsApi: { list: fn(), create: fn(), update: fn(), deactivate: fn(), reactivate: fn() },
  };
});
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(async () => ({ data: [] })) } }));
vi.mock('@/features/ward-assignments/api/docs', async (orig) => {
  const real = await orig<typeof import('@/features/ward-assignments/api/docs')>();
  return { ...real, saveDownloadedFile: vi.fn(), wardDocsApi: { listFiles: vi.fn(async () => []), slipDefaults: vi.fn(), issueSlip: vi.fn(), downloadSlip: vi.fn(), reissueSlip: vi.fn() } };
});
const who = vi.hoisted(() => ({ user: null as unknown }));
vi.mock('@/stores/auth.store', () => ({ authStore: { getUser: () => who.user } }));

const api = vi.mocked(wardAssignmentsApi);
const invApi = vi.mocked(wardInvestigatorsApi);
const docs = vi.mocked(wardDocsApi);

const WARD_USER = {
  id: 'u-ward', email: 'w@x', role: 'OFFICER', firstName: 'G', lastName: 'Võ Thị', phone: '0900 000 001', teams: [{ teamId: 'tw', teamName: 'CAP Vườn Lài', isLeader: false }],
  primaryTeam: { teamId: 'tw', teamName: 'CAP Vườn Lài' }, isWardOfficer: true, wardTeam: { id: 'tw', name: 'CAP Vườn Lài', code: 'VL', ward: null },
};
const PC02_USER = {
  id: 'u-rev', email: 'k@x', role: 'OFFICER', firstName: 'K', lastName: 'Đặng Văn', teams: [{ teamId: 'd1', teamName: 'Đội 1', isLeader: false }],
  primaryTeam: { teamId: 'd1', teamName: 'Đội 1' }, isWardOfficer: false, wardTeam: null,
};

const investigator: WardInvestigator = { id: 'i1', teamId: 'tw', fullName: 'Lê Văn C', rank: 'Thượng tá', position: 'Trưởng CAP', grade: null, isActive: true, updatedAt: '2026-11-01T00:00:00Z' };

const NO: WardCan = { edit: false, submit: false, withdraw: false, delete: false, review: false, archive: false, restore: false };

function detail(over: Partial<WardAssignmentDetail> = {}): WardAssignmentDetail {
  return {
    id: 'w1', code: '2026-00185', status: 'SUBMITTED', assignedTeamId: 'tw', assignedTeam: { id: 'tw', name: 'CAP Vườn Lài' }, caseType: 'INCIDENT', kind: 'NEW',
    crimeId: null, crime: null, crimeOther: 'Trộm cắp tài sản', summary: 'Mất xe máy', submissionCount: 1, submittedAt: '2026-11-13T03:00:00Z',
    resultDueOn: null, completedOn: null, archivedAt: null, updatedAt: '2026-11-13T03:00:00.000Z', enteredById: 'u-ward', enteredOnBehalf: false,
    previousAssignmentId: null, reassignReason: null, content: 'Nội dung', discoveredOn: null, place: null, subjectsUnknown: true,
    proposedInvestigatorId: 'i1', proposedInvestigator: investigator, entryOfficerName: 'Võ Thị G', entryOfficerPhone: null, unitNote: null,
    assignedInvestigatorId: null, assignedInvestigator: null, followUpUserId: null, followUpTeamId: null, pc02Note: null, receivedOn: null, resultText: null,
    createdAt: '2026-11-13T00:00:00Z', subjects: [],
    rounds: [{ id: 'r1', sequence: 1, submissionNo: 1, status: 'PENDING', submittedAt: '2026-11-13T03:00:00Z', submittedById: 'u-ward', snapshot: {}, withdrawnAt: null, withdrawnById: null, decisions: [] }],
    deadlineChanges: [], timeliness: null, viewerId: 'u-ward', can: NO,
    ...over,
  };
}

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/ho-so-phan-cong" element={<Where />} />
          <Route path="/ho-so-phan-cong/new" element={<WardAssignmentFormPage mode="edit" />} />
          <Route path="/ho-so-phan-cong/:id" element={<><WardAssignmentFormPage key="view" mode="view" /><Where /></>} />
          <Route path="/ho-so-phan-cong/:id/edit" element={<><WardAssignmentFormPage key="edit" mode="edit" /><Where /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function axiosError(status: number, code: string, details: unknown[] = []) {
  const headers = new AxiosHeaders();
  return new AxiosError('x', 'ERR', { headers }, null, { status, statusText: '', headers, config: { headers }, data: { error: { code, details } } });
}

beforeEach(() => {
  vi.resetAllMocks();
  who.user = WARD_USER;
  invApi.list.mockResolvedValue([investigator]);
  api.returnReasons.mockResolvedValue([{ code: 'THIEU_TAI_LIEU', name: 'Thiếu tài liệu' }]);
  api.followUpChoices.mockResolvedValue({ teams: [{ id: 'd1', name: 'Đội 1' }], people: [{ id: 'u-rev', name: 'Đặng Văn K', unitIds: ['d1'] }] });
  api.list.mockResolvedValue({ data: [], total: 0 });
  // The module's own list: the ward units the server accepts a request for (no PC02 unit in it).
  api.unitChoices.mockResolvedValue([{ id: 'tw', name: 'CAP Vườn Lài' }, { id: 'tw2', name: 'CAX Bình Mỹ' }]);
  docs.slipDefaults.mockResolvedValue({ decisionId: 'd1', kind: 'RETURN', revoked: false, slipNumber: null, signers: { canBoThamDinh: 'Đại úy Đặng Văn K', chiHuyDoi: '', lanhDaoPhong: 'Thượng tá N' }, templateReady: true, missing: ['place'] });
});

/** Chooses an option of a type-to-find field (`FKSelect`): open it, click the option. */
async function choose(testId: string, value: string) {
  fireEvent.click(await screen.findByTestId(`${testId}-trigger`));
  fireEvent.click(await screen.findByTestId(`${testId}-option-${value}`));
}

/** Everything a submission needs, as a ward officer types it. */
async function fillRequired() {
  fireEvent.change(await screen.findByTestId('ward-crime-other'), { target: { value: 'Trộm cắp tài sản' } });
  fireEvent.change(screen.getByTestId('ward-summary'), { target: { value: 'Mất xe máy' } });
  fireEvent.change(screen.getByTestId('ward-content'), { target: { value: 'Nội dung' } });
  fireEvent.click(screen.getByTestId('ward-subjects-unknown'));
  await choose('ward-proposed-investigator', 'i1');
}

describe('a new request, by a ward officer', () => {
  it('fixes the unit to theirs and fills the entering officer with them', async () => {
    renderAt('/ho-so-phan-cong/new');
    expect(await screen.findByTestId('ward-unit-fixed')).toHaveTextContent('CAP Vườn Lài');
    expect(screen.queryByTestId('ward-unit')).not.toBeInTheDocument();
    expect(screen.getByTestId('ward-entry-officer')).toHaveValue('Võ Thị G');
    expect(screen.getByTestId('ward-entry-phone')).toHaveValue('0900 000 001');
  });

  it('is titled as the petition form titles its own: "Thêm mới …", with both action bars', async () => {
    renderAt('/ho-so-phan-cong/new');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Thêm mới Hồ sơ phân công');
    expect(screen.getByTestId('ward-save-draft')).toHaveTextContent('Lưu hồ sơ');
    expect(screen.getByTestId('ward-save-draft-bottom')).toHaveTextContent('Lưu hồ sơ');
    expect(screen.getByTestId('ward-submit-bottom')).toHaveTextContent(L.form.actions.submit);
  });

  it('saves a draft without naming the unit (the server takes the officer’s own) and goes back to the list', async () => {
    api.create.mockResolvedValue(detail({ id: 'w9', status: 'DRAFT', code: null }));
    renderAt('/ho-so-phan-cong/new');
    fireEvent.click(await screen.findByTestId('ward-case-type-CASE'));
    fireEvent.change(screen.getByTestId('ward-summary'), { target: { value: 'Nhóm đánh bạc' } });
    fireEvent.change(screen.getByTestId('ward-content'), { target: { value: 'Nội dung' } });
    fireEvent.click(screen.getByTestId('ward-save-draft'));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    const body = api.create.mock.calls[0][0];
    expect(body).toMatchObject({ caseType: 'CASE', kind: 'NEW', summary: 'Nhóm đánh bạc', entryOfficerName: 'Võ Thị G' });
    expect(body.assignedTeamId).toBeUndefined();
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/ho-so-phan-cong'));
  });

  it('"Hủy" asks before what was typed is lost, and does not ask when nothing was typed', async () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/ho-so-phan-cong/new');
    fireEvent.change(await screen.findByTestId('ward-summary'), { target: { value: 'đang gõ dở' } });
    fireEvent.click(screen.getByTestId('form-action-cancel'));
    expect(ask).toHaveBeenCalledWith(L.form.cancelConfirm);
    // Refused: still on the form, the text still there.
    expect(screen.getByTestId('ward-summary')).toHaveValue('đang gõ dở');
    ask.mockReturnValue(true);
    fireEvent.click(screen.getByTestId('form-action-cancel-bottom'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/ho-so-phan-cong'));
    ask.mockRestore();
  });

  it('"Hủy" with nothing typed leaves at once', async () => {
    const ask = vi.spyOn(window, 'confirm');
    renderAt('/ho-so-phan-cong/new');
    fireEvent.click(await screen.findByTestId('form-action-cancel'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/ho-so-phan-cong'));
    expect(ask).not.toHaveBeenCalled();
    ask.mockRestore();
  });

  it('the investigator is found by typing; a name nobody carries opens the dialog with it, and the one created is chosen', async () => {
    const created: WardInvestigator = { id: 'i9', teamId: 'tw', fullName: 'Phạm Văn Mới', rank: 'Đại uý', position: 'Phó trưởng CAP', grade: 'Sơ cấp', isActive: true, updatedAt: '2026-11-17T00:00:00Z' };
    invApi.create.mockResolvedValue(created);
    api.create.mockResolvedValue(detail({ id: 'w9', status: 'DRAFT', code: null }));
    renderAt('/ho-so-phan-cong/new');
    fireEvent.click(await screen.findByTestId('ward-proposed-investigator-trigger'));
    const search = await screen.findByTestId('ward-proposed-investigator-search');
    // Found without accents, by any part of "Cấp bậc – Chức vụ – Họ tên".
    fireEvent.change(search, { target: { value: 'le van' } });
    expect(await screen.findByTestId('ward-proposed-investigator-option-i1')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'Phạm Văn Mới' } });
    await waitFor(() => expect(screen.queryByTestId('ward-proposed-investigator-option-i1')).not.toBeInTheDocument());
    fireEvent.keyDown(search, { key: 'Enter' });
    // The dialog: the five fields of the directory, the name typed already in.
    const dialog = await screen.findByTestId('ward-inv-quick');
    expect(within(dialog).getByTestId('ward-inv-quick-fullName')).toHaveValue('Phạm Văn Mới');
    for (const f of ['rank', 'position', 'grade', 'status']) expect(within(dialog).getByTestId(`ward-inv-quick-${f}`)).toBeInTheDocument();
    fireEvent.change(within(dialog).getByTestId('ward-inv-quick-rank'), { target: { value: 'Đại uý' } });
    invApi.list.mockResolvedValue([investigator, created]);
    fireEvent.click(screen.getByTestId('ward-inv-quick-save'));
    await waitFor(() => expect(invApi.create).toHaveBeenCalledWith('tw', { fullName: 'Phạm Văn Mới', rank: 'Đại uý', position: null, grade: null }));
    await waitFor(() => expect(screen.queryByTestId('ward-inv-quick')).not.toBeInTheDocument());
    // Chosen: the request saved names them.
    fireEvent.click(screen.getByTestId('ward-save-draft'));
    await waitFor(() => expect(api.create.mock.calls[0][0].proposedInvestigatorId).toBe('i9'));
  });

  it('the investigator chosen is corrected from the field (the pencil), and stays chosen', async () => {
    invApi.update.mockResolvedValue({ ...investigator, rank: 'Đại tá', updatedAt: '2026-11-17T01:00:00Z' });
    renderAt('/ho-so-phan-cong/new');
    expect(screen.queryByTestId('ward-edit-investigator')).not.toBeInTheDocument();
    await choose('ward-proposed-investigator', 'i1');
    fireEvent.click(screen.getByTestId('ward-edit-investigator'));
    const dialog = await screen.findByTestId('ward-inv-quick');
    expect(within(dialog).getByTestId('ward-inv-quick-fullName')).toHaveValue('Lê Văn C');
    fireEvent.change(within(dialog).getByTestId('ward-inv-quick-rank'), { target: { value: 'Đại tá' } });
    fireEvent.click(screen.getByTestId('ward-inv-quick-save'));
    await waitFor(() => expect(invApi.update).toHaveBeenCalledWith('i1', { fullName: 'Lê Văn C', rank: 'Đại tá', position: 'Trưởng CAP', grade: null }, '2026-11-01T00:00:00Z'));
    await waitFor(() => expect(screen.queryByTestId('ward-inv-quick')).not.toBeInTheDocument());
  });

  it('a second click while the save runs does not create a second draft', async () => {
    let resolve: (v: WardAssignmentDetail) => void = () => {};
    api.create.mockImplementation(() => new Promise((r) => (resolve = r)));
    renderAt('/ho-so-phan-cong/new');
    const save = await screen.findByTestId('ward-save-draft');
    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.click(screen.getByTestId('ward-submit'));
    resolve(detail({ id: 'w9', status: 'DRAFT', code: null }));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/ho-so-phan-cong'));
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.submit).not.toHaveBeenCalled();
  });

  it('"Trình duyệt" saves then submits with the stamp the save returned', async () => {
    api.create.mockResolvedValue(detail({ id: 'w9', status: 'DRAFT', code: null, updatedAt: '2026-11-16T05:00:00.000Z' }));
    api.submit.mockResolvedValue(detail({ id: 'w9' }));
    renderAt('/ho-so-phan-cong/new');
    await fillRequired();
    fireEvent.click(screen.getByTestId('ward-submit'));
    await waitFor(() => expect(api.submit).toHaveBeenCalledWith('w9', '2026-11-16T05:00:00.000Z'));
    expect(api.create.mock.calls[0][0]).toMatchObject({ proposedInvestigatorId: 'i1', subjectsUnknown: true });
    // Submitted: back to the list, as after a save.
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/ho-so-phan-cong'));
  });

  it('"Trình duyệt" on a form with required fields empty sends nothing and lists them, each by its label', async () => {
    renderAt('/ho-so-phan-cong/new');
    fireEvent.click(await screen.findByTestId('ward-submit'));
    const box = await screen.findByTestId('validation-errors');
    expect(box).toHaveTextContent(L.form.checkErrors);
    for (const label of [L.form.fields.crime, L.form.fields.summary, L.form.fields.content, L.form.fields.subjects, L.form.fields.proposedInvestigator]) {
      expect(box).toHaveTextContent(label);
    }
    // The entering officer is filled in by default: not listed.
    expect(box).not.toHaveTextContent(L.form.fields.entryOfficerName);
    expect(api.create).not.toHaveBeenCalled();
    expect(api.submit).not.toHaveBeenCalled();
    // A draft does not need them: "Lưu hồ sơ" still saves.
    api.create.mockResolvedValue(detail({ id: 'w9', status: 'DRAFT', code: null }));
    fireEvent.click(screen.getByTestId('ward-save-draft'));
    await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
  });

  it('lists what is still missing when the server refuses the submission as incomplete', async () => {
    api.create.mockResolvedValue(detail({ id: 'w9', status: 'DRAFT', code: null }));
    api.submit.mockRejectedValue(axiosError(400, 'WARD_ASSIGNMENT_INCOMPLETE', [{ field: 'summary' }, { field: 'proposedInvestigatorId' }]));
    api.get.mockResolvedValue(detail({ id: 'w9', status: 'DRAFT', code: null, rounds: [], can: { ...NO, edit: true, submit: true, delete: true } }));
    renderAt('/ho-so-phan-cong/new');
    await fillRequired();
    fireEvent.click(screen.getByTestId('ward-submit'));
    // The draft was saved: the page moves to it, and still says what is missing.
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/ho-so-phan-cong/w9/edit'));
    await screen.findByTestId('ward-summary');
    const banner = await screen.findByTestId('ward-banner');
    expect(banner).toHaveTextContent(L.form.fields.summary);
    expect(banner).toHaveTextContent(L.form.fields.proposedInvestigator);
  });

  it('refuses a birth year that is not four digits instead of sending it', async () => {
    renderAt('/ho-so-phan-cong/new');
    fireEvent.click(await screen.findByTestId('ward-subject-add'));
    fireEvent.change(screen.getByLabelText(`${L.form.subjects.fullName} 1`), { target: { value: 'Trần Thị B' } });
    fireEvent.change(screen.getByLabelText(`${L.form.subjects.birthYear} 1`), { target: { value: '92' } });
    fireEvent.click(screen.getByTestId('ward-save-draft'));
    expect(await screen.findByTestId('ward-banner')).toHaveTextContent(L.errors.WARD_SUBJECT_BIRTH_YEAR_INVALID);
    expect(api.create).not.toHaveBeenCalled();
  });

  it('asks for the previous request and the reason when the assignment is a re-assignment', async () => {
    api.list.mockResolvedValue({ data: [{ ...detail({ id: 'p1', code: '2026-00077', status: 'APPROVED' }) }], total: 1 });
    renderAt('/ho-so-phan-cong/new');
    fireEvent.click(await screen.findByTestId('ward-kind-REASSIGN'));
    const previous = await screen.findByTestId('ward-previous');
    await waitFor(() => expect(within(previous).getByText(/2026-00077/)).toBeInTheDocument());
    expect(screen.getByTestId('ward-reassign-reason')).toBeInTheDocument();
  });
});

describe('a new request, entered by PC02 on a unit’s behalf', () => {
  it('chooses the unit among the ward units and sends it', async () => {
    who.user = PC02_USER;
    api.create.mockResolvedValue(detail({ id: 'w9', status: 'DRAFT', code: null }));
    renderAt('/ho-so-phan-cong/new');
    // A type-to-find field over the module's own list of units (what the server accepts), found without accents.
    fireEvent.click(await screen.findByTestId('ward-unit-trigger'));
    const search = await screen.findByTestId('ward-unit-search');
    expect(await screen.findByTestId('ward-unit-option-tw')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'binh my' } });
    await waitFor(() => expect(screen.queryByTestId('ward-unit-option-tw')).not.toBeInTheDocument());
    // A unit is not created from this form.
    expect(screen.queryByTestId('ward-unit-create-new')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ward-unit-option-tw2'));
    expect(screen.getByTestId('ward-unit-trigger')).toHaveTextContent('CAX Bình Mỹ');
    expect(api.unitChoices).toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('ward-save-draft'));
    await waitFor(() => expect(api.create.mock.calls[0][0].assignedTeamId).toBe('tw2'));
  });
});

describe('an existing request, read by the ward unit', () => {
  it('a returned request is read-only until "Sửa", shows "Trình lại", and opens the edit form', async () => {
    api.get.mockResolvedValue(detail({ status: 'RETURNED', can: { ...NO, edit: true, submit: true } }));
    renderAt('/ho-so-phan-cong/w1');
    expect(await screen.findByTestId('ward-returned-banner')).toBeInTheDocument();
    expect(screen.getByTestId('ward-summary')).toHaveAttribute('readonly');
    expect(screen.getByTestId('ward-submit')).toHaveTextContent(L.form.actions.resubmit);
    fireEvent.click(screen.getByTestId('ward-edit'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/ho-so-phan-cong/w1/edit');
  });

  it('"In phiếu" is on a request that has no decision yet too, locked, saying the slip comes after PC02 decides; a new form has none', async () => {
    api.get.mockResolvedValue(detail({ can: { ...NO, withdraw: true } }));
    const first = renderAt('/ho-so-phan-cong/w1');
    const print = await screen.findByTestId('ward-print');
    expect(print).toBeDisabled();
    expect(print).toHaveAttribute('title', L.list.actions.printNoDecision);
    first.unmount();
    renderAt('/ho-so-phan-cong/new');
    await screen.findByTestId('ward-save-draft');
    expect(screen.queryByTestId('ward-print')).not.toBeInTheDocument();
  });

  it('withdraws a waiting round after confirmation', async () => {
    api.get.mockResolvedValue(detail({ can: { ...NO, withdraw: true } }));
    api.withdraw.mockResolvedValue({});
    renderAt('/ho-so-phan-cong/w1');
    fireEvent.click(await screen.findByTestId('ward-withdraw'));
    fireEvent.click(await screen.findByText(L.form.confirm.yes));
    await waitFor(() => expect(api.withdraw).toHaveBeenCalledWith('w1', '2026-11-13T03:00:00.000Z'));
  });

  it('deletes a draft never submitted, after confirmation, and goes back to the list', async () => {
    api.get.mockResolvedValue(detail({ status: 'DRAFT', code: null, rounds: [], can: { ...NO, edit: true, submit: true, delete: true } }));
    api.remove.mockResolvedValue({ id: 'w1' });
    renderAt('/ho-so-phan-cong/w1');
    fireEvent.click(await screen.findByTestId('ward-delete'));
    fireEvent.click(await screen.findByText(L.form.confirm.yes));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('w1', '2026-11-13T03:00:00.000Z'));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/ho-so-phan-cong$/));
  });

  it('a change made meanwhile offers to load the request again', async () => {
    api.get.mockResolvedValue(detail({ status: 'RETURNED', can: { ...NO, edit: true, submit: true } }));
    api.update.mockRejectedValue(axiosError(409, 'WARD_ASSIGNMENT_CHANGED'));
    renderAt('/ho-so-phan-cong/w1/edit');
    fireEvent.click(await screen.findByTestId('ward-save-draft'));
    const banner = await screen.findByTestId('ward-banner');
    expect(banner).toHaveTextContent(L.form.changed.text);
    const calls = api.get.mock.calls.length;
    fireEvent.click(within(banner).getByText(L.form.changed.reload));
    await waitFor(() => expect(api.get.mock.calls.length).toBeGreaterThan(calls));
  });

  it('shows blocks 2 and 3 read-only: no review action, no result to write', async () => {
    api.get.mockResolvedValue(
      detail({
        status: 'APPROVED', resultDueOn: '2027-01-16T00:00:00.000Z', receivedOn: '2026-11-16T00:00:00.000Z', assignedInvestigator: investigator, assignedInvestigatorId: 'i1',
        followUpUserId: 'u-rev', followUpTeamId: 'd1',
        followUpUser: { id: 'u-rev', firstName: 'K', lastName: 'Đặng Văn', username: 'dangk' }, followUpTeam: { id: 'd1', name: 'Đội 1' },
        rounds: [{ id: 'r1', sequence: 1, submissionNo: 1, status: 'DECIDED', submittedAt: '2026-11-13T03:00:00Z', submittedById: 'u-ward', snapshot: {}, withdrawnAt: null, withdrawnById: null,
          decisions: [{ id: 'd1', kind: 'APPROVE', decidedAt: '2026-11-16T03:00:00Z', decidedById: 'u-rev', reasonCode: null, reasonText: null, requirements: ['Báo cáo kết quả'], assignedInvestigatorId: 'i1', followUpUserId: 'u-rev', followUpTeamId: 'd1', revokedAt: null, revokedById: null, revokeReason: null, slipNumber: null, slipIssuedAt: null }] }],
      }),
    );
    renderAt('/ho-so-phan-cong/w1');
    const review = await screen.findByTestId('ward-block-review');
    expect(within(review).getByTestId('ward-decision-in-force')).toHaveTextContent('Lê Văn C');
    // Who follows it, by name, for the ward unit too: carried by the request, no list of users or teams is asked for.
    expect(api.followUpChoices).not.toHaveBeenCalled();
    await waitFor(() => expect(within(review).getByTestId('ward-decision-in-force')).toHaveTextContent('Đội 1'));
    expect(within(review).getByTestId('ward-decision-in-force')).toHaveTextContent('Đặng Văn K');
    expect(within(review).getByText('Báo cáo kết quả')).toBeInTheDocument();
    expect(screen.queryByTestId('ward-approve')).not.toBeInTheDocument();
    expect(screen.getByTestId('ward-result-due-on')).toHaveTextContent('16/01/2027');
    expect(screen.queryByTestId('ward-follow-up-save')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ward-extend')).not.toBeInTheDocument();
    expect(screen.getByTestId('ward-result-text')).toHaveAttribute('readonly');
  });
});

describe('a waiting request, reviewed by PC02', () => {
  beforeEach(() => {
    who.user = PC02_USER;
  });

  it('approves with the proposed investigator, the reviewer and the reviewer’s team by default', async () => {
    api.get.mockResolvedValue(detail({ viewerId: 'u-rev', can: { ...NO, review: true, returnIt: true, approve: true, archive: true } }));
    api.approve.mockResolvedValue({});
    renderAt('/ho-so-phan-cong/w1');
    const approve = await screen.findByTestId('ward-approve');
    await waitFor(() => expect(screen.getByTestId('ward-assigned-investigator-trigger')).toHaveTextContent('Lê Văn C'));
    // The people and units offered come from the module's own route (a reviewer holds no right to the admin lists).
    await waitFor(() => expect(screen.getByTestId('ward-follow-up-team-trigger')).toHaveTextContent('Đội 1'));
    expect(screen.getByTestId('ward-follow-up-user-trigger')).toHaveTextContent('Đặng Văn K');
    // The three choices are type-to-find fields, not plain lists: the follower is found by typing, without accents.
    for (const id of ['ward-assigned-investigator', 'ward-follow-up-user', 'ward-follow-up-team']) {
      expect(screen.getByTestId(`${id}-trigger`)).toHaveAttribute('role', 'combobox');
      expect(screen.getByTestId(id).querySelector('select')).toBeNull();
    }
    fireEvent.click(screen.getByTestId('ward-follow-up-user-trigger'));
    fireEvent.change(await screen.findByTestId('ward-follow-up-user-search'), { target: { value: 'dang van' } });
    expect(await screen.findByTestId('ward-follow-up-user-option-u-rev')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('ward-follow-up-user-search'), { target: { value: 'khong co ai' } });
    await waitFor(() => expect(screen.queryByTestId('ward-follow-up-user-option-u-rev')).not.toBeInTheDocument());
    // Nobody is created from here: the followers are the people of PC02.
    expect(screen.queryByTestId('ward-follow-up-user-create-new')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ward-follow-up-user-trigger'));
    expect(api.followUpChoices).toHaveBeenCalled();
    const { api: http } = await import('@/lib/api');
    expect(vi.mocked(http.get).mock.calls.map(([u]) => String(u)).filter((u) => u.startsWith('/admin/') || u.startsWith('/teams'))).toEqual([]);
    fireEvent.click(screen.getByTestId('ward-requirements-add'));
    fireEvent.change(screen.getByLabelText(`${L.review.requirements} 1`), { target: { value: ' Báo cáo kết quả ' } });
    fireEvent.click(approve);
    await waitFor(() =>
      expect(api.approve).toHaveBeenCalledWith('w1', expect.objectContaining({ assignedInvestigatorId: 'i1', followUpUserId: 'u-rev', followUpTeamId: 'd1', requirements: ['Báo cáo kết quả'] }), '2026-11-13T03:00:00.000Z'),
    );
  });

  it('an administrator (in no PC02 unit) is not their own follower: the follower is chosen, the unit follows from them', async () => {
    api.followUpChoices.mockResolvedValue({
      teams: [{ id: 'd1', name: 'Đội 1' }, { id: 'd2', name: 'Đội 2' }],
      people: [{ id: 'u-rev', name: 'Đặng Văn K', unitIds: ['d1'] }, { id: 'u-two', name: 'Lê Thị M', unitIds: ['d1', 'd2'] }],
    });
    api.get.mockResolvedValue(detail({ viewerId: 'u-admin', can: { ...NO, review: true, returnIt: true, approve: true } }));
    api.approve.mockResolvedValue({});
    renderAt('/ho-so-phan-cong/w1');
    const approve = await screen.findByTestId('ward-approve');
    await waitFor(() => expect(screen.getByTestId('ward-follow-up-user-trigger')).toHaveTextContent(L.review.followUpUserPick));
    await waitFor(() => expect(screen.getByTestId('ward-follow-up-team-trigger')).toHaveTextContent(L.review.followUpTeamPick));
    await waitFor(() => expect(screen.getByTestId('ward-assigned-investigator-trigger')).toHaveTextContent('Lê Văn C'));
    // No follower yet: refused on the screen, nothing sent.
    fireEvent.click(approve);
    expect(await screen.findByTestId('ward-review-problem')).toHaveTextContent(L.errors.WARD_FOLLOW_UP_USER_REQUIRED);
    expect(api.approve).not.toHaveBeenCalled();
    // A person with one unit: the unit is filled in.
    await choose('ward-follow-up-user', 'u-rev');
    expect(screen.getByTestId('ward-follow-up-team-trigger')).toHaveTextContent('Đội 1');
    // A person with two units: the unit is chosen among theirs only (the one already chosen is theirs: it stays).
    await choose('ward-follow-up-user', 'u-two');
    fireEvent.click(screen.getByTestId('ward-follow-up-team-trigger'));
    expect(await screen.findByTestId('ward-follow-up-team-option-d1')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ward-follow-up-team-option-d2'));
    expect(screen.getByTestId('ward-follow-up-team-trigger')).toHaveTextContent('Đội 2');
    // The follower taken away takes the unit with them: nothing half-chosen is sent.
    fireEvent.click(screen.getByTestId('ward-follow-up-user-clear'));
    expect(screen.getByTestId('ward-follow-up-team-trigger')).toHaveTextContent(L.review.followUpTeamPick);
    await choose('ward-follow-up-user', 'u-two');
    await choose('ward-follow-up-team', 'd2');
    fireEvent.click(approve);
    await waitFor(() =>
      expect(api.approve).toHaveBeenCalledWith('w1', expect.objectContaining({ assignedInvestigatorId: 'i1', followUpUserId: 'u-two', followUpTeamId: 'd2' }), '2026-11-13T03:00:00.000Z'),
    );
  });

  it('"Hủy" asks before what PC02 typed in the review is lost (a reason, a requirement), and not when nothing was typed', async () => {
    api.get.mockResolvedValue(detail({ viewerId: 'u-rev', can: { ...NO, review: true, returnIt: true, approve: true } }));
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/ho-so-phan-cong/w1');
    await screen.findByTestId('ward-approve');
    fireEvent.change(screen.getByTestId('ward-return-reason-text'), { target: { value: 'Thiếu biên bản' } });
    fireEvent.click(screen.getByTestId('form-action-cancel'));
    expect(ask).toHaveBeenCalledWith(L.form.cancelConfirm);
    // Refused: still here, the reason still typed.
    expect(screen.getByTestId('ward-return-reason-text')).toHaveValue('Thiếu biên bản');
    // Taken back: nothing typed, nothing asked.
    fireEvent.change(screen.getByTestId('ward-return-reason-text'), { target: { value: '' } });
    ask.mockClear();
    fireEvent.click(screen.getByTestId('form-action-cancel'));
    await waitFor(() => expect(screen.queryByTestId('ward-approve')).not.toBeInTheDocument());
    expect(ask).not.toHaveBeenCalled();
    ask.mockRestore();
  });

  it('a return needs a reason, then sends the reason and the requirements', async () => {
    api.get.mockResolvedValue(detail({ viewerId: 'u-rev', can: { ...NO, review: true, returnIt: true, approve: true } }));
    api.returnIt.mockResolvedValue({});
    renderAt('/ho-so-phan-cong/w1');
    fireEvent.click(await screen.findByTestId('ward-return'));
    expect(await screen.findByTestId('ward-review-problem')).toHaveTextContent(L.errors.WARD_RETURN_REASON_REQUIRED);
    expect(api.returnIt).not.toHaveBeenCalled();
    // The reason is found by typing, without accents.
    fireEvent.click(screen.getByTestId('ward-return-reason-trigger'));
    fireEvent.change(await screen.findByTestId('ward-return-reason-search'), { target: { value: 'thieu tai' } });
    fireEvent.click(await screen.findByTestId('ward-return-reason-option-THIEU_TAI_LIEU'));
    expect(screen.getByTestId('ward-return-reason-trigger')).toHaveTextContent('Thiếu tài liệu');
    fireEvent.click(screen.getByTestId('ward-return'));
    await waitFor(() =>
      expect(api.returnIt).toHaveBeenCalledWith('w1', { reasonCode: 'THIEU_TAI_LIEU', reasonText: null, requirements: [] }, '2026-11-13T03:00:00.000Z'),
    );
  });

  it('a reason the catalogue does not have is created from the field (the words typed already in) and chosen', async () => {
    api.get.mockResolvedValue(detail({ viewerId: 'u-rev', can: { ...NO, review: true, returnIt: true, approve: true } }));
    api.addReturnReason.mockResolvedValue({ code: 'TU_NHAP_1', name: 'Chưa có biên bản hiện trường', existed: false });
    api.returnIt.mockResolvedValue({});
    renderAt('/ho-so-phan-cong/w1');
    fireEvent.click(await screen.findByTestId('ward-return-reason-trigger'));
    const search = await screen.findByTestId('ward-return-reason-search');
    fireEvent.change(search, { target: { value: 'Chưa có biên bản hiện trường' } });
    await waitFor(() => expect(screen.queryByTestId('ward-return-reason-option-THIEU_TAI_LIEU')).not.toBeInTheDocument());
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(await screen.findByTestId('ward-new-reason-name')).toHaveValue('Chưa có biên bản hiện trường');
    // The catalogue then lists it (read again), and the field shows it chosen.
    api.returnReasons.mockResolvedValue([{ code: 'THIEU_TAI_LIEU', name: 'Thiếu tài liệu' }, { code: 'TU_NHAP_1', name: 'Chưa có biên bản hiện trường' }]);
    fireEvent.click(screen.getByTestId('ward-new-reason-save'));
    await waitFor(() => expect(api.addReturnReason).toHaveBeenCalledWith('Chưa có biên bản hiện trường'));
    await waitFor(() => expect(screen.queryByTestId('ward-new-reason')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('ward-return-reason-trigger')).toHaveTextContent('Chưa có biên bản hiện trường'));
    fireEvent.click(screen.getByTestId('ward-return'));
    await waitFor(() => expect(api.returnIt).toHaveBeenCalledWith('w1', expect.objectContaining({ reasonCode: 'TU_NHAP_1' }), '2026-11-13T03:00:00.000Z'));
  });

  it('a refusal to create the reason is said in the dialog, which stays open', async () => {
    api.get.mockResolvedValue(detail({ viewerId: 'u-rev', can: { ...NO, review: true, returnIt: true, approve: true } }));
    api.addReturnReason.mockRejectedValue(axiosError(409, 'WARD_RETURN_REASON_SWITCHED_OFF'));
    renderAt('/ho-so-phan-cong/w1');
    fireEvent.click(await screen.findByTestId('ward-return-reason-trigger'));
    fireEvent.click(await screen.findByTestId('ward-return-reason-create-new'));
    fireEvent.change(await screen.findByTestId('ward-new-reason-name'), { target: { value: 'Lý do đã ngừng dùng' } });
    fireEvent.click(screen.getByTestId('ward-new-reason-save'));
    expect(await screen.findByTestId('ward-new-reason-error')).toHaveTextContent(L.errors.WARD_RETURN_REASON_SWITCHED_OFF);
    expect(screen.getByTestId('ward-new-reason')).toBeInTheDocument();
  });

  it('PC02 assigns somebody the unit did not propose: created from the field into the unit’s directory, and assigned', async () => {
    const created: WardInvestigator = { id: 'i7', teamId: 'tw', fullName: 'Hồ Văn Mới', rank: 'Thiếu tá', position: null, grade: null, isActive: true, updatedAt: '2026-11-17T00:00:00Z' };
    api.get.mockResolvedValue(detail({ viewerId: 'u-rev', can: { ...NO, review: true, returnIt: true, approve: true } }));
    invApi.create.mockResolvedValue(created);
    api.approve.mockResolvedValue({});
    renderAt('/ho-so-phan-cong/w1');
    await screen.findByTestId('ward-approve');
    await waitFor(() => expect(screen.getByTestId('ward-follow-up-user-trigger')).toHaveTextContent('Đặng Văn K'));
    fireEvent.click(screen.getByTestId('ward-assigned-investigator-trigger'));
    const search = await screen.findByTestId('ward-assigned-investigator-search');
    fireEvent.change(search, { target: { value: 'Hồ Văn Mới' } });
    await waitFor(() => expect(screen.queryByTestId('ward-assigned-investigator-option-i1')).not.toBeInTheDocument());
    fireEvent.keyDown(search, { key: 'Enter' });
    expect(await screen.findByTestId('ward-inv-quick-fullName')).toHaveValue('Hồ Văn Mới');
    invApi.list.mockResolvedValue([investigator, created]);
    fireEvent.click(screen.getByTestId('ward-inv-quick-save'));
    // Into the request's own ward unit, not the reviewer's.
    await waitFor(() => expect(invApi.create).toHaveBeenCalledWith('tw', expect.objectContaining({ fullName: 'Hồ Văn Mới' })));
    await waitFor(() => expect(screen.queryByTestId('ward-inv-quick')).not.toBeInTheDocument());
    fireEvent.click(screen.getByTestId('ward-approve'));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith('w1', expect.objectContaining({ assignedInvestigatorId: 'i7' }), '2026-11-13T03:00:00.000Z'));
  });

  it('nobody is created from the follower field: the followers are the accounts of PC02, made in the administration', async () => {
    api.get.mockResolvedValue(detail({ viewerId: 'u-rev', can: { ...NO, review: true, returnIt: true, approve: true } }));
    renderAt('/ho-so-phan-cong/w1');
    fireEvent.click(await screen.findByTestId('ward-follow-up-user-trigger'));
    await screen.findByTestId('ward-follow-up-user-search');
    expect(screen.queryByTestId('ward-follow-up-user-create-new')).not.toBeInTheDocument();
  });

  it('opened to edit by PC02, an approved request is titled "Cập nhật", says where PC02 writes, and its follow-up is editable', async () => {
    api.get.mockResolvedValue(detail({ status: 'APPROVED', viewerId: 'u-rev', receivedOn: '2026-11-16T00:00:00.000Z', resultDueOn: '2027-01-16T00:00:00.000Z', can: { ...NO, review: true, followUp: true, extend: true } }));
    renderAt('/ho-so-phan-cong/w1/edit');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Cập nhật Hồ sơ phân công');
    expect(screen.getByTestId('ward-edit-scope')).toHaveTextContent(L.form.editScopePc02);
    // Block 1 is the ward unit's: read-only here. PC02's result is written.
    expect(screen.getByTestId('ward-summary')).toHaveAttribute('readonly');
    expect(screen.getByTestId('ward-result-text')).not.toHaveAttribute('readonly');
    expect(screen.getByTestId('ward-follow-up-save')).toBeInTheDocument();
  });

  it('opened to edit by somebody who can write nothing of it: said plainly, not a silent read-only page', async () => {
    who.user = WARD_USER;
    api.get.mockResolvedValue(detail({ status: 'APPROVED', can: NO }));
    renderAt('/ho-so-phan-cong/w1/edit');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Chi tiết Hồ sơ phân công');
    expect(screen.getByTestId('ward-edit-scope')).toHaveTextContent(L.form.editScopeNone);
  });

  it('cancels an approval only with a reason', async () => {
    api.get.mockResolvedValue(detail({ status: 'APPROVED', viewerId: 'u-rev', can: { ...NO, review: true, cancelApproval: true } }));
    api.cancelApproval.mockResolvedValue({});
    renderAt('/ho-so-phan-cong/w1');
    fireEvent.click(await screen.findByTestId('ward-cancel-approval'));
    fireEvent.click(await screen.findByTestId('ward-dialog-cancel-approval-confirm'));
    expect(api.cancelApproval).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('ward-dialog-cancel-approval-reason'), { target: { value: 'Duyệt nhầm' } });
    fireEvent.click(screen.getByTestId('ward-dialog-cancel-approval-confirm'));
    await waitFor(() => expect(api.cancelApproval).toHaveBeenCalledWith('w1', 'Duyệt nhầm', '2026-11-13T03:00:00.000Z'));
  });

  it('extends the deadline with a new day and a reason', async () => {
    api.get.mockResolvedValue(detail({ status: 'APPROVED', resultDueOn: '2027-01-16T00:00:00.000Z', viewerId: 'u-rev', can: { ...NO, review: true, followUp: true, extend: true, complete: true } }));
    api.extendDeadline.mockResolvedValue({});
    renderAt('/ho-so-phan-cong/w1');
    fireEvent.click(await screen.findByTestId('ward-extend'));
    fireEvent.change(await screen.findByTestId('ward-dialog-extend-date'), { target: { value: '2027-02-16' } });
    fireEvent.change(screen.getByTestId('ward-dialog-extend-reason'), { target: { value: 'Chờ giám định' } });
    fireEvent.click(screen.getByTestId('ward-dialog-extend-confirm'));
    await waitFor(() => expect(api.extendDeadline).toHaveBeenCalledWith('w1', '2027-02-16', 'Chờ giám định', '2026-11-13T03:00:00.000Z'));
  });

  it('holds the other result actions while the result is typed but not saved (they would throw it away)', async () => {
    api.get.mockResolvedValue(detail({ status: 'APPROVED', resultDueOn: '2027-01-16T00:00:00.000Z', receivedOn: '2026-11-16T00:00:00.000Z', viewerId: 'u-rev', can: { ...NO, review: true, followUp: true, extend: true, complete: true } }));
    api.followUp.mockResolvedValue({});
    renderAt('/ho-so-phan-cong/w1');
    const extend = await screen.findByTestId('ward-extend');
    expect(extend).toBeEnabled();
    fireEvent.change(screen.getByTestId('ward-result-text'), { target: { value: 'Đã khởi tố vụ án' } });
    expect(extend).toBeDisabled();
    expect(screen.getByTestId('ward-follow-up-save-first')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ward-follow-up-save'));
    await waitFor(() =>
      expect(api.followUp).toHaveBeenCalledWith('w1', { receivedOn: '2026-11-16', resultText: 'Đã khởi tố vụ án' }, '2026-11-13T03:00:00.000Z'),
    );
  });

  it('reads the request again every time the page opens (fresh stamp and permissions)', async () => {
    api.get.mockResolvedValue(detail({ can: { ...NO } }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60_000 } } });
    const page = () => (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/ho-so-phan-cong/w1']}>
          <Routes>
            <Route path="/ho-so-phan-cong/:id" element={<WardAssignmentFormPage mode="view" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const first = render(page());
    await screen.findByTestId('ward-block-content');
    first.unmount();
    render(page());
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  });

  it('shows "late N days" for a completion after the deadline', async () => {
    api.get.mockResolvedValue(
      detail({ status: 'APPROVED', resultDueOn: '2027-01-16T00:00:00.000Z', completedOn: '2027-01-20T00:00:00.000Z', timeliness: { onTime: false, lateDays: 4 }, viewerId: 'u-rev', can: { ...NO, review: true, reopen: true } }),
    );
    renderAt('/ho-so-phan-cong/w1');
    expect(await screen.findByTestId('ward-timeliness')).toHaveTextContent(L.followUp.late(4));
    expect(screen.getByTestId('ward-reopen')).toBeInTheDocument();
  });
});

describe('the request slip, printed as the petition form prints its documents', () => {
  const decided = (slipNumber: string | null, kind: 'APPROVE' | 'RETURN' = 'APPROVE') =>
    [{ id: 'r1', sequence: 1, submissionNo: 1, status: 'DECIDED' as const, submittedAt: '2026-11-13T03:00:00Z', submittedById: 'u-ward', snapshot: {}, withdrawnAt: null, withdrawnById: null,
      decisions: [{ id: 'd1', kind, decidedAt: '2026-11-16T03:00:00Z', decidedById: 'u-rev', reasonCode: null, reasonText: kind === 'RETURN' ? 'Thiếu' : null, requirements: ['Báo cáo kết quả'], assignedInvestigatorId: 'i1', followUpUserId: 'u-rev', followUpTeamId: 'd1', revokedAt: null, revokedById: null, revokeReason: null, slipNumber, slipIssuedAt: slipNumber ? '2026-11-16T04:00:00Z' : null }] }];
  const file = { blob: new Blob(['x']), fileName: 'Phieu.docx' };

  it('PC02: "In phiếu" on the action bar shows the signers the server would use and what the slip would leave empty, then issues and saves in one click', async () => {
    who.user = PC02_USER;
    api.get.mockResolvedValue(detail({ status: 'APPROVED', viewerId: 'u-rev', rounds: decided(null), can: { ...NO, review: true, issueSlip: true } }));
    docs.issueSlip.mockResolvedValue({ id: 'd1', kind: 'APPROVE', slipYear: 2026, slipNumber: '7/PYC-PC02-Đ1', slipIssuedAt: '2026-11-17T00:00:00Z', slipDocumentId: 'doc1', signers: null });
    docs.downloadSlip.mockResolvedValue(file);
    renderAt('/ho-so-phan-cong/w1');
    expect(await screen.findByTestId('ward-print')).toHaveTextContent(L.form.actions.print);
    expect(screen.getByTestId('ward-print-bottom')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ward-print'));
    const dialog = await screen.findByTestId('ward-slip-dialog');
    await waitFor(() => expect(within(dialog).getByTestId('ward-slip-signer-canBoThamDinh')).toHaveValue('Đại úy Đặng Văn K'));
    expect(within(dialog).getByTestId('ward-slip-signer-lanhDaoPhong')).toHaveValue('Thượng tá N');
    expect(within(dialog).getByTestId('ward-slip-missing')).toHaveTextContent('Nơi xảy ra');
    fireEvent.change(within(dialog).getByTestId('ward-slip-signer-chiHuyDoi'), { target: { value: 'Trung tá V' } });
    fireEvent.change(within(dialog).getByTestId('ward-slip-manual-number'), { target: { value: '1949A' } });
    fireEvent.click(screen.getByTestId('ward-slip-print'));
    await waitFor(() =>
      expect(docs.issueSlip).toHaveBeenCalledWith('w1', 'd1', { slipNumber: '1949A', signers: { canBoThamDinh: 'Đại úy Đặng Văn K', chiHuyDoi: 'Trung tá V', lanhDaoPhong: 'Thượng tá N' } }),
    );
    // Issued and saved without a second click.
    await waitFor(() => expect(saveDownloadedFile).toHaveBeenCalledWith(file));
    expect(docs.downloadSlip).toHaveBeenCalledWith('w1', 'd1');
    expect(await screen.findByTestId('ward-slip-message')).toHaveTextContent('7/PYC-PC02-Đ1');
    // The slip exists now: the dialog offers the stored file and a reissue, not a second issue.
    expect(screen.queryByTestId('ward-slip-print')).not.toBeInTheDocument();
    expect(screen.getByTestId('ward-slip-download')).toBeInTheDocument();
    expect(screen.getByTestId('ward-slip-reissue')).toBeInTheDocument();
  });

  it('PC02: no slip template in use is said when the dialog opens, and nothing can be issued', async () => {
    who.user = PC02_USER;
    api.get.mockResolvedValue(detail({ status: 'APPROVED', viewerId: 'u-rev', rounds: decided(null), can: { ...NO, review: true, issueSlip: true } }));
    docs.slipDefaults.mockResolvedValue({ decisionId: 'd1', kind: 'APPROVE', revoked: false, slipNumber: null, signers: {}, templateReady: false, missing: [] });
    renderAt('/ho-so-phan-cong/w1');
    fireEvent.click(await screen.findByTestId('ward-print'));
    expect(await screen.findByTestId('ward-slip-template-missing')).toBeInTheDocument();
    expect(screen.getByTestId('ward-slip-print')).toBeDisabled();
    expect(docs.issueSlip).not.toHaveBeenCalled();
  });

  it('PC02: the dialog opens by itself right after an approval', async () => {
    who.user = PC02_USER;
    api.get.mockResolvedValueOnce(detail({ viewerId: 'u-rev', can: { ...NO, review: true, returnIt: true, approve: true } }));
    api.get.mockResolvedValue(detail({ status: 'APPROVED', updatedAt: '2026-11-16T03:00:00.000Z', viewerId: 'u-rev', rounds: decided(null), can: { ...NO, review: true, issueSlip: true } }));
    api.approve.mockResolvedValue({});
    renderAt('/ho-so-phan-cong/w1');
    const approve = await screen.findByTestId('ward-approve');
    await waitFor(() => expect(screen.getByTestId('ward-assigned-investigator-trigger')).toHaveTextContent('Lê Văn C'));
    await waitFor(() => expect(screen.getByTestId('ward-follow-up-user-trigger')).toHaveTextContent('Đặng Văn K'));
    expect(screen.queryByTestId('ward-slip-dialog')).not.toBeInTheDocument();
    fireEvent.click(approve);
    await waitFor(() => expect(api.approve).toHaveBeenCalled());
    expect(await screen.findByTestId('ward-slip-dialog')).toHaveTextContent('Phiếu của lượt Duyệt');
    expect(screen.getByTestId('ward-slip-print')).toBeInTheDocument();
  });

  it('the ward unit saves a slip PC02 issued, and is offered nothing while none is', async () => {
    api.get.mockResolvedValue(detail({ status: 'RETURNED', rounds: decided('3/PYC-PC02-Đ1', 'RETURN'), can: { ...NO, edit: true, submit: true } }));
    docs.downloadSlip.mockResolvedValue(file);
    const first = renderAt('/ho-so-phan-cong/w1');
    fireEvent.click(await screen.findByTestId('ward-print'));
    const dialog = await screen.findByTestId('ward-slip-dialog');
    expect(dialog).toHaveTextContent('Phiếu của lượt Trả về');
    expect(within(dialog).getByTestId('ward-slip-number')).toHaveTextContent('3/PYC-PC02-Đ1');
    // Reading is not reviewing: no number to write, no signer, no reissue, and the defaults are not asked for.
    expect(screen.queryByTestId('ward-slip-print')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ward-slip-reissue')).not.toBeInTheDocument();
    expect(docs.slipDefaults).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('ward-slip-download'));
    await waitFor(() => expect(saveDownloadedFile).toHaveBeenCalledWith(file));
    first.unmount();

    api.get.mockResolvedValue(detail({ status: 'RETURNED', rounds: decided(null, 'RETURN'), can: { ...NO, edit: true, submit: true } }));
    renderAt('/ho-so-phan-cong/w1');
    await screen.findByTestId('ward-returned-banner');
    // The button is there, as "In chứng từ" on the petition form, locked while there is no slip, and says why.
    for (const id of ['ward-print', 'ward-print-bottom']) {
      expect(screen.getByTestId(id)).toBeDisabled();
      expect(screen.getByTestId(id)).toHaveAttribute('title', L.list.actions.printNotIssued);
    }
    fireEvent.click(screen.getByTestId('ward-print'));
    expect(screen.queryByTestId('ward-slip-dialog')).not.toBeInTheDocument();
  });
});

describe('the shared desk at PC02 (one account the ward officers enter on)', () => {
  const INTAKE_USER = {
    id: 'u-desk', email: 'desk@x', role: 'OFFICER', firstName: 'chung', lastName: 'Nhập', phone: '0900 000 009', teams: [{ teamId: 'd1', teamName: 'Đội 1', isLeader: false }],
    primaryTeam: { teamId: 'd1', teamName: 'Đội 1' }, isWardOfficer: false, wardTeam: null,
  };
  /** A draft the desk entered and has not submitted: everything a submission needs is in it. */
  const draft = (over: Partial<WardAssignmentDetail> = {}) =>
    detail({ id: 'w9', status: 'DRAFT', code: null, rounds: [], submissionCount: 0, submittedAt: null, entryOfficerPhone: '0901 111 222', viewerId: 'u-desk', intake: true, can: { ...NO, edit: true, submit: true, delete: true }, ...over });

  beforeEach(() => {
    who.user = INTAKE_USER;
    api.viewer.mockResolvedValue({ intake: true });
  });

  it('a new form says what the desk is, starts with the entering officer and the phone empty, and refuses a submission naming both', async () => {
    renderAt('/ho-so-phan-cong/new');
    expect(await screen.findByTestId('ward-intake-notice')).toHaveTextContent(L.intake.formNotice);
    // Never the account's own name and phone: the officer at the desk types theirs.
    expect(screen.getByTestId('ward-entry-officer')).toHaveValue('');
    expect(screen.getByTestId('ward-entry-phone')).toHaveValue('');
    fireEvent.click(screen.getByTestId('ward-submit'));
    const box = await screen.findByTestId('validation-errors');
    expect(box).toHaveTextContent(L.form.required(L.form.fields.unit));
    expect(box).toHaveTextContent(L.form.required(L.form.fields.entryOfficerName));
    expect(box).toHaveTextContent(L.form.required(L.form.fields.entryOfficerPhone));
    expect(api.create).not.toHaveBeenCalled();
    expect(api.submit).not.toHaveBeenCalled();
    // The name alone is not enough: the phone is still asked for.
    fireEvent.change(screen.getByTestId('ward-entry-officer'), { target: { value: 'Trần Văn H' } });
    fireEvent.click(screen.getByTestId('ward-submit'));
    await waitFor(() => expect(screen.getByTestId('validation-errors')).not.toHaveTextContent(L.form.required(L.form.fields.entryOfficerName)));
    expect(screen.getByTestId('validation-errors')).toHaveTextContent(L.form.required(L.form.fields.entryOfficerPhone));
    expect(api.create).not.toHaveBeenCalled();
  });

  it('"Trình duyệt" of a draft: a blank new form with the code in a green banner; the request is not read again and the list is not opened', async () => {
    api.get.mockResolvedValue(draft());
    api.update.mockResolvedValue(draft({ updatedAt: '2026-11-18T02:00:00.000Z' }));
    api.submit.mockResolvedValue({ code: '2026-7' });
    renderAt('/ho-so-phan-cong/w9/edit');
    fireEvent.click(await screen.findByTestId('ward-submit'));
    await waitFor(() => expect(api.submit).toHaveBeenCalledWith('w9', '2026-11-18T02:00:00.000Z'));
    const banner = await screen.findByTestId('ward-banner');
    expect(banner).toHaveTextContent(L.intake.submitted('2026-7'));
    expect(banner).toHaveAttribute('role', 'status');
    // The new form, blank: nothing of the request just submitted, nothing of the account.
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(L.form.titleNew);
    expect(screen.getByTestId('ward-summary')).toHaveValue('');
    expect(screen.getByTestId('ward-entry-officer')).toHaveValue('');
    expect(screen.getByTestId('ward-entry-phone')).toHaveValue('');
    // Not the list (its route shows `where`), and not one more read of a request the desk no longer sees.
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ward-form-error')).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('submitted from the new form itself: the address stays, the form starts over blank, with the banner', async () => {
    api.create.mockResolvedValue(draft({ updatedAt: '2026-11-18T03:00:00.000Z' }));
    api.submit.mockResolvedValue({ code: '2026-8' });
    renderAt('/ho-so-phan-cong/new');
    await choose('ward-unit', 'tw');
    await fillRequired();
    fireEvent.change(screen.getByTestId('ward-entry-officer'), { target: { value: 'Trần Văn H' } });
    fireEvent.change(screen.getByTestId('ward-entry-phone'), { target: { value: '0901 111 222' } });
    fireEvent.click(screen.getByTestId('ward-submit'));
    await waitFor(() => expect(api.submit).toHaveBeenCalledWith('w9', '2026-11-18T03:00:00.000Z'));
    expect(api.create.mock.calls[0][0]).toMatchObject({ assignedTeamId: 'tw', entryOfficerName: 'Trần Văn H', entryOfficerPhone: '0901 111 222' });
    expect(await screen.findByTestId('ward-banner')).toHaveTextContent(L.intake.submitted('2026-8'));
    await waitFor(() => expect(screen.getByTestId('ward-summary')).toHaveValue(''));
    expect(screen.getByTestId('ward-entry-officer')).toHaveValue('');
    expect(screen.getByTestId('ward-entry-phone')).toHaveValue('');
    expect(screen.getByTestId('ward-unit-trigger')).not.toHaveTextContent('CAP Vườn Lài');
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('a submission answered "not found" (a second click after the first went through) is a request already submitted', async () => {
    api.get.mockResolvedValue(draft());
    api.update.mockResolvedValue(draft({ updatedAt: '2026-11-18T02:00:00.000Z' }));
    api.submit.mockRejectedValue(axiosError(404, 'WARD_ASSIGNMENT_NOT_FOUND'));
    renderAt('/ho-so-phan-cong/w9/edit');
    fireEvent.click(await screen.findByTestId('ward-submit'));
    const banner = await screen.findByTestId('ward-banner');
    expect(banner).toHaveTextContent(L.intake.alreadySubmitted);
    expect(banner).toHaveAttribute('role', 'status');
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(L.form.titleNew);
    expect(screen.getByTestId('ward-summary')).toHaveValue('');
    await new Promise((r) => setTimeout(r, 50));
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('another refusal of the submission is still said on the request (it is not taken for a submission done)', async () => {
    api.get.mockResolvedValue(draft());
    api.update.mockResolvedValue(draft({ updatedAt: '2026-11-18T02:00:00.000Z' }));
    api.submit.mockRejectedValue(axiosError(400, 'WARD_ASSIGNMENT_INCOMPLETE', [{ field: 'entryOfficerPhone' }]));
    renderAt('/ho-so-phan-cong/w9/edit');
    fireEvent.click(await screen.findByTestId('ward-submit'));
    const banner = await screen.findByTestId('ward-banner');
    expect(banner).toHaveTextContent(L.errors.WARD_ASSIGNMENT_INCOMPLETE);
    expect(banner).toHaveTextContent(L.form.fields.entryOfficerPhone);
    expect(screen.getByTestId('where')).toHaveTextContent('/ho-so-phan-cong/w9/edit');
  });

  it('a re-assignment names the request it follows by its code: found, not found, and cleared when the code or the unit changes', async () => {
    api.previousByCode.mockResolvedValue({ id: 'p1', code: '2026-3' });
    api.create.mockResolvedValue(draft());
    renderAt('/ho-so-phan-cong/new');
    fireEvent.click(await screen.findByTestId('ward-kind-REASSIGN'));
    // No list of approved requests: the desk reads none.
    expect(screen.queryByTestId('ward-previous')).not.toBeInTheDocument();
    const code = screen.getByTestId('ward-previous-code');
    expect(code).toHaveAttribute('placeholder', L.intake.previousCodePlaceholder);
    const check = screen.getByTestId('ward-previous-check');
    expect(check).toHaveTextContent(L.intake.previousCheck);
    // The unit first: the code is a code of that unit.
    fireEvent.change(code, { target: { value: '2026-3' } });
    expect(check).toBeDisabled();
    expect(check).toHaveAttribute('title', L.intake.previousPickUnitFirst);
    await choose('ward-unit', 'tw');
    expect(check).toBeEnabled();
    fireEvent.click(check);
    await waitFor(() => expect(api.previousByCode).toHaveBeenCalledWith('tw', '2026-3'));
    expect(await screen.findByTestId('ward-previous-found')).toHaveTextContent(L.intake.previousFound('2026-3'));
    // Another unit: what was found belonged to the unit before.
    await choose('ward-unit', 'tw2');
    expect(screen.queryByTestId('ward-previous-found')).not.toBeInTheDocument();
    api.previousByCode.mockRejectedValue(axiosError(404, 'WARD_ASSIGNMENT_PREVIOUS_UNKNOWN'));
    fireEvent.click(check);
    expect(await screen.findByTestId('ward-previous-problem')).toHaveTextContent(L.intake.previousNotFound);
    expect(api.previousByCode).toHaveBeenLastCalledWith('tw2', '2026-3');
    expect(screen.queryByTestId('ward-previous-found')).not.toBeInTheDocument();
    // Not found: a submission still asks for the previous request.
    fireEvent.click(screen.getByTestId('ward-submit'));
    expect(await screen.findByTestId('validation-errors')).toHaveTextContent(L.form.required(L.form.fields.previous));
    // Another code: the answer about the old one is taken away, and the new one is asked about.
    fireEvent.change(code, { target: { value: '2026-4' } });
    expect(screen.queryByTestId('ward-previous-problem')).not.toBeInTheDocument();
    api.previousByCode.mockResolvedValue({ id: 'p4', code: '2026-4' });
    fireEvent.click(check);
    expect(await screen.findByTestId('ward-previous-found')).toHaveTextContent(L.intake.previousFound('2026-4'));
    // Changing the text lets go of the request found; found again, it is what the draft saved names.
    fireEvent.change(code, { target: { value: '2026-40' } });
    expect(screen.queryByTestId('ward-previous-found')).not.toBeInTheDocument();
    fireEvent.change(code, { target: { value: '2026-4' } });
    fireEvent.click(check);
    await screen.findByTestId('ward-previous-found');
    fireEvent.click(screen.getByTestId('ward-save-draft'));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0]).toMatchObject({ kind: 'REASSIGN', assignedTeamId: 'tw2', previousAssignmentId: 'p4' });
    // The approved requests were never listed for the desk.
    expect(api.list).not.toHaveBeenCalled();
  });

  it('a code whose text was changed after it was found is not sent as found', async () => {
    api.previousByCode.mockResolvedValue({ id: 'p1', code: '2026-3' });
    api.create.mockResolvedValue(draft());
    renderAt('/ho-so-phan-cong/new');
    fireEvent.click(await screen.findByTestId('ward-kind-REASSIGN'));
    await choose('ward-unit', 'tw');
    fireEvent.change(screen.getByTestId('ward-previous-code'), { target: { value: '2026-3' } });
    fireEvent.click(screen.getByTestId('ward-previous-check'));
    await screen.findByTestId('ward-previous-found');
    fireEvent.change(screen.getByTestId('ward-previous-code'), { target: { value: '2026-31' } });
    fireEvent.click(screen.getByTestId('ward-save-draft'));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0].previousAssignmentId).toBeNull();
  });

  it('a draft re-assignment opened again shows the code of the request it follows, as found', async () => {
    api.get.mockResolvedValue(draft({ kind: 'REASSIGN', previousAssignmentId: 'p1', previousAssignment: { code: '2026-3' }, reassignReason: 'ĐTV chuyển công tác' }));
    api.update.mockResolvedValue(draft());
    renderAt('/ho-so-phan-cong/w9/edit');
    expect(await screen.findByTestId('ward-previous-code')).toHaveValue('2026-3');
    expect(screen.getByTestId('ward-previous-found')).toHaveTextContent(L.intake.previousFound('2026-3'));
    expect(screen.queryByTestId('ward-previous')).not.toBeInTheDocument();
    // Saved untouched, it still names that request.
    fireEvent.click(screen.getByTestId('ward-save-draft'));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
    expect(api.update.mock.calls[0][1]).toMatchObject({ previousAssignmentId: 'p1' });
    expect(api.previousByCode).not.toHaveBeenCalled();
    expect(api.list).not.toHaveBeenCalled();
  });

  it('investigators are chosen and added, never corrected or stopped: no pencil, no directory, no status in the dialog', async () => {
    const created: WardInvestigator = { id: 'i9', teamId: 'tw', fullName: 'Phạm Văn Mới', rank: null, position: null, grade: null, isActive: true, updatedAt: '2026-11-17T00:00:00Z' };
    invApi.create.mockResolvedValue(created);
    renderAt('/ho-so-phan-cong/new');
    await choose('ward-unit', 'tw');
    await choose('ward-proposed-investigator', 'i1');
    expect(screen.getByTestId('ward-proposed-investigator-trigger')).toHaveTextContent('Lê Văn C');
    expect(screen.queryByTestId('ward-edit-investigator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ward-open-directory')).not.toBeInTheDocument();
    // A name nobody carries is still created from the field.
    fireEvent.click(screen.getByTestId('ward-proposed-investigator-trigger'));
    const search = await screen.findByTestId('ward-proposed-investigator-search');
    fireEvent.change(search, { target: { value: 'Phạm Văn Mới' } });
    await waitFor(() => expect(screen.queryByTestId('ward-proposed-investigator-option-i1')).not.toBeInTheDocument());
    fireEvent.keyDown(search, { key: 'Enter' });
    const dialog = await screen.findByTestId('ward-inv-quick');
    expect(within(dialog).getByTestId('ward-inv-quick-fullName')).toHaveValue('Phạm Văn Mới');
    expect(within(dialog).queryByTestId('ward-inv-quick-status')).not.toBeInTheDocument();
    invApi.list.mockResolvedValue([investigator, created]);
    fireEvent.click(screen.getByTestId('ward-inv-quick-save'));
    await waitFor(() => expect(invApi.create).toHaveBeenCalledWith('tw', { fullName: 'Phạm Văn Mới', rank: null, position: null, grade: null }));
    await waitFor(() => expect(screen.queryByTestId('ward-inv-quick')).not.toBeInTheDocument());
    expect(invApi.update).not.toHaveBeenCalled();
    expect(invApi.deactivate).not.toHaveBeenCalled();
    // The one created is chosen, and still has no pencil.
    await waitFor(() => expect(screen.getByTestId('ward-proposed-investigator-trigger')).toHaveTextContent('Phạm Văn Mới'));
    expect(screen.queryByTestId('ward-edit-investigator')).not.toBeInTheDocument();
  });

  it('a request says the reader is the desk even when the viewer question got no answer', async () => {
    api.viewer.mockRejectedValue(new Error('down'));
    api.get.mockResolvedValue(draft());
    renderAt('/ho-so-phan-cong/w9/edit');
    expect(await screen.findByTestId('ward-intake-notice')).toBeInTheDocument();
  });
});

describe('an account that is not the shared desk, with the viewer answering so', () => {
  beforeEach(() => {
    api.viewer.mockResolvedValue({ intake: false });
  });

  it('keeps the prefill from the account, the list of approved requests, the pencil and the directory; no desk notice', async () => {
    api.list.mockResolvedValue({ data: [{ ...detail({ id: 'p1', code: '2026-00077', status: 'APPROVED' }) }], total: 1 });
    renderAt('/ho-so-phan-cong/new');
    expect(await screen.findByTestId('ward-entry-officer')).toHaveValue('Võ Thị G');
    expect(screen.getByTestId('ward-entry-phone')).toHaveValue('0900 000 001');
    expect(screen.queryByTestId('ward-intake-notice')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ward-kind-REASSIGN'));
    const previous = await screen.findByTestId('ward-previous');
    await waitFor(() => expect(within(previous).getByText(/2026-00077/)).toBeInTheDocument());
    expect(screen.queryByTestId('ward-previous-code')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ward-previous-check')).not.toBeInTheDocument();
    expect(api.previousByCode).not.toHaveBeenCalled();
    await choose('ward-proposed-investigator', 'i1');
    expect(screen.getByTestId('ward-edit-investigator')).toBeInTheDocument();
    expect(screen.getByTestId('ward-open-directory')).toBeInTheDocument();
    // The phone is not asked of an account that is somebody's own.
    fireEvent.change(screen.getByTestId('ward-entry-phone'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('ward-submit'));
    expect(await screen.findByTestId('validation-errors')).not.toHaveTextContent(L.form.required(L.form.fields.entryOfficerPhone));
  });

  it('a submission still goes back to the list', async () => {
    api.create.mockResolvedValue(detail({ id: 'w9', status: 'DRAFT', code: null, updatedAt: '2026-11-16T05:00:00.000Z' }));
    api.submit.mockResolvedValue(detail({ id: 'w9' }));
    renderAt('/ho-so-phan-cong/new');
    await fillRequired();
    fireEvent.click(screen.getByTestId('ward-submit'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/ho-so-phan-cong'));
  });
});
