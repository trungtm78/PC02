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
  return { ...real, wardAssignmentsApi: { list: vi.fn(), remove: vi.fn() } };
});
vi.mock('@/features/ward-assignments/api/docs', async (orig) => {
  const real = await orig<typeof import('@/features/ward-assignments/api/docs')>();
  return { ...real, saveDownloadedFile: vi.fn(), wardDocsApi: { slipDefaults: vi.fn(), issueSlip: vi.fn(), downloadSlip: vi.fn(), reissueSlip: vi.fn() } };
});
const api = vi.mocked(wardAssignmentsApi);
const docs = vi.mocked(wardDocsApi);
const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissions: held.value }) }));

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
    if (q.pageSize === 1) {
      // The counts of the cards.
      if (q.archived) return { data: [], total: 2 };
      const total = q.status ? rows.filter((r) => r.status === q.status).length : rows.length;
      return { data: [], total };
    }
    const data = rows.filter((r) => !q.status || r.status === q.status);
    return { data, total: data.length };
  });
});

describe('the list of ward assignment requests', () => {
  it('shows the ten default columns with their values', async () => {
    renderPage();
    const first = await screen.findByTestId('ward-row-w1');
    for (const header of Object.values(L.list.columns)) expect(screen.getAllByText(header).length).toBeGreaterThan(0);
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
    fireEvent.click(screen.getByTestId('ward-card-APPROVED'));
    await waitFor(() => expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'APPROVED', pageSize: 50 })));
    await waitFor(() => expect(screen.queryByTestId('ward-row-w1')).not.toBeInTheDocument());
    expect(screen.getByTestId('ward-row-w4')).toBeInTheDocument();
  });

  it('the archived card lists the archived requests', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('ward-card-archived'));
    await waitFor(() => expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ archived: true, pageSize: 50 })));
  });

  it('searches by the words typed, for the rows and the counts alike', async () => {
    renderPage();
    await screen.findByTestId('ward-row-w1');
    fireEvent.change(screen.getByTestId('ward-search'), { target: { value: '  2026-00185 ' } });
    fireEvent.keyDown(screen.getByTestId('ward-search'), { key: 'Enter' });
    await waitFor(() => expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ q: '2026-00185', pageSize: 50 })));
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ q: '2026-00185', pageSize: 1 }));
  });

  it('the search button searches too', async () => {
    renderPage();
    await screen.findByTestId('ward-row-w1');
    fireEvent.change(screen.getByTestId('ward-search'), { target: { value: 'xe máy' } });
    fireEvent.click(screen.getByTestId('ward-search-go'));
    await waitFor(() => expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ q: 'xe máy', pageSize: 50 })));
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
    expect(asked).toContainEqual(expect.objectContaining({ ...drill, status: 'APPROVED', pageSize: 50 }));
    // Every card counts within the same filters.
    expect(asked.filter((q) => q.pageSize === 1).every((q) => q.teamId === 't1' && q.alert === 'OVERDUE' && q.from === '2026-11-01')).toBe(true);
    fireEvent.click(screen.getByTestId('ward-drill-clear'));
    await waitFor(() => expect(screen.queryByTestId('ward-drill')).toBeNull());
    const last = api.list.mock.calls.map(([q]) => q).filter((q) => q.pageSize === 50).at(-1);
    expect(last).toEqual({ page: 1, pageSize: 50 });
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

  it('Alt+R reads the list again; the search box is the one Ctrl+K goes to', async () => {
    renderPage();
    await screen.findByTestId('ward-row-w1');
    const before = api.list.mock.calls.length;
    fireEvent.keyDown(document.body, { key: 'r', code: 'KeyR', altKey: true });
    await waitFor(() => expect(api.list.mock.calls.length).toBeGreaterThan(before));
    expect(screen.getByTestId('ward-search')).toHaveAttribute('role', 'searchbox');
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
      const shown = (id: string) => ['view', 'edit', 'print', 'delete'].filter((a) => screen.queryByTestId(`btn-${a}-${id}`));
      expect(shown('w1')).toEqual(['view']);
      expect(shown('w3')).toEqual(['view', 'edit', 'delete']);
      // PC02 issues the slip of its decision; the ward unit saves one already issued, and has nothing to print before.
      expect(shown('w4')).toEqual(['view', 'print']);
      expect(shown('w5')).toEqual(['view', 'edit', 'print']);
      expect(shown('w6')).toEqual(['view', 'edit']);
      fireEvent.click(screen.getByTestId('btn-edit-w3'));
      expect(await screen.findByTestId('where')).toHaveTextContent('/ho-so-phan-cong/w3/edit');
    });

    it('a button the route would refuse is not offered: reach without the permission of the action', async () => {
      held.value = ['read:WardAssignment', 'edit:WardAssignment'];
      renderPage();
      await screen.findByTestId('ward-row-w3');
      expect(screen.getByTestId('btn-edit-w3')).toBeInTheDocument();
      expect(screen.queryByTestId('btn-delete-w3')).not.toBeInTheDocument();
    });

    it('a row of an older answer (no `can`) still opens, and offers nothing it cannot vouch for', async () => {
      api.list.mockImplementation(async (q: WardListQuery) => (q.pageSize === 1 ? { data: [], total: 1 } : { data: [row({ id: 'w1' })], total: 1 }));
      renderPage();
      await screen.findByTestId('ward-row-w1');
      expect(screen.getByTestId('btn-view-w1')).toBeInTheDocument();
      for (const a of ['edit', 'print', 'delete']) expect(screen.queryByTestId(`btn-${a}-w1`)).not.toBeInTheDocument();
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
