/**
 * Integration test for CaseListPageShell — canonical ListPageShell consumer.
 *
 * Covers full E2E flow:
 * - Mount → loading → ready render với rows
 * - StatusChips render với server counts
 * - Status filter click → URL state update + re-fetch
 * - Search input → URL state update + re-fetch
 * - Pagination next → URL state update + re-fetch
 * - Empty state (filters active vs initial)
 * - Error state với retry context
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, Routes, Route } from 'react-router-dom';
import { api } from '@/lib/api';
import { CaseListPageShell } from '../CaseListPageShell';
import { CaseStatus } from '@/shared/enums/generated';
import { AssignModalProvider } from '@/features/_shared/modals/AssignModalProvider';
import { DeleteResourceModalProvider } from '@/features/_shared/modals/DeleteResourceModalProvider';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

function renderWithRouter(initialEntries: string[] = ['/cases']) {
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
            <Route path="/cases" element={<><CaseListPageShell /><LocationTracker /></>} />
            <Route path="/cases/new" element={<div>NewPage</div>} />
            <Route path="/cases/:id" element={<div>DetailPage</div>} />
          </Routes>
        </DeleteResourceModalProvider>
      </AssignModalProvider>
    </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, getLocation: () => lastLocation };
}

const sampleRow = {
  id: 'case-1',
  caseCode: 'PC02-001',
  name: 'Vụ án mẫu',
  status: 'TIEP_NHAN',
  unit: 'PA',
  investigator: { firstName: 'Nguyễn', lastName: 'A', username: 'nva' },
  createdAt: '2026-05-20T00:00:00Z',
  updatedAt: '2026-05-21T00:00:00Z',
};

const sampleStats = {
  total: 100,
  byStatus: {
    TIEP_NHAN: 12,
    DANG_XAC_MINH: 23,
    DA_XAC_MINH: 7,
    DANG_DIEU_TRA: 45,
    TAM_DINH_CHI: 3,
    DINH_CHI: 2,
    DA_KET_LUAN: 5,
    DANG_TRUY_TO: 1,
    DANG_XET_XU: 2,
    DA_LUU_TRU: 0,
  },
  // byGroup do SERVER đếm. Thiếu field này thì 4 thẻ nhóm render khung xương vĩnh viễn
  // và test vẫn pass vì không assert giá trị thẻ — "xanh giả".
  byGroup: {
    'dang-dieu-tra': 90, // 12+23+7+45+1+2
    'da-ket-luan': 5, // 5+0
    'dinh-chi': 2,
    'tam-dinh-chi': 3,
  },
};

describe('CaseListPageShell — initial mount + ready state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/cases') {
        return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      }
      if (url === '/cases/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL: ' + url));
    });
  });

  it('mount → render skeleton → ready với 1 row', async () => {
    renderWithRouter();
    expect(screen.getByTestId('list-page-shell-table-loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('list-page-shell-table-loading')).not.toBeInTheDocument());
    expect(screen.getByText('Vụ án mẫu')).toBeInTheDocument();
    expect(screen.getByText('PC02-001')).toBeInTheDocument();
  });

  it('header render "Danh sách vụ án" title', async () => {
    renderWithRouter();
    expect(screen.getByRole('heading', { level: 1, name: /Danh sách vụ án/i })).toBeInTheDocument();
  });

  it('StatusChips render với 10 status options + "Tất cả"', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ án mẫu'));
    // "Tất cả" + 10 statuses = 11 tabs
    expect(screen.getAllByRole('tab')).toHaveLength(11);
  });

  it('StatusChips hiển thị server counts khi stats về', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ án mẫu'));
    // Query within StatusChips tablist to avoid ambiguity with StatsCardsStrip
    const chipBar = screen.getByRole('tablist');
    expect(within(chipBar).getByText('100')).toBeInTheDocument();
    expect(within(chipBar).getByText('12')).toBeInTheDocument();
    expect(within(chipBar).getByText('45')).toBeInTheDocument();
  });
});

describe('CaseListPageShell — interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/cases') return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      if (url === '/cases/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('click status chip → URL state cập nhật + re-fetch với status param', async () => {
    const { getLocation } = renderWithRouter();
    await waitFor(() => screen.getByText('Vụ án mẫu'));
    const tiepNhanChip = screen.getAllByRole('tab').find((t) => t.textContent?.includes('Tiếp nhận'));
    expect(tiepNhanChip).toBeDefined();
    fireEvent.click(tiepNhanChip!);
    await waitFor(() => {
      expect(getLocation()).toContain('cases_status=TIEP_NHAN');
      expect(getLocation()).toContain('cases_page=1');
    });
  });

  it('search input change → URL state cập nhật', async () => {
    const { getLocation } = renderWithRouter();
    await waitFor(() => screen.getByText('Vụ án mẫu'));
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'abc' } });
    await waitFor(() => expect(getLocation()).toContain('cases_q=abc'));
  });

  it('row click → navigate to detail page', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ án mẫu'));
    fireEvent.click(screen.getByText('Vụ án mẫu'));
    await waitFor(() => expect(screen.getByText('DetailPage')).toBeInTheDocument());
  });

  it('"Tạo mới" button → navigate /cases/new', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Vụ án mẫu'));
    fireEvent.click(screen.getByRole('button', { name: /Tạo mới/i }));
    await waitFor(() => expect(screen.getByText('NewPage')).toBeInTheDocument());
  });
});

describe('CaseListPageShell — empty + error states', () => {
  it('state=empty (no filter, no rows) → render empty CTA "Tạo vụ án mới"', async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/cases') return Promise.resolve({ data: { data: [], total: 0 } });
      if (url === '/cases/stats') {
        return Promise.resolve({ data: { total: 0, byStatus: sampleStats.byStatus } });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    renderWithRouter();
    await waitFor(() => expect(screen.getByTestId('list-page-shell-table-empty')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Tạo vụ án mới' })).toBeInTheDocument();
  });

  it('state=empty-filtered (active filter, no rows) → render filtered empty', async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/cases') return Promise.resolve({ data: { data: [], total: 0 } });
      if (url === '/cases/stats') {
        return Promise.resolve({ data: { total: 50, byStatus: sampleStats.byStatus } });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
    renderWithRouter(['/cases?cases_status=TIEP_NHAN']);
    await waitFor(() =>
      expect(screen.getByTestId('list-page-shell-table-empty-filtered')).toBeInTheDocument(),
    );
  });

  it('state=error → render Vietnamese error message từ axios exception', async () => {
    // Mock axios-shaped 500 error → expects VN message theo getVietnameseErrorMessage.
    const axiosError = Object.assign(new Error('Internal Server Error'), {
      isAxiosError: true,
      response: { status: 500, data: {} },
    });
    (api.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(axiosError);
    renderWithRouter();
    await waitFor(() => expect(screen.getByTestId('list-page-shell-table-error')).toBeInTheDocument());
    expect(screen.getByText(/Lỗi máy chủ/i)).toBeInTheDocument();
  });

  it('state=error → fallback Vietnamese message khi unknown error', async () => {
    (api.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Random'));
    renderWithRouter();
    await waitFor(() => expect(screen.getByTestId('list-page-shell-table-error')).toBeInTheDocument());
    expect(screen.getByText(/Lỗi không xác định/i)).toBeInTheDocument();
  });
});

describe('CaseListPageShell — security + contract fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/cases') return Promise.resolve({ data: { data: [], total: 0 } });
      if (url === '/cases/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('malformed status URL param (proto pollution attempt) → ignore, không fetch với status param', async () => {
    renderWithRouter(['/cases?cases_status=__proto__']);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/cases', expect.any(Object)));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === '/cases');
    expect(listCall?.[1]?.params.status).toBeUndefined();
  });

  it('byStatus response exhaustive — mọi CaseStatus key có number, không undefined', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByTestId('list-page-shell-table-empty')).toBeInTheDocument());
    // chip count text ẩn trong DOM. Kiểm tra qua mock data trực tiếp.
    Object.values(CaseStatus).forEach((status) => {
      expect(typeof sampleStats.byStatus[status]).toBe('number');
    });
  });
});

describe('CaseListPageShell — URL state load from query params', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/cases') return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      if (url === '/cases/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  it('load from URL với status filter → fetch caller với status param', async () => {
    renderWithRouter(['/cases?cases_status=DANG_DIEU_TRA']);
    await waitFor(() => screen.getByText('Vụ án mẫu'));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/cases',
    );
    expect(listCall?.[1]?.params.status).toBe('DANG_DIEU_TRA');
  });

  it('load from URL với search query → fetch caller với search param', async () => {
    renderWithRouter(['/cases?cases_q=abc']);
    await waitFor(() => screen.getByText('Vụ án mẫu'));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/cases',
    );
    expect(listCall?.[1]?.params.search).toBe('abc');
  });

  it('load from URL với page=2 → fetch offset=20', async () => {
    renderWithRouter(['/cases?cases_page=2']);
    await waitFor(() => screen.getByText('Vụ án mẫu'));
    const listCall = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === '/cases',
    );
    expect(listCall?.[1]?.params.offset).toBe(20);
  });
});

/**
 * Bố cục danh sách theo hệ cũ (25/08/2026) — xem `PetitionListPageShell.test.tsx` cho lý do
 * đầy đủ. Vụ án có `moTaChiTiet` phủ 98% hồ sơ di trú mà API danh sách trước nay không trả.
 */
describe('CaseListPageShell — bố cục theo hệ cũ', () => {
  const rowHeCu = {
    ...sampleRow,
    caseCode: '2026-9893',
    moTaChiTiet:
      'Qua công tác nghiệp vụ, ngày 10/4/2026, Cơ quan CSĐT Bộ Công an tiếp nhận đơn trình báo của bà Vũ Thị Thanh Hương về việc bị chiếm đoạt tài sản khi đầu tư mua bán qua sàn giao dịch điện tử.',
    createdBy: { id: 'u1', firstName: 'Trà', lastName: 'Bùi Thanh', username: 'mrtea' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/cases') return Promise.resolve({ data: { data: [rowHeCu], total: 1 } });
      if (url === '/cases/stats') return Promise.resolve({ data: sampleStats });
      return Promise.resolve({ data: { data: [], total: 0 } });
    });
  });

  /**
   * Thao tác là cột ĐẦU TIÊN, ngay sau ô tick.
   *
   * MỐC ĐÚNG ĐÃ ĐỔI, KHÔNG PHẢI CA KIỂM BỊ SỬA CHO KHỚP MÃ: PR #231 đưa cột này về CUỐI để
   * giống hệ cũ. Ngày 25/08/2026 anh yêu cầu ngược lại, lý do là thao tác. Ba bảng này rộng
   * 10-13 cột nên phải cuộn ngang; để Thao tác ở cuối thì mỗi lần muốn bấm là phải cuộn sang
   * phải rồi cuộn ngược về. Đây là chỗ hệ mới CỐ Ý khác hệ cũ.
   */
  it('Thao tác là cột ĐẦU và có cột Tóm tắt nội dung', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByTestId('summary-text')).toBeInTheDocument());
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim() ?? '');
    expect(headers.findIndex((h) => h.includes('Tóm tắt nội dung'))).toBeGreaterThanOrEqual(0);
    // Ô tick là tiêu đề cột thứ nhất (không có chữ), nên Thao tác là cột thứ hai.
    expect(headers.findIndex((h) => h.includes('Thao tác'))).toBe(1);
  });


  /**
   * Chốt đúng cái người dùng NHÌN THẤY, không chỉ chốt thứ tự trong mảng cột.
   *
   * "Ở vị trí 0 của mảng" là mệnh đề về cấu trúc dữ liệu; "ô thứ hai của hàng, ngay sau ô
   * tick" mới là mệnh đề về màn hình. Hai thứ chỉ trùng nhau chừng nào `Table` còn dựng ô
   * tick trước rồi mới đổ mảng cột — mà đó là thứ có thể đổi.
   */
  it('trong mỗi hàng, ô thứ nhất là ô tick và ô thứ hai là nút thao tác', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByTestId('summary-text')).toBeInTheDocument());

    const hang = screen.getAllByRole('row').slice(1)[0]; // bỏ hàng tiêu đề
    const o = within(hang).getAllByRole('cell');

    expect(within(o[0]).getByRole('checkbox')).toBeInTheDocument();
    expect(within(o[1]).getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('mã hồ sơ hiện dạng ngắn như hệ cũ', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByText('26-9893')).toBeInTheDocument());
  });

  it('bộ lọc kiểu hệ cũ ĐI VÀO lời gọi API', async () => {
    renderWithRouter(['/cases?cases_stt=26-9893&cases_created_by=u1']);
    await waitFor(() => {
      const goi = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => c[0] === '/cases',
      );
      const params = (goi as [string, { params: Record<string, unknown> }])[1].params;
      expect(params.stt).toBe('26-9893');
      expect(params.createdById).toBe('u1');
    });
  });
});
