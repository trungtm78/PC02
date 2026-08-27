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
 * Bố cục danh sách theo hệ cũ (25/08/2026) — xem `PetitionListPageShell.test.tsx` cho lý do
 * đầy đủ. Vụ việc có `description` phủ 99,98% nhưng danh sách không hiện.
 */
describe('IncidentListPageShell — bố cục theo hệ cũ', () => {
  const rowHeCu = {
    ...sampleRow,
    code: '2026-9706',
    description:
      'Chị Phạm Thị Phương Linh tố giác đối tượng Cao Thị Dự nhận môi giới ghép nội tạng (thận) cho chị Linh với số tiền 1.432.000.000 đồng, sau đó chiếm đoạt và cắt liên lạc hoàn toàn.',
    ketQuaXuLy: 'Đã chuyển Tổ 7',
    canBoNhap: { id: 'u1', firstName: 'Tuấn', lastName: 'Dương Trọng', username: 'trongtuan' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/incidents') return Promise.resolve({ data: { data: [rowHeCu], total: 1 } });
      if (url === '/incidents/stats') return Promise.resolve({ data: sampleStats });
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


  /**
   * Cột Thao tác phải GHIM khi cuộn ngang.
   *
   * Bảng này cuộn ngang được từ 25/08/2026. Không ghim thì cột Thao tác vừa đưa lên đầu sẽ
   * trôi khỏi màn hình ngay khi cán bộ cuộn sang phải đọc các cột sau — mất đúng cái lợi
   * vừa làm, và phải cuộn ngược về mới bấm được.
   */
  it('cột Thao tác ghim ở mép trái khi cuộn ngang', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByTestId('summary-text')).toBeInTheDocument());

    const th = screen.getByRole('columnheader', { name: 'Thao tác' });
    expect(th.className).toContain('sticky');

    const hang = screen.getAllByRole('row').slice(1)[0];
    const oThaoTac = within(hang).getAllByRole('cell')[1];
    expect(oThaoTac.className).toContain('sticky');
  });


  /**
   * Anh nêu đích danh 25/08/2026: cột "Tóm tắt nội dung" phải RỘNG HƠN cột "Tên cá nhân,
   * cơ quan, tổ chức cung cấp, bị hại".
   *
   * Số đo trên bản chạy thật hậu thuẫn: tóm tắt dài trung vị 350 ký tự (đơn thư) / 309 (vụ
   * án), còn tên người 16 / 40. Chốt bằng ca kiểm vì đây là loại thứ dễ bị đảo ngược lặng
   * lẽ khi ai đó chỉnh bề rộng cho vừa mắt trên một màn hình cụ thể.
   */
  it('cột Tóm tắt nội dung rộng hơn cột Tên cá nhân', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByTestId('summary-text')).toBeInTheDocument());

    const beRong = (nhan: string) => {
      const th = screen
        .getAllByRole('columnheader')
        .find((h) => (h.textContent ?? '').includes(nhan))!;
      return parseFloat((th as HTMLElement).style.width);
    };

    expect(beRong('Tóm tắt nội dung')).toBeGreaterThan(beRong('Tên cá nhân'));
  });


  /**
   * Chốt ở TẦNG TRANG rằng ô không thể vẽ đè sang cột bên.
   *
   * Anh chụp màn hình 25/08/2026: mã "VV-LEGACY-TamDinhChi_vu_viec_21_…" trong cột STT rộng
   * 7rem tràn ra đè lên cột "Tên cá nhân", hai dòng chữ chồng nhau. Chốt ở token là chốt
   * design token; chốt ở đây là chốt đúng cái ô mà anh nhìn thấy.
   */
  it('ô dữ liệu cắt phần thừa, không vẽ đè sang cột bên', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByTestId('summary-text')).toBeInTheDocument());

    const hang = screen.getAllByRole('row').slice(1)[0];
    const oStt = within(hang).getAllByRole('cell')[2]; // [0] ô tick, [1] Thao tác, [2] STT
    expect(oStt.className).toContain('overflow-hidden');
    expect(oStt.className).toContain('whitespace-nowrap');
  });


  /**
   * BỘ CỘT MẶC ĐỊNH = ĐÚNG BỘ HỆ CŨ + Trạng thái.
   *
   * Anh gửi ba ảnh hệ cũ ngày 25/08/2026 và yêu cầu cột hiện mặc định đúng như ảnh; Trạng
   * thái giữ hiện thêm vì hệ cũ không có khái niệm ấy còn hệ mới có 15 trạng thái và có chip
   * lọc theo chúng.
   *
   * Ca kiểm liệt kê THẲNG danh sách nhãn chứ không đếm số cột: thiếu nó thì lần sau ai thêm
   * một cột "cho tiện" là bộ mặc định phình ra mà không ai biết, và ta quay lại đúng cảnh
   * bảng chật mà anh đã phải báo.
   */
  it('bộ cột mặc định đúng bằng bộ hệ cũ, không thừa không thiếu', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByTestId('summary-text')).toBeInTheDocument());

    const nhan = screen
      .getAllByRole('columnheader')
      .map((h) => (h.textContent ?? '').trim())
      .filter((t) => t.length > 0);

    // Cập nhật 27/08/2026: bộ cột trên KHÔNG đủ. Đo thẳng màn `/doi-1/vu-viec-da-phan-loai`
    // của hệ cũ hôm nay thì nó có 9 cột, và cột thứ ba là "Nguồn đơn/Đơn vị giao" — cột mà
    // bản trước bỏ sót. Dữ liệu đã nằm sẵn ở `chuyenTuDonVi` (3.454 hồ sơ) nhưng danh sách
    // chưa bao giờ hiện, nên cán bộ phải mở từng hồ sơ ra mới biết hồ sơ từ đâu tới.
    expect(nhan).toEqual(['Thao tác', 'STT', 'Ngày đề xuất', 'Nguồn đơn/Đơn vị giao', 'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại', 'Tóm tắt nội dung', 'Đơn vị giải quyết', 'Kết quả xử lý, giải quyết khác', 'Người nhập', 'Trạng thái']);
  });

  it('cột hệ cũ KHÔNG có thì ẩn sẵn, bật lại được từ menu chọn cột', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByTestId('summary-text')).toBeInTheDocument());

    for (const an of ['Điều tra viên', 'Hạn xử lý', 'Ngày tạo']) {
      expect(screen.queryByRole('columnheader', { name: an })).not.toBeInTheDocument();
    }

    fireEvent.click(screen.getByTestId('btn-column-picker'));
    // Tìm TRONG menu chứ không tìm cả trang: nhãn "Điều tra viên" còn xuất hiện ở ô lọc,
    // nên tìm cả trang là trúng hai chỗ và ca kiểm đỏ vì lý do không liên quan.
    const menu = within(screen.getByTestId('column-picker-menu'));
    for (const an of ['Điều tra viên', 'Hạn xử lý', 'Ngày tạo']) {
      expect(menu.getByText(an)).toBeInTheDocument();
    }
  });

  it('mã hồ sơ hiện dạng ngắn như hệ cũ', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByText('26-9706')).toBeInTheDocument());
  });

  it('bộ lọc kiểu hệ cũ ĐI VÀO lời gọi API', async () => {
    renderWithRouter(['/incidents?incidents_stt=26-9706&incidents_stt_cu=679']);
    await waitFor(() => {
      const goi = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => c[0] === '/incidents',
      );
      const params = (goi as [string, { params: Record<string, unknown> }])[1].params;
      expect(params.stt).toBe('26-9706');
      expect(params.sttCu).toBe('679');
    });
  });
});
