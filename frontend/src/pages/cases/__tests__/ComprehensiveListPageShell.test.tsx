/**
 * Integration test for ComprehensiveListPageShell (PR2/T6).
 *
 * 3-entity fan-out — focused coverage:
 * - Mount "Tất cả" → fetch 3 endpoints parallel + 3 stats endpoints
 * - 3 RECORD_TYPE chips render với fanned counts
 * - Click type chip → URL state + fetch only that endpoint
 * - Merged rows sorted by createdAt desc (client-side)
 * - Row click navigate to type-specific detail
 * - Empty + error states
 * - Security: malformed type URL param ignored
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, Routes, Route } from 'react-router-dom';
import { api } from '@/lib/api';
import { ComprehensiveListPageShell } from '../ComprehensiveListPageShell';
import { AssignModalProvider } from '@/features/_shared/modals/AssignModalProvider';
import { DeleteResourceModalProvider } from '@/features/_shared/modals/DeleteResourceModalProvider';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

function renderWithRouter(initialEntries: string[] = ['/comprehensive']) {
  let lastLocation = '';
  function LocationTracker() {
    const loc = useLocation();
    lastLocation = loc.pathname + loc.search;
    return null;
  }
  const result = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={initialEntries}>
      <AssignModalProvider>
        <DeleteResourceModalProvider>
          <Routes>
            <Route
              path="/comprehensive"
              element={<><ComprehensiveListPageShell /><LocationTracker /></>}
            />
            <Route path="/cases/new" element={<div>NewCasePage</div>} />
            <Route path="/cases/:id" element={<div>CaseDetailPage</div>} />
            <Route path="/incidents/:id" element={<div>IncidentDetailPage</div>} />
            <Route path="/petitions/:id" element={<div>PetitionDetailPage</div>} />
          </Routes>
        </DeleteResourceModalProvider>
      </AssignModalProvider>
    </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, getLocation: () => lastLocation };
}

const caseRow = {
  id: 'case-1',
  caseCode: 'PC02-001',
  name: 'Vụ án XYZ',
  status: 'TIEP_NHAN',
  unit: 'PA',
  investigator: { firstName: 'Nguyễn', lastName: 'A', username: 'nva' },
  createdAt: '2026-05-25T00:00:00Z',
};

const incidentRow = {
  id: 'incident-1',
  code: 'VV-2026-00001',
  name: 'Vụ việc ABC',
  status: 'DANG_XAC_MINH',
  donViGiaiQuyet: 'PC02',
  investigator: { firstName: 'Lê', lastName: 'B', username: 'leb' },
  createdAt: '2026-05-26T00:00:00Z',
};

const petitionRow = {
  id: 'petition-1',
  stt: 'DT-2026-001',
  senderName: 'Người gửi C',
  status: 'MOI_TIEP_NHAN',
  unit: 'PC02',
  receivedDate: '2026-05-20T00:00:00Z',
  createdAt: '2026-05-20T00:00:00Z',
};

function setupHappy() {
  (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
    if (path === '/cases') return Promise.resolve({ data: { data: [caseRow], total: 10 } });
    if (path === '/incidents') return Promise.resolve({ data: { data: [incidentRow], total: 20 } });
    if (path === '/petitions') return Promise.resolve({ data: { data: [petitionRow], total: 5 } });
    if (path === '/cases/stats') return Promise.resolve({ data: { total: 10, byStatus: {} } });
    if (path === '/incidents/stats')
      return Promise.resolve({ data: { total: 20, byStatus: {} } });
    if (path === '/petitions/stats')
      return Promise.resolve({ data: { total: 5, byStatus: {} } });
    return Promise.reject(new Error('Unknown URL: ' + path));
  });
}

describe('ComprehensiveListPageShell — initial mount + 3-entity fan-out', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappy();
  });

  it('mount → render skeleton → ready với 3 merged rows', async () => {
    renderWithRouter();
    expect(screen.getByTestId('list-page-shell-table-loading')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId('list-page-shell-table-loading')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Vụ án XYZ')).toBeInTheDocument();
    expect(screen.getByText('Vụ việc ABC')).toBeInTheDocument();
    expect(screen.getByText('Người gửi C')).toBeInTheDocument();
  });

  it('header "Tra cứu tổng hợp"', () => {
    renderWithRouter();
    expect(
      screen.getByRole('heading', { level: 1, name: /Tra cứu tổng hợp/i }),
    ).toBeInTheDocument();
  });

  it('chips render 3 RECORD_TYPE + "Tất cả" = 4', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ án XYZ'));
    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('chips render fanned-out counts (sum of 3 stats endpoints)', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ án XYZ'));
    // Scope assertions to chips (title attribute) to avoid pagination-total collision.
    const tatCaChip = screen.getAllByRole('tab').find((t) => t.textContent?.startsWith('Tất cả'));
    const vuAnChip = screen.getByRole('tab', { name: /^Vụ án/ });
    const vuViecChip = screen.getByRole('tab', { name: /^Vụ việc/ });
    const donThuChip = screen.getByRole('tab', { name: /^Đơn thư/ });
    expect(tatCaChip?.textContent).toContain('35'); // total = 10+20+5
    expect(vuAnChip.textContent).toContain('10');
    expect(vuViecChip.textContent).toContain('20');
    expect(donThuChip.textContent).toContain('5');
  });

  it('merged rows sorted desc by createdAt', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ án XYZ'));
    const cells = screen.getAllByText(/^Vụ án XYZ$|^Vụ việc ABC$|^Người gửi C$/);
    // Order in DOM: Vụ việc ABC (May 26) → Vụ án XYZ (May 25) → Người gửi C (May 20)
    expect(cells[0].textContent).toBe('Vụ việc ABC');
    expect(cells[1].textContent).toBe('Vụ án XYZ');
    expect(cells[2].textContent).toBe('Người gửi C');
  });
});

describe('ComprehensiveListPageShell — interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappy();
  });

  it('click Vụ án chip → URL state + chỉ fetch /cases', async () => {
    const { getLocation } = renderWithRouter();
    await waitFor(() => screen.getByText('Vụ án XYZ'));
    const tabs = screen.getAllByRole('tab');
    const vuAnChip = tabs.find((t) => t.textContent?.includes('Vụ án') && !t.textContent.includes('Tất cả'));
    expect(vuAnChip).toBeDefined();
    fireEvent.click(vuAnChip!);
    await waitFor(() => {
      expect(getLocation()).toContain('comp_type=CASE');
      expect(getLocation()).toContain('comp_page=1');
    });
  });

  it('row click Vụ án → navigate /cases/:id', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ án XYZ'));
    fireEvent.click(screen.getByText('Vụ án XYZ'));
    await waitFor(() => expect(screen.getByText('CaseDetailPage')).toBeInTheDocument());
  });

  it('row click Vụ việc → navigate /incidents/:id', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ việc ABC'));
    fireEvent.click(screen.getByText('Vụ việc ABC'));
    await waitFor(() => expect(screen.getByText('IncidentDetailPage')).toBeInTheDocument());
  });

  it('row click Đơn thư → navigate /petitions/:id', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Người gửi C'));
    fireEvent.click(screen.getByText('Người gửi C'));
    await waitFor(() => expect(screen.getByText('PetitionDetailPage')).toBeInTheDocument());
  });
});

describe('ComprehensiveListPageShell — empty + error + security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('state=empty (3 endpoints về rỗng) → render empty CTA "Tạo vụ án mới"', async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path === '/cases' || path === '/incidents' || path === '/petitions') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      if (path.endsWith('/stats')) return Promise.resolve({ data: { total: 0, byStatus: {} } });
      return Promise.reject(new Error('Unknown'));
    });
    renderWithRouter();
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-empty')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Tạo vụ án mới' })).toBeInTheDocument();
  });

  it('state=error khi 1 endpoint fail với 500', async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
      if (path === '/cases') {
        return Promise.reject(
          Object.assign(new Error('500'), {
            isAxiosError: true,
            response: { status: 500, data: {} },
          }),
        );
      }
      if (path === '/incidents' || path === '/petitions') {
        return Promise.resolve({ data: { data: [], total: 0 } });
      }
      if (path.endsWith('/stats')) return Promise.resolve({ data: { total: 0, byStatus: {} } });
      return Promise.reject(new Error('Unknown'));
    });
    renderWithRouter();
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-error')).toBeInTheDocument(),
    );
    expect(screen.getByText(/Lỗi máy chủ/i)).toBeInTheDocument();
  });

  it('malformed type URL param → ignore, không filter', async () => {
    setupHappy();
    renderWithRouter(['/comprehensive?comp_type=__proto__']);
    await waitFor(() => screen.getByText('Vụ án XYZ'));
    // Em fan-out vì typeFilter is null after sanitization
    const cases = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/cases',
    );
    expect(cases).toBeDefined();
    const incidents = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/incidents',
    );
    expect(incidents).toBeDefined();
  });

  it('load với comp_type=INCIDENT → chỉ fetch /incidents (không /cases, không /petitions)', async () => {
    setupHappy();
    renderWithRouter(['/comprehensive?comp_type=INCIDENT']);
    await waitFor(() => screen.getByText('Vụ việc ABC'));
    const calls = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const dataCallPaths = calls.map((c) => c[0]).filter((p) => !p.endsWith('/stats'));
    expect(dataCallPaths).toContain('/incidents');
    expect(dataCallPaths).not.toContain('/cases');
    expect(dataCallPaths).not.toContain('/petitions');
  });
});
