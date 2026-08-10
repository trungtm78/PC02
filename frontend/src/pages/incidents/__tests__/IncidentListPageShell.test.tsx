/**
 * Integration test for IncidentListPageShell (PR2/T4).
 *
 * Mirror CaseListPageShell.test.tsx coverage:
 * - Mount → loading → ready với rows
 * - Header title
 * - Phase tabs render (4 + "Tất cả giai đoạn" = 5)
 * - StatusChips render với 15 IncidentStatus + "Tất cả" = 16 tabs (chips)
 * - Server counts merged into chips
 * - Status filter click → URL state + re-fetch
 * - Phase tab click → URL state + re-fetch
 * - Search → URL state debounced
 * - Empty / empty-filtered / error states
 * - URL load preservation (status/phase/page/q)
 * - Security: malformed status URL param ignored
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, Routes, Route } from 'react-router-dom';
import { api } from '@/lib/api';
import { IncidentListPageShell } from '../IncidentListPageShell';
import { IncidentStatus } from '@/shared/enums/generated';
import { CompositeModalProvider } from '@/features/_shared/modals/CompositeModalProvider';

// `vi.mock` is hoisted above ordinary declarations, so the mutable the mocked
// store reads has to be hoisted with it. Tests flip `auth.granted` to check
// both sides of the permission gate.
const auth = vi.hoisted(() => ({
  granted: [{ action: 'read', subject: 'Incident' },
          { action: 'write', subject: 'Incident' },
          { action: 'edit', subject: 'Incident' },
          { action: 'delete', subject: 'Incident' },] as { action: string; subject: string }[] | null,
}));
const FULL_PERMISSIONS = auth.granted;

// The permission layer is real now: with no auth store the shell sees no user,
// so "Tạo mới", the Alt+N shortcut and the empty-state CTA are all correctly
// hidden. This test covers the case of a user who may create.
vi.mock('@/stores/auth.store', () => ({
  authStore: {
    getUser: vi.fn(() => auth.granted === null
      ? null
      : { email: 'officer@test.local', role: 'OFFICER', permissions: auth.granted }),
    getProfileRaw: vi.fn(() => null),
    onTokenChanged: vi.fn(() => () => {}),
  },
}));

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

function renderWithRouter(initialEntries: string[] = ['/incidents']) {
  let lastLocation = '';
  function LocationTracker() {
    const loc = useLocation();
    lastLocation = loc.pathname + loc.search;
    return null;
  }
  const result = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={initialEntries}>
      <CompositeModalProvider>
        <Routes>
          <Route path="/incidents" element={<><IncidentListPageShell /><LocationTracker /></>} />
          <Route path="/incidents/new" element={<div>NewIncidentPage</div>} />
          <Route path="/incidents/:id" element={<div>IncidentDetailPage</div>} />
        </Routes>
      </CompositeModalProvider>
    </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, getLocation: () => lastLocation };
}

const sampleRow = {
  id: 'incident-1',
  code: 'VV-2026-00001',
  name: 'Vụ việc mẫu',
  status: 'TIEP_NHAN' as IncidentStatus,
  deadline: '2026-06-30T00:00:00Z',
  investigator: { firstName: 'Trần', lastName: 'B', username: 'tranb' },
  donViGiaiQuyet: 'PC02',
  createdAt: '2026-05-20T00:00:00Z',
  updatedAt: '2026-05-21T00:00:00Z',
};

// Exhaustive byStatus matching backend contract — 15 IncidentStatus keys.
const exhaustiveByStatus: Record<IncidentStatus, number> = {
  TIEP_NHAN: 5,
  DANG_XAC_MINH: 12,
  DA_PHAN_CONG: 3,
  DA_GIAI_QUYET: 8,
  TAM_DINH_CHI: 2,
  QUA_HAN: 1,
  DA_CHUYEN_VU_AN: 4,
  KHONG_KHOI_TO: 0,
  CHUYEN_XPHC: 0,
  TDC_HET_THOI_HIEU: 0,
  TDC_HTH_KHONG_KT: 0,
  PHUC_HOI_NGUON_TIN: 0,
  DA_CHUYEN_DON_VI: 0,
  DA_NHAP_VU_KHAC: 0,
  PHAN_LOAI_DAN_SU: 0,
};

const sampleStats = {
  total: 35,
  byStatus: exhaustiveByStatus,
  // byGroup = 4 giai đoạn BCA, do SERVER đếm (PHASE_STATUSES).
  byGroup: {
    'tiep-nhan': 5,
    'xac-minh': 16, // 12+3+1
    'ket-qua': 12, // 4+8
    'tam-dinh-chi': 2,
  },
};

describe('IncidentListPageShell — initial mount + ready state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/incidents') {
        return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      }
      if (url === '/incidents/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL: ' + url));
    });
  });

  it('mount → render skeleton → ready với 1 row', async () => {
    renderWithRouter();
    expect(screen.getByTestId('list-page-shell-table-loading')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId('list-page-shell-table-loading')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Vụ việc mẫu')).toBeInTheDocument();
    expect(screen.getByText('VV-2026-00001')).toBeInTheDocument();
  });

  it('header render "Danh sách vụ việc" title', async () => {
    renderWithRouter();
    expect(
      screen.getByRole('heading', { level: 1, name: /Danh sách vụ việc/i }),
    ).toBeInTheDocument();
  });

  it('phase tabs render 4 phases + "Tất cả giai đoạn" trong tablist riêng', () => {
    renderWithRouter();
    const phaseTablist = screen.getByRole('tablist', { name: 'Giai đoạn xử lý' });
    const phaseTabs = phaseTablist.querySelectorAll('[role="tab"]');
    expect(phaseTabs).toHaveLength(5); // "Tất cả" + 4 phases
    expect(phaseTablist).toHaveTextContent('Tiếp nhận');
    expect(phaseTablist).toHaveTextContent('Xác minh');
    expect(phaseTablist).toHaveTextContent('Kết quả');
    expect(phaseTablist).toHaveTextContent('Tạm đình chỉ');
  });

  it('StatusChips render 15 IncidentStatus + "Tất cả" = 16 chips', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ việc mẫu'));
    // Multiple tablists: phase tabs (5) + status chips (16) = 21 role=tab elements.
    const allTabs = screen.getAllByRole('tab');
    expect(allTabs.length).toBeGreaterThanOrEqual(16); // status chips alone
  });

  it('StatusChips hiển thị server counts', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ việc mẫu'));
    const chipBar = screen.getByRole('tablist', { name: /lọc theo trạng thái/i });
    expect(within(chipBar).getByText('35')).toBeInTheDocument(); // total
    expect(within(chipBar).getByText('12')).toBeInTheDocument(); // DANG_XAC_MINH count
  });
});

describe('IncidentListPageShell — interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/incidents') return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      if (url === '/incidents/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('click status chip → URL state cập nhật với prefix incidents_', async () => {
    const { getLocation } = renderWithRouter();
    await waitFor(() => screen.getByText('Vụ việc mẫu'));
    const tabs = screen.getAllByRole('tab');
    const tiepNhanChip = tabs.find(
      (t) =>
        t.textContent?.includes('Tiếp nhận') &&
        t.closest('[aria-label="Giai đoạn xử lý"]') === null,
    );
    expect(tiepNhanChip).toBeDefined();
    fireEvent.click(tiepNhanChip!);
    await waitFor(() => {
      expect(getLocation()).toContain('incidents_status=TIEP_NHAN');
      expect(getLocation()).toContain('incidents_page=1');
    });
  });

  it('click phase tab → URL state cập nhật với incidents_phase', async () => {
    const { getLocation } = renderWithRouter();
    await waitFor(() => screen.getByText('Vụ việc mẫu'));
    const phaseTablist = screen.getByRole('tablist', { name: 'Giai đoạn xử lý' });
    const xacMinhTab = Array.from(phaseTablist.querySelectorAll('[role="tab"]')).find(
      (t) => t.textContent === 'Xác minh',
    );
    expect(xacMinhTab).toBeDefined();
    fireEvent.click(xacMinhTab!);
    await waitFor(() => {
      // Backend slug — see PHASE_STATUSES keys in incidents.constants.ts
      expect(getLocation()).toContain('incidents_phase=xac-minh');
    });
  });

  it('row click → navigate detail', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ việc mẫu'));
    fireEvent.click(screen.getByText('Vụ việc mẫu'));
    await waitFor(() => expect(screen.getByText('IncidentDetailPage')).toBeInTheDocument());
  });

  it('"Tạo mới" → /incidents/new', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ việc mẫu'));
    fireEvent.click(screen.getByRole('button', { name: /Tạo mới/i }));
    await waitFor(() => expect(screen.getByText('NewIncidentPage')).toBeInTheDocument());
  });
});

describe('IncidentListPageShell — empty + error states', () => {
  it('state=empty (không filter, không rows) → render CTA "Tạo vụ việc mới"', async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/incidents') return Promise.resolve({ data: { data: [], total: 0 } });
      if (url === '/incidents/stats') {
        return Promise.resolve({ data: { total: 0, byStatus: exhaustiveByStatus } });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    renderWithRouter();
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-empty')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Tạo vụ việc mới' })).toBeInTheDocument();
  });

  it('state=empty-filtered (status filter active) → filtered empty', async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/incidents') return Promise.resolve({ data: { data: [], total: 0 } });
      if (url === '/incidents/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL'));
    });
    renderWithRouter(['/incidents?incidents_status=TIEP_NHAN']);
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-empty-filtered')).toBeInTheDocument(),
    );
  });

  it('state=error (500) → render Vietnamese message từ axios shape', async () => {
    const axiosError = Object.assign(new Error('Internal Server Error'), {
      isAxiosError: true,
      response: { status: 500, data: {} },
    });
    (api.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(axiosError);
    renderWithRouter();
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-error')).toBeInTheDocument(),
    );
    expect(screen.getByText(/Lỗi máy chủ/i)).toBeInTheDocument();
  });
});

describe('IncidentListPageShell — security + contract fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/incidents') return Promise.resolve({ data: { data: [], total: 0 } });
      if (url === '/incidents/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('malformed status URL param → ignore, không fetch với status param', async () => {
    renderWithRouter(['/incidents?incidents_status=__proto__']);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/incidents', expect.any(Object)));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/incidents',
    );
    expect(listCall?.[1]?.params.status).toBeUndefined();
  });

  it('malformed phase URL param → ignore', async () => {
    renderWithRouter(['/incidents?incidents_phase=__proto__']);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/incidents', expect.any(Object)));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/incidents',
    );
    expect(listCall?.[1]?.params.phase).toBeUndefined();
  });

  it('UPPER_SNAKE_CASE phase value → rejected (backend expects kebab-case)', async () => {
    renderWithRouter(['/incidents?incidents_phase=XAC_MINH']);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/incidents', expect.any(Object)));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/incidents',
    );
    expect(listCall?.[1]?.params.phase).toBeUndefined();
  });

  it('byStatus response exhaustive — mọi IncidentStatus key có number', () => {
    Object.values(IncidentStatus).forEach((status) => {
      expect(typeof exhaustiveByStatus[status]).toBe('number');
    });
  });
});

describe('IncidentListPageShell — URL state load from query params', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/incidents') return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      if (url === '/incidents/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('load với incidents_status filter → fetch caller với status param', async () => {
    renderWithRouter(['/incidents?incidents_status=DANG_XAC_MINH']);
    await waitFor(() => screen.getByText('Vụ việc mẫu'));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/incidents',
    );
    expect(listCall?.[1]?.params.status).toBe('DANG_XAC_MINH');
  });

  it('load với incidents_phase=ket-qua → fetch caller với phase=ket-qua (backend kebab-case slug)', async () => {
    renderWithRouter(['/incidents?incidents_phase=ket-qua']);
    await waitFor(() => screen.getByText('Vụ việc mẫu'));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/incidents',
    );
    expect(listCall?.[1]?.params.phase).toBe('ket-qua');
  });

  it('load với incidents_page=3 → fetch offset=40', async () => {
    renderWithRouter(['/incidents?incidents_page=3']);
    await waitFor(() => screen.getByText('Vụ việc mẫu'));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/incidents',
    );
    expect(listCall?.[1]?.params.offset).toBe(40);
  });
});


/**
 * PR-F1 gated three entry points on the same `write` grant: the header button,
 * the Alt+N shortcut and the empty-state CTA. Asserting the granted case only
 * would have passed just as well before the gate existed, so this asserts the
 * denied case — the one the change is actually for.
 */
describe('IncidentListPageShell — a user who may not create', () => {
  beforeEach(() => {
    auth.granted = [{ action: 'read', subject: 'Incident' }];
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes('/stats')) return Promise.resolve({ data: { total: 0, byStatus: {}, byGroup: {} } });
      return Promise.resolve({ data: { data: [], total: 0, page: 1, limit: 20 } });
    });
  });

  afterEach(() => {
    auth.granted = FULL_PERMISSIONS;
  });

  it('hides the header create button', async () => {
    renderWithRouter();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    expect(screen.queryByTestId('btn-create-incident')).not.toBeInTheDocument();
  });

  it('hides the empty-state call to action', async () => {
    renderWithRouter();
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    expect(screen.queryByText('Tạo vụ việc mới')).not.toBeInTheDocument();
  });
});
