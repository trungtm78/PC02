import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AxiosError, AxiosHeaders } from 'axios';
import WardAssignmentFormPage from '../WardAssignmentFormPage';
import { wardAssignmentsApi, wardInvestigatorsApi } from '@/features/ward-assignments/api';
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
      reopen: fn(), returnReasons: fn(), deletionImpact: fn(), removeWithData: fn(),
    },
    wardInvestigatorsApi: { list: fn(), create: fn(), update: fn(), deactivate: fn(), reactivate: fn() },
  };
});
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(async (url: string) => {
      if (url === '/teams/options') return { data: [{ id: 'tw', name: 'CAP Vườn Lài', wardId: 'w1' }, { id: 'tw2', name: 'CAX Bình Mỹ', wardId: 'w2' }, { id: 'd1', name: 'Đội 1', wardId: null }] };
      return { data: [] };
    }),
  },
}));
vi.mock('@/hooks/useOfficerOptions', () => ({
  useOfficerOptions: () => ({ data: [{ value: 'u-rev', label: 'Đặng Văn K', teams: [{ teamId: 'd1', teamName: 'Đội 1', isLeader: false, laDiaBan: false }] }] }),
}));
const who = vi.hoisted(() => ({ user: null as unknown }));
vi.mock('@/stores/auth.store', () => ({ authStore: { getUser: () => who.user } }));

const api = vi.mocked(wardAssignmentsApi);
const invApi = vi.mocked(wardInvestigatorsApi);

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
  api.list.mockResolvedValue({ data: [], total: 0 });
});

describe('a new request, by a ward officer', () => {
  it('fixes the unit to theirs and fills the entering officer with them', async () => {
    renderAt('/ho-so-phan-cong/new');
    expect(await screen.findByTestId('ward-unit-fixed')).toHaveTextContent('CAP Vườn Lài');
    expect(screen.queryByTestId('ward-unit')).not.toBeInTheDocument();
    expect(screen.getByTestId('ward-entry-officer')).toHaveValue('Võ Thị G');
    expect(screen.getByTestId('ward-entry-phone')).toHaveValue('0900 000 001');
  });

  it('saves a draft without naming the unit (the server takes the officer’s own) and opens it', async () => {
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
    expect(await screen.findByTestId('where')).toHaveTextContent('/ho-so-phan-cong/w9');
  });

  it('"Trình duyệt" saves then submits with the stamp the save returned', async () => {
    api.create.mockResolvedValue(detail({ id: 'w9', status: 'DRAFT', code: null, updatedAt: '2026-11-16T05:00:00.000Z' }));
    api.submit.mockResolvedValue(detail({ id: 'w9' }));
    renderAt('/ho-so-phan-cong/new');
    fireEvent.click(await screen.findByTestId('ward-submit'));
    await waitFor(() => expect(api.submit).toHaveBeenCalledWith('w9', '2026-11-16T05:00:00.000Z'));
  });

  it('lists what is still missing when the server refuses the submission as incomplete', async () => {
    api.create.mockResolvedValue(detail({ id: 'w9', status: 'DRAFT', code: null }));
    api.submit.mockRejectedValue(axiosError(400, 'WARD_ASSIGNMENT_INCOMPLETE', [{ field: 'summary' }, { field: 'proposedInvestigatorId' }]));
    api.get.mockResolvedValue(detail({ id: 'w9', status: 'DRAFT', code: null, rounds: [], can: { ...NO, edit: true, submit: true, delete: true } }));
    renderAt('/ho-so-phan-cong/new');
    fireEvent.click(await screen.findByTestId('ward-submit'));
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
    const unit = await screen.findByTestId('ward-unit');
    await waitFor(() => expect(within(unit).getByText('CAX Bình Mỹ')).toBeInTheDocument());
    expect(within(unit).queryByText('Đội 1')).not.toBeInTheDocument();
    fireEvent.change(unit, { target: { value: 'tw2' } });
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
        rounds: [{ id: 'r1', sequence: 1, submissionNo: 1, status: 'DECIDED', submittedAt: '2026-11-13T03:00:00Z', submittedById: 'u-ward', snapshot: {}, withdrawnAt: null, withdrawnById: null,
          decisions: [{ id: 'd1', kind: 'APPROVE', decidedAt: '2026-11-16T03:00:00Z', decidedById: 'u-rev', reasonCode: null, reasonText: null, requirements: ['Báo cáo kết quả'], assignedInvestigatorId: 'i1', followUpUserId: 'u-rev', followUpTeamId: 'd1', revokedAt: null, revokedById: null, revokeReason: null, slipNumber: null, slipIssuedAt: null }] }],
      }),
    );
    renderAt('/ho-so-phan-cong/w1');
    const review = await screen.findByTestId('ward-block-review');
    expect(within(review).getByTestId('ward-decision-in-force')).toHaveTextContent('Lê Văn C');
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
    await waitFor(() => expect(screen.getByTestId('ward-assigned-investigator')).toHaveValue('i1'));
    fireEvent.click(screen.getByTestId('ward-requirements-add'));
    fireEvent.change(screen.getByLabelText(`${L.review.requirements} 1`), { target: { value: ' Báo cáo kết quả ' } });
    fireEvent.click(approve);
    await waitFor(() =>
      expect(api.approve).toHaveBeenCalledWith('w1', expect.objectContaining({ assignedInvestigatorId: 'i1', followUpUserId: 'u-rev', followUpTeamId: 'd1', requirements: ['Báo cáo kết quả'] }), '2026-11-13T03:00:00.000Z'),
    );
  });

  it('a return needs a reason, then sends the reason and the requirements', async () => {
    api.get.mockResolvedValue(detail({ viewerId: 'u-rev', can: { ...NO, review: true, returnIt: true, approve: true } }));
    api.returnIt.mockResolvedValue({});
    renderAt('/ho-so-phan-cong/w1');
    fireEvent.click(await screen.findByTestId('ward-return'));
    expect(await screen.findByTestId('ward-review-problem')).toHaveTextContent(L.errors.WARD_RETURN_REASON_REQUIRED);
    expect(api.returnIt).not.toHaveBeenCalled();
    await waitFor(() => expect(within(screen.getByTestId('ward-return-reason')).getByText('Thiếu tài liệu')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('ward-return-reason'), { target: { value: 'THIEU_TAI_LIEU' } });
    fireEvent.click(screen.getByTestId('ward-return'));
    await waitFor(() =>
      expect(api.returnIt).toHaveBeenCalledWith('w1', { reasonCode: 'THIEU_TAI_LIEU', reasonText: null, requirements: [] }, '2026-11-13T03:00:00.000Z'),
    );
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

  it('shows "late N days" for a completion after the deadline', async () => {
    api.get.mockResolvedValue(
      detail({ status: 'APPROVED', resultDueOn: '2027-01-16T00:00:00.000Z', completedOn: '2027-01-20T00:00:00.000Z', timeliness: { onTime: false, lateDays: 4 }, viewerId: 'u-rev', can: { ...NO, review: true, reopen: true } }),
    );
    renderAt('/ho-so-phan-cong/w1');
    expect(await screen.findByTestId('ward-timeliness')).toHaveTextContent(L.followUp.late(4));
    expect(screen.getByTestId('ward-reopen')).toBeInTheDocument();
  });
});
