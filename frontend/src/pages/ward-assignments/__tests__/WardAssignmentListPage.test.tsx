import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import WardAssignmentListPage from '../WardAssignmentListPage';
import { wardAssignmentsApi } from '@/features/ward-assignments/api';
import { saveDownloadedFile, wardDocsApi } from '@/features/ward-assignments/api/docs';
import type { WardAssignmentRow, WardListQuery } from '@/features/ward-assignments/types';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';

vi.mock('@/features/ward-assignments/api', async (orig) => {
  const real = await orig<typeof import('@/features/ward-assignments/api')>();
  return { ...real, wardAssignmentsApi: { list: vi.fn(), listStats: vi.fn(), filterUnits: vi.fn(), remove: vi.fn() } };
});
vi.mock('@/features/ward-assignments/api/docs', async (orig) => {
  const real = await orig<typeof import('@/features/ward-assignments/api/docs')>();
  return { ...real, saveDownloadedFile: vi.fn(), wardDocsApi: { slipDefaults: vi.fn(), issueSlip: vi.fn(), downloadSlip: vi.fn(), reissueSlip: vi.fn() } };
});
const api = vi.mocked(wardAssignmentsApi);
const docs = vi.mocked(wardDocsApi);
const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({
    permissions: held.value,
    // As the real hook: the screen's resource and action become the server's `action:Subject`.
    hasPermission: (resource: string, action: string) => held.value === null || (resource === 'wardAssignments' && held.value.includes(`${action === 'view' ? 'read' : action}:WardAssignment`)),
    canDispatch: false,
  }),
}));

function row(over: Partial<WardAssignmentRow> = {}): WardAssignmentRow {
  return {
    id: 'w1',
    code: '2026-00186',
    status: 'SUBMITTED',
    assignedTeamId: 't1',
    assignedTeam: { id: 't1', name: 'CAP Vườn Lài' },
    caseType: 'CASE',
    kind: 'NEW',
    crimeId: 'c1',
    crime: { id: 'c1', name: 'Đánh bạc' },
    crimeOther: null,
    summary: 'Nhóm đánh bạc tại nhà trọ',
    submissionCount: 1,
    submittedAt: '2026-11-14T03:00:00.000Z',
    resultDueOn: null,
    completedOn: null,
    archivedAt: null,
    updatedAt: '2026-11-14T03:00:00.000Z',
    ...over,
  };
}

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function renderPage(entry = '/ho-so-phan-cong') {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/ho-so-phan-cong" element={<WardAssignmentListPage />} />
          <Route path="/ho-so-phan-cong/new" element={<Where />} />
          <Route path="/ho-so-phan-cong/:id" element={<Where />} />
          <Route path="/ho-so-phan-cong/:id/edit" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const rows = [
  row(),
  row({ id: 'w2', code: '2026-00185', status: 'SUBMITTED', submissionCount: 3, caseType: 'INCIDENT', crime: null, crimeId: null, crimeOther: 'Trộm xe' }),
  row({ id: 'w3', code: null, status: 'DRAFT', submittedAt: null, submissionCount: 0 }),
  row({ id: 'w4', code: '2026-00142', status: 'APPROVED', kind: 'REASSIGN', resultDueOn: '2026-11-22T00:00:00.000Z' }),
];

beforeEach(() => {
  vi.resetAllMocks();
  held.value = null;
  api.list.mockImplementation(async (q: WardListQuery) => {
    const data = rows.filter((r) => !q.status || r.status === q.status);
    return { data, total: data.length };
  });
  // The six cards in ONE answer.
  api.listStats.mockResolvedValue({ all: 4, byStatus: { DRAFT: 1, SUBMITTED: 2, RETURNED: 0, APPROVED: 1 }, archived: 2 });
  api.filterUnits.mockResolvedValue([{ id: 't1', name: 'CAP Vườn Lài' }, { id: 't2', name: 'CAX Bình Mỹ' }]);
});

/** The last list request the screen sent. */
const lastList = () => api.list.mock.calls.at(-1)![0];

describe('the list of ward assignment requests', () => {
  it('shows the ten default columns with their values', async () => {
    renderPage();
    const first = await screen.findByTestId('ward-row-w1');
    const { place, entryOfficerName, ...shown } = L.list.columns;
    for (const header of Object.values(shown)) expect(screen.getAllByText(header).length).toBeGreaterThan(0);
    // Two more columns are there to be shown, hidden until asked for.
    for (const header of [place, entryOfficerName]) expect(screen.queryByRole('columnheader', { name: header })).not.toBeInTheDocument();
    expect(within(first).getByText('2026-00186')).toBeInTheDocument();
    expect(within(first).getByText('14/11/2026')).toBeInTheDocument();
    expect(within(first).getByText('CAP Vườn Lài')).toBeInTheDocument();
    expect(within(first).getByText(L.caseType.CASE)).toBeInTheDocument();
    expect(within(first).getByText(L.kind.NEW)).toBeInTheDocument();
    expect(within(first).getByText('Đánh bạc')).toBeInTheDocument();
    expect(within(first).getByText(L.status.SUBMITTED)).toBeInTheDocument();
    expect(within(screen.getByTestId('ward-row-w2')).getByText('Trộm xe')).toBeInTheDocument();
    expect(within(screen.getByTestId('ward-row-w2')).getByText(L.resubmitted)).toBeInTheDocument();
    expect(within(screen.getByTestId('ward-row-w4')).getByText(L.kind.REASSIGN)).toBeInTheDocument();
  });

  it('renders the plain due date in the deadline cell, and nothing when there is none', async () => {
    renderPage();
    expect(await screen.findByTestId('ward-due-w4')).toHaveTextContent('22/11/2026');
    expect(screen.getByTestId('ward-due-w1')).toHaveTextContent('');
  });

  it('opens a request from its code, a draft from "no code yet"', async () => {
    renderPage();
    fireEvent.click(within(await screen.findByTestId('ward-row-w3')).getByText(L.list.noCode));
    expect(await screen.findByTestId('where')).toHaveTextContent('/ho-so-phan-cong/w3');
  });

  it('counts each status on its card, and a card filters the list by it', async () => {
    renderPage();
    const submitted = await screen.findByTestId('ward-card-SUBMITTED');
    await waitFor(() => expect(submitted).toHaveTextContent('2'));
    expect(screen.getByTestId('ward-card-all')).toHaveTextContent('4');
    expect(screen.getByTestId('ward-card-archived')).toHaveTextContent('2');
    // One request for the six numbers, not one per card.
    expect(api.listStats).toHaveBeenCalledTimes(1);
    expect(api.list.mock.calls.every(([q]) => q.pageSize === 20)).toBe(true);
    fireEvent.click(screen.getByTestId('ward-card-APPROVED'));
    await waitFor(() => expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'APPROVED', pageSize: 20 })));
    await waitFor(() => expect(screen.queryByTestId('ward-row-w1')).not.toBeInTheDocument());
    expect(screen.getByTestId('ward-row-w4')).toBeInTheDocument();
  });

  it('the archived card lists the archived requests', async () => {
    renderPage();
    // The cards are buttons once their numbers have come.
    await waitFor(() => expect(screen.getByTestId('ward-card-archived')).toHaveTextContent('2'));
    fireEvent.click(screen.getByTestId('ward-card-archived'));
    await waitFor(() => expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ archived: true, pageSize: 20 })));
  });

  it('tags of the search box go to the rows and to the cards alike; the cards are not told which card is open', async () => {
    renderPage('/ho-so-phan-cong?hspc_tk=trichYeu~xe%20m%C3%A1y&hspc_tk=loaiHoSo~CASE&hspc_the=SUBMITTED');
    await screen.findByTestId('ward-row-w1');
    expect(lastList()).toMatchObject({ tk: ['trichYeu~xe máy', 'loaiHoSo~CASE'], status: 'SUBMITTED' });
    const counted = api.listStats.mock.calls.at(-1)![0];
    expect(counted).toMatchObject({ tk: ['trichYeu~xe máy', 'loaiHoSo~CASE'] });
    // The api client strips what a card stands for; the screen hands it the filters and nothing of the page.
    expect(counted).not.toHaveProperty('page');
    expect(counted).not.toHaveProperty('status');
    // The tags are shown, each by the label of its column.
    expect(screen.getAllByText(/Trích yếu/).length).toBeGreaterThan(1);
  });

  it('an address of the old search box (hspc_q) still opens: as the tag "every column"', async () => {
    renderPage('/ho-so-phan-cong?hspc_q=2026-00185');
    await screen.findByTestId('ward-row-w1');
    expect(lastList()).toMatchObject({ tk: ['*~2026-00185'] });
    expect(lastList()).not.toHaveProperty('q');
  });

  it('a column header sorts: first click one way, the request carries the column; the page goes back to 1', async () => {
    renderPage('/ho-so-phan-cong?hspc_page=2');
    await screen.findByTestId('ward-row-w1');
    expect(lastList()).not.toHaveProperty('sortBy');
    fireEvent.click(await screen.findByTestId('sort-code'));
    await waitFor(() => expect(lastList()).toMatchObject({ sortBy: 'code', page: 1 }));
    const first = lastList().sortOrder;
    fireEvent.click(await screen.findByTestId('sort-code'));
    await waitFor(() => expect(lastList().sortOrder).not.toBe(first));
    // The columns that sort are the ones the server sorts by; the unit (a relation) is not offered.
    await screen.findByTestId('ward-row-w1');
    for (const key of ['submittedAt', 'resultDueOn', 'status', 'submissionCount', 'summary']) expect(screen.getByTestId(`sort-${key}`)).toBeInTheDocument();
    expect(screen.queryByTestId('sort-unit')).not.toBeInTheDocument();
  });

  it('the filter panel: unit, kinds, alert and the first submission day, applied together, counted, and taken back in one click', async () => {
    renderPage('/ho-so-phan-cong?hspc_don_vi=t2&hspc_loai_ho_so=INCIDENT&hspc_canh_bao=OVERDUE&hspc_from_date=2026-11-01&hspc_to_date=2026-11-30&hspc_the=APPROVED&hspc_sort=code');
    await screen.findByTestId('ward-row-w4');
    const filters = { teamId: 't2', caseType: 'INCIDENT', alert: 'OVERDUE', from: '2026-11-01', to: '2026-11-30' };
    expect(lastList()).toMatchObject({ ...filters, status: 'APPROVED', sortBy: 'code' });
    expect(api.listStats.mock.calls.at(-1)![0]).toMatchObject(filters);
    // Five filters and the card.
    expect(await screen.findByTestId('list-page-shell-filter-count')).toHaveTextContent('6');
    fireEvent.click(screen.getByTestId('list-page-shell-reset-filters'));
    await waitFor(() => expect(lastList()).toEqual({ page: 1, pageSize: 20 }));
  });

  it('the unit filter offers the units the server names (those with a request the person may read)', async () => {
    renderPage('/ho-so-phan-cong?hspc_don_vi=t2');
    await screen.findByTestId('ward-row-w1');
    const unit = await screen.findByTestId('filter-don-vi');
    await waitFor(() => expect(within(unit).getByText('CAX Bình Mỹ')).toBeInTheDocument());
    expect(unit).toHaveValue('t2');
  });

  it('Excel: the button sends the filters, the card, the order and the columns shown, and nothing of the page', async () => {
    const { api: http } = await import('@/lib/api');
    // Only the export answers: the other calls of the screen (saved layout, settings) stay what they are in a test.
    const get = vi.spyOn(http, 'get').mockImplementation(((u: string) =>
      u.startsWith('/ward-assignments/export') ? Promise.resolve({ data: new Blob(['x']), headers: {} }) : Promise.reject(new Error('offline'))) as never);
    renderPage('/ho-so-phan-cong?hspc_tk=trichYeu~xe&hspc_the=SUBMITTED&hspc_sort=code&hspc_dir=asc&hspc_loai_ho_so=CASE');
    await screen.findByTestId('ward-row-w1');
    fireEvent.click(screen.getByTestId('btn-xuat-dang-xem'));
    await waitFor(() => expect(get).toHaveBeenCalledWith('/ward-assignments/export/danh-sach', expect.anything()));
    const sent = get.mock.calls.find(([u]) => u === '/ward-assignments/export/danh-sach')![1] as { params: Record<string, unknown> };
    expect(sent.params).toMatchObject({ tk: ['trichYeu~xe'], status: 'SUBMITTED', sortBy: 'code', sortOrder: 'asc', caseType: 'CASE' });
    expect(sent.params).not.toHaveProperty('page');
    expect(sent.params).not.toHaveProperty('pageSize');
    // The columns shown, in their order, without the actions column and without the two hidden ones.
    expect(sent.params.cot).toBe('code,submittedAt,unit,caseType,kind,crime,summary,status,submissionCount,resultDueOn');
    // "Every column": no column list, the server writes all it declares.
    get.mockClear();
    fireEvent.click(screen.getByTestId('btn-xuat-day-du'));
    await waitFor(() => expect(get.mock.calls.some(([u]) => u === '/ward-assignments/export/danh-sach')).toBe(true));
    expect((get.mock.calls.find(([u]) => u === '/ward-assignments/export/danh-sach')![1] as { params: Record<string, unknown> }).params.cot).toBeUndefined();
    get.mockRestore();
  });

  it('offers "Tạo mới" only to whoever may create a request', async () => {
    held.value = ['read:WardAssignment'];
    const { unmount } = renderPage();
    await screen.findByTestId('ward-row-w1');
    expect(screen.queryByTestId('ward-create')).not.toBeInTheDocument();
    unmount();
    held.value = ['read:WardAssignment', 'write:WardAssignment'];
    renderPage();
    fireEvent.click(await screen.findByTestId('ward-create'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/ho-so-phan-cong/new');
  });

  it('says so when the list cannot be loaded, with a way to try again', async () => {
    api.list.mockRejectedValue(new Error('down'));
    renderPage();
    expect(await screen.findByTestId('ward-list-error')).toHaveTextContent(L.list.loadFailed);
  });
});

describe('opened from a number of the statistics page', () => {
  it('sends the same filters as the number (rows and card counts), shows that the list is filtered, and the filter is cleared in one click', async () => {
    renderPage('/ho-so-phan-cong?submitted=true&from=2026-11-01&to=2026-11-30&teamId=t1&alert=OVERDUE&status=APPROVED');
    await waitFor(() => expect(screen.getByTestId('ward-drill')).toBeTruthy());
    const drill = { submitted: 'true', from: '2026-11-01', to: '2026-11-30', teamId: 't1', alert: 'OVERDUE' };
    const asked = api.list.mock.calls.map(([q]) => q);
    // The rows: the status of the number is the card shown.
    expect(asked).toContainEqual(expect.objectContaining({ ...drill, status: 'APPROVED', pageSize: 20 }));
    // The cards count within the same filters.
    expect(api.listStats.mock.calls.at(-1)![0]).toMatchObject(drill);
    fireEvent.click(screen.getByTestId('ward-drill-clear'));
    await waitFor(() => expect(screen.queryByTestId('ward-drill')).toBeNull());
    await waitFor(() => expect(lastList()).toEqual({ page: 1, pageSize: 20 }));
  });

  it('a deadline alert shows beside the due day; no badge when the server judged none', async () => {
    api.list.mockImplementation(async (q: WardListQuery) =>
      q.pageSize === 1
        ? { data: [], total: 2 }
        : {
            data: [
              row({ id: 'late', status: 'APPROVED', resultDueOn: '2026-11-10T00:00:00.000Z', alert: { level: 'OVERDUE', dueOn: '2026-11-10', daysLeft: -6 } }),
              row({ id: 'calm', status: 'APPROVED', resultDueOn: '2027-01-10T00:00:00.000Z', alert: { level: 'NONE', dueOn: '2027-01-10', daysLeft: 55 } }),
            ],
            total: 2,
          },
    );
    // A request past its deadline stands out as an overdue petition does; one in time does not.
    renderPage();
    await waitFor(() => expect(screen.getByTestId('ward-row-late')).toBeTruthy());
    expect(screen.getByTestId('ward-row-late').className).toMatch(/red/);
    expect(screen.getByTestId('ward-row-calm').className).not.toMatch(/red/);
    document.body.innerHTML = '';
    renderPage();
    await waitFor(() => expect(screen.getByTestId('ward-due-late')).toBeTruthy());
    expect(within(screen.getByTestId('ward-due-late')).getByTestId('ward-alert-badge').getAttribute('data-level')).toBe('OVERDUE');
    expect(within(screen.getByTestId('ward-due-calm')).queryByTestId('ward-alert-badge')).toBeNull();
  });
});

describe('the list works as the petition list does', () => {
  it('the create button reads "Tạo mới" and carries its shortcut; Alt+N opens the new form', async () => {
    renderPage();
    const create = await screen.findByTestId('ward-create');
    expect(create).toHaveTextContent('Tạo mới');
    expect(create).not.toHaveTextContent('Trình mới');
    // The shortcut chip of the petition list's button (hidden on small screens, absent when the person turned hints off).
    expect(create.querySelector('kbd')).toHaveTextContent(/Alt\s*\+\s*N/i);
    fireEvent.keyDown(document.body, { key: 'n', code: 'KeyN', altKey: true });
    expect(await screen.findByTestId('where')).toHaveTextContent('/ho-so-phan-cong/new');
  });

  it('Alt+N does nothing for somebody who may not create', async () => {
    held.value = ['read:WardAssignment'];
    renderPage();
    await screen.findByTestId('ward-row-w1');
    fireEvent.keyDown(document.body, { key: 'n', code: 'KeyN', altKey: true });
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('Alt+R reads the list again', async () => {
    renderPage();
    await screen.findByTestId('ward-row-w1');
    const before = api.list.mock.calls.length;
    fireEvent.keyDown(document.body, { key: 'r', code: 'KeyR', altKey: true });
    await waitFor(() => expect(api.list.mock.calls.length).toBeGreaterThan(before));
  });

  describe('the actions of a row are the server’s answer for that row', () => {
    const withActions = [
      row({ id: 'w1', can: { edit: false, delete: false, issueSlip: false }, latestDecision: null }),
      row({ id: 'w3', code: null, status: 'DRAFT', submittedAt: null, submissionCount: 0, can: { edit: true, delete: true, issueSlip: false }, latestDecision: null }),
      row({ id: 'w4', code: '2026-00142', status: 'APPROVED', can: { edit: false, delete: false, issueSlip: true }, latestDecision: { id: 'd4', kind: 'APPROVE', slipNumber: null } }),
      row({ id: 'w5', code: '2026-00143', status: 'RETURNED', can: { edit: true, delete: false, issueSlip: false }, latestDecision: { id: 'd5', kind: 'RETURN', slipNumber: '3/PYC-PC02-Đ1' } }),
      row({ id: 'w6', code: '2026-00144', status: 'RETURNED', can: { edit: true, delete: false, issueSlip: false }, latestDecision: { id: 'd6', kind: 'RETURN', slipNumber: null } }),
    ];
    beforeEach(() => {
      api.list.mockImplementation(async (q: WardListQuery) => (q.pageSize === 1 ? { data: [], total: withActions.length } : { data: withActions, total: withActions.length }));
    });

    it('every row opens; edit and delete only where the unit may; print only where there is a slip to print', async () => {
      renderPage();
      await screen.findByTestId('ward-row-w1');
      // The same four buttons in the same order on every row, as the petition list: Xem · Sửa · Xoá · In.
      const order = (id: string) =>
        Array.from(screen.getByTestId(`ward-row-${id}`).querySelectorAll('button[data-testid^="btn-"]')).map((b) => b.getAttribute('data-testid')!.replace(`-${id}`, ''));
      for (const id of ['w1', 'w3', 'w4', 'w5', 'w6']) expect({ id, buttons: order(id) }).toEqual({ id, buttons: ['btn-view', 'btn-edit', 'btn-delete', 'btn-print'] });
      const button = (action: string, id: string) => screen.getByTestId(`btn-${action}-${id}`);
      // What the row does not allow is locked with its reason, never hidden (the buttons do not change place).
      expect(button('edit', 'w3')).toBeEnabled();
      expect(button('delete', 'w3')).toBeEnabled();
      for (const id of ['w1', 'w4']) {
        expect(button('edit', id)).toBeDisabled();
        expect(button('edit', id)).toHaveAttribute('title', L.list.actions.editLocked);
      }
      for (const id of ['w1', 'w4', 'w5', 'w6']) {
        expect(button('delete', id)).toBeDisabled();
        expect(button('delete', id)).toHaveAttribute('title', L.list.actions.deleteLocked);
      }
      // "In phiếu" prints where there is a slip to print: PC02 issues the slip of its decision, the ward unit saves
      // one issued. Elsewhere it says why.
      const print = (id: string) => button('print', id);
      expect(print('w4')).toBeEnabled();
      expect(print('w5')).toBeEnabled();
      for (const id of ['w1', 'w3']) {
        expect(print(id)).toBeDisabled();
        expect(print(id)).toHaveAttribute('title', L.list.actions.printNoDecision);
      }
      expect(print('w6')).toBeDisabled();
      expect(print('w6')).toHaveAttribute('title', L.list.actions.printNotIssued);
      fireEvent.click(print('w1'));
      expect(screen.queryByTestId('ward-slip-dialog')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('btn-edit-w3'));
      expect(await screen.findByTestId('where')).toHaveTextContent('/ho-so-phan-cong/w3/edit');
    });

    it('a button the route would refuse is not offered: reach without the permission of the action', async () => {
      held.value = ['read:WardAssignment', 'edit:WardAssignment'];
      renderPage();
      await screen.findByTestId('ward-row-w3');
      expect(screen.getByTestId('btn-edit-w3')).toBeEnabled();
      // Without the permission the button is not there at all, on any row (as on the petition list).
      expect(document.querySelectorAll('[data-testid^="btn-delete-"]')).toHaveLength(0);
    });

    it('a row of an older answer (no `can`) still opens, and offers nothing it cannot vouch for', async () => {
      api.list.mockImplementation(async (q: WardListQuery) => (q.pageSize === 1 ? { data: [], total: 1 } : { data: [row({ id: 'w1' })], total: 1 }));
      renderPage();
      await screen.findByTestId('ward-row-w1');
      expect(screen.getByTestId('btn-view-w1')).toBeInTheDocument();
      for (const a of ['edit', 'delete', 'print']) expect(screen.getByTestId(`btn-${a}-w1`)).toBeDisabled();
    });

    it('deleting a draft asks first, sends the stamp of the row, then reads the list again', async () => {
      api.remove.mockResolvedValue({ id: 'w3' });
      renderPage();
      fireEvent.click(await screen.findByTestId('btn-delete-w3'));
      expect(api.remove).not.toHaveBeenCalled();
      expect(await screen.findByText(L.list.deleteConfirm(L.list.noCode))).toBeInTheDocument();
      const before = api.list.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: L.form.actions.delete }));
      await waitFor(() => expect(api.remove).toHaveBeenCalledWith('w3', '2026-11-14T03:00:00.000Z'));
      expect(await screen.findByTestId('ward-list-notice')).toHaveTextContent(L.list.deleted);
      await waitFor(() => expect(api.list.mock.calls.length).toBeGreaterThan(before));
    });

    it('a deletion the server refuses is said, not swallowed', async () => {
      const { AxiosError, AxiosHeaders } = await import('axios');
      const headers = new AxiosHeaders();
      api.remove.mockRejectedValue(new AxiosError('x', 'ERR', { headers }, null, { status: 409, statusText: '', headers, config: { headers }, data: { error: { code: 'WARD_ASSIGNMENT_DELETE_SUBMITTED', details: [] } } }));
      renderPage();
      fireEvent.click(await screen.findByTestId('btn-delete-w3'));
      fireEvent.click(await screen.findByRole('button', { name: L.form.actions.delete }));
      expect(await screen.findByTestId('ward-list-notice')).toHaveTextContent(L.errors.WARD_ASSIGNMENT_DELETE_SUBMITTED);
    });

    it('"In phiếu" on a row: PC02 issues and saves in one click; the ward unit saves the slip issued', async () => {
      const file = { blob: new Blob(['x']), fileName: 'Phieu.docx' };
      docs.slipDefaults.mockResolvedValue({ decisionId: 'd4', kind: 'APPROVE', revoked: false, slipNumber: null, signers: { canBoThamDinh: 'Đại úy K' }, templateReady: true, missing: [] });
      docs.issueSlip.mockResolvedValue({ id: 'd4', kind: 'APPROVE', slipYear: 2026, slipNumber: '9/PYC-PC02-Đ1', slipIssuedAt: '2026-11-17T00:00:00Z', slipDocumentId: 'doc', signers: null });
      docs.downloadSlip.mockResolvedValue(file);
      renderPage();
      fireEvent.click(await screen.findByTestId('btn-print-w4'));
      const dialog = await screen.findByTestId('ward-slip-dialog');
      await waitFor(() => expect(within(dialog).getByTestId('ward-slip-signer-canBoThamDinh')).toHaveValue('Đại úy K'));
      fireEvent.click(screen.getByTestId('ward-slip-print'));
      await waitFor(() => expect(docs.issueSlip).toHaveBeenCalledWith('w4', 'd4', expect.objectContaining({ signers: expect.objectContaining({ canBoThamDinh: 'Đại úy K' }) })));
      await waitFor(() => expect(saveDownloadedFile).toHaveBeenCalledWith(file));
      fireEvent.click(screen.getByTestId('ward-slip-close'));
      await waitFor(() => expect(screen.queryByTestId('ward-slip-dialog')).not.toBeInTheDocument());

      // The ward unit's row: the slip issued is saved, nothing is issued.
      vi.mocked(saveDownloadedFile).mockClear();
      docs.issueSlip.mockClear();
      fireEvent.click(screen.getByTestId('btn-print-w5'));
      expect(await screen.findByTestId('ward-slip-number')).toHaveTextContent('3/PYC-PC02-Đ1');
      expect(screen.queryByTestId('ward-slip-print')).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId('ward-slip-download'));
      await waitFor(() => expect(docs.downloadSlip).toHaveBeenLastCalledWith('w5', 'd5'));
      await waitFor(() => expect(saveDownloadedFile).toHaveBeenCalledWith(file));
      expect(docs.issueSlip).not.toHaveBeenCalled();
    });
  });
});

describe('several rows at once', () => {
  const some = [
    row({ id: 'd1', code: null, status: 'DRAFT', submittedAt: null, submissionCount: 0, updatedAt: '2026-11-15T01:00:00.000Z', can: { edit: true, delete: true, issueSlip: false }, latestDecision: null }),
    row({ id: 'd2', code: null, status: 'DRAFT', submittedAt: null, submissionCount: 0, updatedAt: '2026-11-15T02:00:00.000Z', can: { edit: true, delete: true, issueSlip: false }, latestDecision: null }),
    row({ id: 's1', code: '2026-00200', status: 'SUBMITTED', can: { edit: false, delete: false, issueSlip: false }, latestDecision: null }),
  ];
  beforeEach(() => {
    api.list.mockResolvedValue({ data: some, total: some.length });
  });

  it('whoever may not delete is offered no boxes to tick', async () => {
    held.value = ['read:WardAssignment', 'edit:WardAssignment'];
    renderPage();
    await screen.findByTestId('ward-row-d1');
    expect(within(screen.getByTestId('ward-row-d1')).queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('drafts ticked are deleted one by one, each with its own stamp; the outcome is said and the list read again', async () => {
    api.remove.mockResolvedValueOnce({ id: 'd1' });
    const { AxiosError, AxiosHeaders } = await import('axios');
    const headers = new AxiosHeaders();
    api.remove.mockRejectedValueOnce(new AxiosError('x', 'ERR', { headers }, null, { status: 409, statusText: '', headers, config: { headers }, data: { error: { code: 'WARD_ASSIGNMENT_CHANGED', details: [] } } }));
    renderPage();
    for (const id of ['d1', 'd2']) fireEvent.click(within(await screen.findByTestId(`ward-row-${id}`)).getByRole('checkbox'));
    // The row that is not a draft cannot be ticked into the deletion... it is ticked here, and skipped by the action.
    // The bar's button carries the word; the rows' own delete buttons are icons (named by a label only).
    fireEvent.click(await screen.findByText(L.list.bulk.delete, { selector: 'button' }));
    // The shared bar asks before it acts.
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledTimes(2));
    expect(api.remove.mock.calls).toEqual([
      ['d1', '2026-11-15T01:00:00.000Z'],
      ['d2', '2026-11-15T02:00:00.000Z'],
    ]);
    const notice = await screen.findByTestId('ward-list-notice');
    expect(notice).toHaveTextContent(L.list.bulk.deleted(1));
    expect(notice).toHaveTextContent(L.list.bulk.skipped(1));
  });
});
