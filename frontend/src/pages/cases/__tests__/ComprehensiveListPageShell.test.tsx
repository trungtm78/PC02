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
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, Routes, Route } from 'react-router-dom';
import { api } from '@/lib/api';
import { ComprehensiveListPageShell } from '../ComprehensiveListPageShell';
// Bọc CompositeModalProvider chứ không bọc riêng AssignModalProvider: mỗi lần hệ thống thêm
// một modal dùng chung, cách bọc riêng bắt phải sửa lại từng tệp ca kiểm — và ca kiểm đỏ vì
// lý do không liên quan gì tới thứ nó đang chốt.
import { CompositeModalProvider } from '@/features/_shared/modals/CompositeModalProvider';
import { DeleteResourceModalProvider } from '@/features/_shared/modals/DeleteResourceModalProvider';
import { FeatureFlagsProvider } from '@/lib/features/FeatureFlagsContext';
import type { FeatureFlag } from '@/lib/features/types';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

function renderWithRouter(initialEntries: string[] = ['/comprehensive'], flags?: FeatureFlag[]) {
  let lastLocation = '';
  function LocationTracker() {
    const loc = useLocation();
    lastLocation = loc.pathname + loc.search;
    return null;
  }
  const trang = (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={initialEntries}>
      <CompositeModalProvider>
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
      </CompositeModalProvider>
    </MemoryRouter>
    </QueryClientProvider>
  );
  const result = render(
    flags ? <FeatureFlagsProvider initialFlags={flags}>{trang}</FeatureFlagsProvider> : trang,
  );
  return { ...result, getLocation: () => lastLocation };
}

const caseRow = {
  id: 'case-1',
  caseCode: 'PC02-001',
  name: 'Vụ án XYZ',
  status: 'TIEP_NHAN',
  unit: 'PA',
  donViGiaiQuyet: 'Đội 3',
  createdBy: { id: 'u1', firstName: 'Nhập', lastName: 'Cán Bộ' },
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
  donViGiaiQuyet: 'Đội 5',
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

/**
 * Lát mỏng tìm kiếm dạng thẻ (15/09/2026): Tổng hợp gửi CHUNG một thẻ `*` tới ba API. Khoá `*` là khoá
 * chuẩn liên thực thể — cả ba máy chủ đều hiểu, nên một chuỗi gõ ra cùng một nghĩa ở ba bảng. Ô thẻ
 * đầy đủ (chọn cột) chờ M4, khi cột của màn này có khai riêng.
 */
describe('ComprehensiveListPageShell — thẻ tìm kiếm `*` tới ba API', () => {
  const mockGet = () => api.get as unknown as ReturnType<typeof vi.fn>;
  const thamSoCuoi = (url: string) => {
    const goi = mockGet().mock.calls.filter((c) => c[0] === url);
    return (goi[goi.length - 1]?.[1]?.params ?? {}) as Record<string, unknown>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupHappy();
  });

  it('"Tất cả": `comp_q` → thẻ `*` tới CẢ BA danh sách, không gửi `search`', async () => {
    renderWithRouter(['/comprehensive?comp_q=abc']);
    await waitFor(() => {
      for (const duong of ['/cases', '/incidents', '/petitions']) {
        expect(thamSoCuoi(duong).tk).toEqual(['*~abc']);
      }
    });
    for (const duong of ['/cases', '/incidents', '/petitions']) {
      expect(thamSoCuoi(duong).search).toBeUndefined();
    }
  });

  it('một loại: danh sách và CẢ BA thống kê cùng thẻ — số trên chip khớp dòng', async () => {
    renderWithRouter(['/comprehensive?comp_type=CASE&comp_q=abc']);
    await waitFor(() => {
      expect(thamSoCuoi('/cases').tk).toEqual(['*~abc']);
      for (const duong of ['/cases/stats', '/incidents/stats', '/petitions/stats']) {
        expect(thamSoCuoi(duong).tk).toEqual(['*~abc']);
        expect(thamSoCuoi(duong).search).toBeUndefined();
      }
    });
  });

  it('cờ TIM_KIEM_THE tắt → gửi `search` như trước', async () => {
    renderWithRouter(
      ['/comprehensive?comp_q=abc'],
      [
        {
          key: 'TIM_KIEM_THE',
          label: 'Tìm kiếm dạng thẻ',
          description: null,
          enabled: false,
          domain: null,
          rolloutPct: 100,
        },
      ],
    );
    await waitFor(() => expect(thamSoCuoi('/cases').search).toBe('abc'));
    expect(thamSoCuoi('/cases').tk).toBeUndefined();
  });
});

/**
 * Ô thẻ ĐẦY ĐỦ cho Tổng hợp (M4, 15/09/2026). Bảng gộp ba loại hồ sơ, mỗi máy chủ chỉ nhận khoá của
 * mình (khoá lạ → 400). Nên: "Tất cả" chỉ dùng khoá CHUNG ba loại (trừ kiểu chọn — mã trạng thái mỗi
 * loại khác nhau); chọn một loại thì dùng khai đầy đủ của loại ấy.
 */
describe('ComprehensiveListPageShell — ô thẻ đầy đủ', () => {
  const mockGet = () => api.get as unknown as ReturnType<typeof vi.fn>;
  const thamSoCuoi = (url: string) => {
    const goi = mockGet().mock.calls.filter((c) => c[0] === url);
    return goi[goi.length - 1]?.[1]?.params as Record<string, unknown> | undefined;
  };
  const oThe = () => screen.findByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
  const goiYKhiGo = async (chu: string) => {
    fireEvent.change(await oThe(), { target: { value: chu } });
    return (await screen.findAllByRole('option')).map((x) => x.textContent ?? '');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupHappy();
  });

  it('"Tất cả": gợi ý khoá CHUNG — có STT, Đơn vị giải quyết; không có Trạng thái', async () => {
    renderWithRouter();
    const goiY = await goiYKhiGo('abc');
    expect(goiY).toContain('Tìm STT: "abc"');
    expect(goiY).toContain('Tìm Đơn vị giải quyết: "abc"');
    expect(goiY.some((t) => t.startsWith('Trạng thái'))).toBe(false);
  });

  it('chọn một loại (Vụ án): gợi ý có Trạng thái theo mã của loại ấy', async () => {
    renderWithRouter(['/comprehensive?comp_type=CASE']);
    const goiY = await goiYKhiGo('tiep nhan');
    expect(goiY.some((t) => /^Trạng thái: /.test(t))).toBe(true);
  });

  it('đường dẫn cũ district / created_by → thẻ, gửi tới CẢ BA danh sách', async () => {
    renderWithRouter(['/comprehensive?comp_district=Doi%203&comp_created_by=An']);
    await waitFor(() => {
      for (const duong of ['/cases', '/incidents', '/petitions']) {
        expect(thamSoCuoi(duong)?.tk).toEqual(['donViGiaiQuyet~Doi 3', 'nguoiNhap~An']);
      }
    });
  });

  it('Từ ngày / Đến ngày ĐI XUỐNG cả ba API (Vụ việc dùng fromDateRange/toDateRange)', async () => {
    renderWithRouter(['/comprehensive?comp_from_date=2026-01-01&comp_to_date=2026-01-31']);
    await waitFor(() => {
      expect(thamSoCuoi('/cases')).toMatchObject({ fromDate: '2026-01-01', toDate: '2026-01-31' });
      expect(thamSoCuoi('/petitions')).toMatchObject({ fromDate: '2026-01-01', toDate: '2026-01-31' });
      expect(thamSoCuoi('/incidents')).toMatchObject({
        fromDateRange: '2026-01-01',
        toDateRange: '2026-01-31',
      });
    });
  });

  it('một loại + thẻ riêng loại ấy: thống kê loại khác KHÔNG bị gửi thẻ lạ (không 400)', async () => {
    renderWithRouter(['/comprehensive?comp_type=CASE&comp_tk=trangThai~TIEP_NHAN']);
    await waitFor(() => expect(thamSoCuoi('/cases')?.tk).toEqual(['trangThai~TIEP_NHAN']));
    await waitFor(() => expect(thamSoCuoi('/cases/stats')?.tk).toEqual(['trangThai~TIEP_NHAN']));
    expect(mockGet().mock.calls.some((c) => c[0] === '/petitions/stats')).toBe(false);
    expect(mockGet().mock.calls.some((c) => c[0] === '/incidents/stats')).toBe(false);
  });

  it('"Tất cả" mang thẻ riêng một loại → thẻ ĐỎ, không gửi thẻ ấy', async () => {
    renderWithRouter(['/comprehensive?comp_tk=trangThai~TIEP_NHAN']);
    const the = await screen.findByTestId('the-tim-kiem');
    expect(the).toHaveAttribute('data-hop-le', 'false');
    await waitFor(() => expect(thamSoCuoi('/cases')).toBeDefined());
    expect(thamSoCuoi('/cases')?.tk).toBeUndefined();
  });

  it('cột Đơn vị giải quyết hiện ĐÚNG cột thẻ lọc (donViGiaiQuyet), không phải `unit`', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ án XYZ'));
    expect(screen.getByRole('columnheader', { name: 'Đơn vị giải quyết' })).toBeInTheDocument();
    expect(screen.getByText('Đội 3')).toBeInTheDocument();
    expect(screen.getByText('Đội 5')).toBeInTheDocument();
    expect(screen.queryByText('PA')).not.toBeInTheDocument();
  });

  it('cột "Người nhập" có trong menu chọn cột (ẩn sẵn) — ô lọc Người tạo đã thành thẻ', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ án XYZ'));
    expect(screen.queryByRole('columnheader', { name: 'Người nhập' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-column-picker'));
    expect(within(screen.getByTestId('column-picker-menu')).getByText('Người nhập')).toBeInTheDocument();
  });

  it('không có kết quả với thẻ → nói rõ đang lọc bởi thẻ nào', async () => {
    mockGet().mockImplementation((path: string) => {
      if (path.endsWith('/stats')) return Promise.resolve({ data: { total: 0, byStatus: {} } });
      return Promise.resolve({ data: { data: [], total: 0 } });
    });
    renderWithRouter(['/comprehensive?comp_tk=stt~999']);
    const vung = await screen.findByTestId('list-page-shell-table-empty-filtered');
    expect(vung).toHaveTextContent('Không tìm thấy với');
  });

  /**
   * Khoá `trangThai` có ở cả ba loại nhưng MÃ khác nhau: đổi chip sang Đơn thư với thẻ trạng thái
   * Vụ án, xét theo khoá thôi thì thẻ vẫn đi — máy chủ trả 400, cả danh sách thành lỗi.
   */
  it('đổi sang loại mà GIÁ TRỊ thẻ chọn không hợp lệ → thẻ đỏ, không gửi (không 400)', async () => {
    renderWithRouter(['/comprehensive?comp_type=PETITION&comp_tk=trangThai~DANG_DIEU_TRA']);
    expect(await screen.findByTestId('the-tim-kiem')).toHaveAttribute('data-hop-le', 'false');
    await waitFor(() => expect(thamSoCuoi('/petitions')).toBeDefined());
    expect(thamSoCuoi('/petitions')?.tk).toBeUndefined();
  });

  it('đường dẫn cũ `comp_status` gõ tự do → thẻ đỏ, không gửi', async () => {
    renderWithRouter(['/comprehensive?comp_type=CASE&comp_status=dang%20xu%20ly']);
    expect(await screen.findByTestId('the-tim-kiem')).toHaveAttribute('data-hop-le', 'false');
    await waitFor(() => expect(thamSoCuoi('/cases')).toBeDefined());
    expect(thamSoCuoi('/cases')?.tk).toBeUndefined();
  });

  it('một loại + thẻ CHUNG: thống kê loại khác VẪN gọi, cùng thẻ + ngày theo tên từng API', async () => {
    renderWithRouter(['/comprehensive?comp_type=CASE&comp_tk=stt~1&comp_from_date=2026-01-01']);
    await waitFor(() =>
      expect(thamSoCuoi('/incidents/stats')).toMatchObject({
        tk: ['stt~1'],
        fromDateRange: '2026-01-01',
      }),
    );
    expect(thamSoCuoi('/petitions/stats')).toMatchObject({ tk: ['stt~1'], fromDate: '2026-01-01' });
  });

  it('thẻ đỏ (không gửi) KHÔNG tính vào số bộ lọc; chỉ còn thẻ đỏ mà rỗng → vẫn "lọc không ra"', async () => {
    mockGet().mockImplementation((path: string) => {
      if (path.endsWith('/stats')) return Promise.resolve({ data: { total: 0, byStatus: {} } });
      return Promise.resolve({ data: { data: [], total: 0 } });
    });
    renderWithRouter(['/comprehensive?comp_tk=trangThai~TIEP_NHAN']);
    expect(await screen.findByTestId('the-tim-kiem')).toHaveAttribute('data-hop-le', 'false');
    expect(await screen.findByTestId('list-page-shell-table-empty-filtered')).toBeInTheDocument();
    expect(screen.queryByTestId('list-page-shell-filter-count')).not.toBeInTheDocument();
  });

  it('chip "Tất cả" KHÔNG hiện tổng cộng thiếu khi thống kê loại khác bị bỏ qua', async () => {
    renderWithRouter(['/comprehensive?comp_type=CASE&comp_tk=trangThai~TIEP_NHAN']);
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /^Vụ án/ }).textContent).toContain('10'),
    );
    const tatCa = screen.getAllByRole('tab').find((t) => t.textContent?.startsWith('Tất cả'));
    expect(tatCa?.textContent).not.toMatch(/\d/);
  });
});
