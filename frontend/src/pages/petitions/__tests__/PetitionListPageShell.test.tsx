/**
 * Integration test for PetitionListPageShell (PR2/T5).
 *
 * Mirror Cases + Incidents shell test patterns. Petition has no phase tabs
 * (single workflow), so coverage simpler than Incidents.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, Routes, Route } from 'react-router-dom';
import { api } from '@/lib/api';
import { PetitionListPageShell } from '../PetitionListPageShell';
import { PetitionStatus } from '@/shared/enums/generated';
import { AssignModalProvider } from '@/features/_shared/modals/AssignModalProvider';
import { DeleteResourceModalProvider } from '@/features/_shared/modals/DeleteResourceModalProvider';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

function renderWithRouter(initialEntries: string[] = ['/petitions']) {
  let lastLocation = '';
  function LocationTracker() {
    const loc = useLocation();
    lastLocation = loc.pathname + loc.search;
    return null;
  }
  const result = render(
    <MemoryRouter initialEntries={initialEntries}>
      <AssignModalProvider>
        <DeleteResourceModalProvider>
          <Routes>
            <Route path="/petitions" element={<><PetitionListPageShell /><LocationTracker /></>} />
            <Route path="/petitions/new" element={<div>NewPetitionPage</div>} />
            <Route path="/petitions/:id" element={<div>PetitionDetailPage</div>} />
          </Routes>
        </DeleteResourceModalProvider>
      </AssignModalProvider>
    </MemoryRouter>,
  );
  return { ...result, getLocation: () => lastLocation };
}

const sampleRow = {
  id: 'petition-1',
  stt: 'DT-2026-00001',
  receivedDate: '2026-05-15T00:00:00Z',
  unit: 'PC02',
  senderName: 'Nguyễn Văn A',
  suspectedPerson: 'Trần Văn B',
  status: 'MOI_TIEP_NHAN' as PetitionStatus,
  deadline: '2026-06-30T00:00:00Z',
  createdAt: '2026-05-15T00:00:00Z',
};

// Exhaustive byStatus — 7 PetitionStatus keys.
const exhaustiveByStatus: Record<PetitionStatus, number> = {
  MOI_TIEP_NHAN: 8,
  DANG_XU_LY: 15,
  CHO_PHE_DUYET: 2,
  DA_LUU_DON: 1,
  DA_GIAI_QUYET: 4,
  DA_CHUYEN_VU_VIEC: 3,
  DA_CHUYEN_VU_AN: 1,
};

const sampleStats = {
  total: 34,
  byStatus: exhaustiveByStatus,
};

describe('PetitionListPageShell — initial mount + ready state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/petitions') {
        return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      }
      if (url === '/petitions/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL: ' + url));
    });
  });

  it('mount → skeleton → ready với 1 row', async () => {
    renderWithRouter();
    expect(screen.getByTestId('list-page-shell-table-loading')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId('list-page-shell-table-loading')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('DT-2026-00001')).toBeInTheDocument();
  });

  it('header render "Danh sách đơn thư" title', () => {
    renderWithRouter();
    expect(
      screen.getByRole('heading', { level: 1, name: /Danh sách đơn thư/i }),
    ).toBeInTheDocument();
  });

  it('StatusChips render 7 PetitionStatus + "Tất cả" = 8 chips', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    expect(screen.getAllByRole('tab')).toHaveLength(8);
  });

  it('StatusChips render server counts', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    expect(screen.getByText('34')).toBeInTheDocument(); // total
    expect(screen.getByText('15')).toBeInTheDocument(); // DANG_XU_LY
  });
});

describe('PetitionListPageShell — interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/petitions') return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      if (url === '/petitions/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('click status chip → URL state cập nhật với petitions_ prefix', async () => {
    const { getLocation } = renderWithRouter();
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    const dangXuLy = screen.getAllByRole('tab').find((t) => t.textContent?.includes('Đang xử lý'));
    expect(dangXuLy).toBeDefined();
    fireEvent.click(dangXuLy!);
    await waitFor(() => {
      expect(getLocation()).toContain('petitions_status=DANG_XU_LY');
      expect(getLocation()).toContain('petitions_page=1');
    });
  });

  it('row click → navigate detail', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    fireEvent.click(screen.getByText('Nguyễn Văn A'));
    await waitFor(() => expect(screen.getByText('PetitionDetailPage')).toBeInTheDocument());
  });

  it('"Tạo mới" → /petitions/new', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    fireEvent.click(screen.getByRole('button', { name: /Tạo mới/i }));
    await waitFor(() => expect(screen.getByText('NewPetitionPage')).toBeInTheDocument());
  });
});

describe('PetitionListPageShell — empty + error states', () => {
  it('state=empty → render CTA "Tạo đơn thư mới"', async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/petitions') return Promise.resolve({ data: { data: [], total: 0 } });
      if (url === '/petitions/stats') {
        return Promise.resolve({ data: { total: 0, byStatus: exhaustiveByStatus } });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    renderWithRouter();
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-empty')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Tạo đơn thư mới' })).toBeInTheDocument();
  });

  it('state=empty-filtered (status active) → filtered empty', async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/petitions') return Promise.resolve({ data: { data: [], total: 0 } });
      if (url === '/petitions/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL'));
    });
    renderWithRouter(['/petitions?petitions_status=DANG_XU_LY']);
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-empty-filtered')).toBeInTheDocument(),
    );
  });

  it('state=error (500) → Vietnamese message', async () => {
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

describe('PetitionListPageShell — security + URL load', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/petitions') return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      if (url === '/petitions/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('malformed status URL param → ignore', async () => {
    renderWithRouter(['/petitions?petitions_status=__proto__']);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/petitions', expect.any(Object)));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/petitions',
    );
    expect(listCall?.[1]?.params.status).toBeUndefined();
  });

  it('byStatus response exhaustive — mọi PetitionStatus key có number', () => {
    Object.values(PetitionStatus).forEach((status) => {
      expect(typeof exhaustiveByStatus[status]).toBe('number');
    });
  });

  it('load với petitions_status filter → fetch với status', async () => {
    renderWithRouter(['/petitions?petitions_status=DA_GIAI_QUYET']);
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/petitions',
    );
    expect(listCall?.[1]?.params.status).toBe('DA_GIAI_QUYET');
  });

  it('load với petitions_page=2 → fetch offset=20', async () => {
    renderWithRouter(['/petitions?petitions_page=2']);
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/petitions',
    );
    expect(listCall?.[1]?.params.offset).toBe(20);
  });
});
