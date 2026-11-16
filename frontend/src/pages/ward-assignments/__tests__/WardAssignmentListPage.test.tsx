import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import WardAssignmentListPage from '../WardAssignmentListPage';
import { wardAssignmentsApi } from '@/features/ward-assignments/api';
import type { WardAssignmentRow, WardListQuery } from '@/features/ward-assignments/types';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';

vi.mock('@/features/ward-assignments/api', async (orig) => {
  const real = await orig<typeof import('@/features/ward-assignments/api')>();
  return { ...real, wardAssignmentsApi: { list: vi.fn() } };
});
const api = vi.mocked(wardAssignmentsApi);
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

  it('offers "Trình mới" only to whoever may create a request', async () => {
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
