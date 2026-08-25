/**
 * Integration test for PetitionListPageShell (PR2/T5).
 *
 * Mirror Cases + Incidents shell test patterns. Petition has no phase tabs
 * (single workflow), so coverage simpler than Incidents.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation, Routes, Route } from 'react-router-dom';
import { api } from '@/lib/api';
import { PetitionListPageShell } from '../PetitionListPageShell';
import { PetitionStatus } from '@/shared/enums/generated';
import { AssignModalProvider } from '@/features/_shared/modals/AssignModalProvider';
import { DeleteResourceModalProvider } from '@/features/_shared/modals/DeleteResourceModalProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
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
    </MemoryRouter>
    </QueryClientProvider>,
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

// byGroup do SERVER đếm (PETITION_STATUS_GROUPS). Thiếu field này thì thẻ nhóm render
// khung xương vĩnh viễn — fixture phải có, không thì test "xanh giả".
const sampleStats = {
  total: 34,
  byStatus: exhaustiveByStatus,
  byGroup: {
    'moi-tiep-nhan': 8,
    'dang-xu-ly': 17, // DANG_XU_LY 15 + CHO_PHE_DUYET 2
    'da-giai-quyet': 8, // 4 + 3 + 1
    'da-luu-don': 1,
  },
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
    const chipBar = screen.getByRole('tablist', { name: /lọc theo trạng thái/i });
    expect(within(chipBar).getByText('34')).toBeInTheDocument(); // total
    expect(within(chipBar).getByText('15')).toBeInTheDocument(); // DANG_XU_LY
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

/**
 * Drill-down: bấm thẻ thống kê để lọc danh sách.
 *
 * Thẻ gộp nhiều trạng thái ("Đang xử lý" = DANG_XU_LY + CHO_PHE_DUYET) nên gửi KEY nhóm
 * (`statusGroup`) lên server, không gửi từng trạng thái.
 */
describe('PetitionListPageShell — drill-down thẻ thống kê', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/petitions') return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      if (url === '/petitions/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL: ' + url));
    });
  });

  /**
   * Nhãn như "Đang xử lý" có ở CẢ thẻ thống kê lẫn chip trạng thái. Thẻ là <button> thường,
   * chip là <button role="tab"> → lọc theo đó để nhắm đúng thẻ.
   */
  const cardButton = (label: string) => {
    const btn = screen
      .getAllByText(label)
      .map((el) => el.closest('button'))
      .find((b): b is HTMLButtonElement => b != null && b.getAttribute('role') !== 'tab');
    if (!btn) throw new Error(`Không tìm thấy thẻ thống kê "${label}"`);
    return btn;
  };

  it('thẻ hiển thị số từ byGroup của server (không cộng tay ở client)', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByText('17')).toBeInTheDocument()); // Đang xử lý
    expect(within(cardButton('Đã giải quyết')).getByText('8')).toBeInTheDocument();
  });

  /**
   * Đặt bộ lọc khi đang ở trang 3 phải kéo danh sách về trang 1.
   *
   * Không làm vậy thì cán bộ thấy một BẢNG TRỐNG: tập kết quả sau khi lọc chỉ còn 1 trang,
   * còn địa chỉ trang vẫn giữ `petitions_page=3`. Bảng trống không nói gì cả, nên người ta
   * kết luận "lọc xong không còn hồ sơ nào" trong khi hồ sơ nằm ở trang 1.
   *
   * Ca kiểm này nằm ở TẦNG TRANG chứ không chỉ ở hook, vì bản vá đầu tiên xoá khoá trống
   * `page` trong khi khoá thật là `petitions_page` — ca kiểm mức hook khi ấy vẫn xanh mà
   * không chứng minh được gì trên màn hình thật.
   */
  it('đặt bộ lọc rồi Áp dụng → về trang 1, không để lại bảng trống', async () => {
    const { getLocation } = renderWithRouter(['/petitions?petitions_page=3']);
    await waitFor(() => expect(screen.getByTestId('filter-stt')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('filter-stt'), { target: { value: '26-9706' } });
    fireEvent.click(screen.getByTestId('btn-apply-filters'));

    await waitFor(() => expect(getLocation()).toContain('petitions_stt=26-9706'));
    expect(getLocation()).not.toContain('petitions_page=3');
  });

  it('bấm thẻ → URL có statusGroup, page về 1, request gửi statusGroup KHÔNG gửi status', async () => {
    const { getLocation } = renderWithRouter(['/petitions?petitions_page=3']);
    await waitFor(() => expect(screen.getAllByText('Đang xử lý').length).toBeGreaterThan(0));

    fireEvent.click(cardButton('Đang xử lý'));

    await waitFor(() => expect(getLocation()).toContain('petitions_statusGroup=dang-xu-ly'));
    expect(getLocation()).toContain('petitions_page=1');

    await waitFor(() => {
      const calls = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => c[0] === '/petitions',
      );
      const last = calls[calls.length - 1];
      expect(last?.[1]?.params.statusGroup).toBe('dang-xu-ly');
      expect(last?.[1]?.params.status).toBeUndefined();
    });
  });

  it('bấm thẻ "Tổng" → xoá lọc nhóm', async () => {
    const { getLocation } = renderWithRouter(['/petitions?petitions_statusGroup=dang-xu-ly']);
    await waitFor(() => expect(screen.getAllByText('Tổng đơn thư').length).toBeGreaterThan(0));

    fireEvent.click(cardButton('Tổng đơn thư'));

    await waitFor(() => expect(getLocation()).not.toContain('petitions_statusGroup'));
  });

  it('thẻ đang chọn KHÔNG bấm được (anh chốt) — không phát sinh request mới', async () => {
    renderWithRouter(['/petitions?petitions_statusGroup=dang-xu-ly']);
    await waitFor(() => expect(screen.getAllByText('Đang xử lý').length).toBeGreaterThan(0));
    const before = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.length;

    const active = cardButton('Đang xử lý');
    expect(active).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(active);

    expect((api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(before);
  });

  it('chọn chip trạng thái → xoá nhóm đang lọc (hai control loại trừ nhau)', async () => {
    const { getLocation } = renderWithRouter(['/petitions?petitions_statusGroup=dang-xu-ly']);
    const chipBar = await screen.findByRole('tablist');
    const chip = within(chipBar)
      .getAllByRole('tab')
      .find((t) => t.textContent?.includes('Lưu đơn'))!;

    fireEvent.click(chip);

    await waitFor(() => expect(getLocation()).not.toContain('petitions_statusGroup'));
  });

  /** Bấm thẻ chỉ được bắn lại DANH SÁCH — bắn lại stats sẽ nháy khung xương mỗi lần bấm. */
  it('bấm thẻ KHÔNG gọi lại /petitions/stats', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getAllByText('Đang xử lý').length).toBeGreaterThan(0));
    const statsBefore = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0] === '/petitions/stats',
    ).length;

    fireEvent.click(cardButton('Đang xử lý'));

    await waitFor(() => {
      const calls = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => c[0] === '/petitions',
      );
      expect(calls[calls.length - 1]?.[1]?.params.statusGroup).toBe('dang-xu-ly');
    });
    const statsAfter = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => c[0] === '/petitions/stats',
    ).length;
    expect(statsAfter).toBe(statsBefore);
  });

  /**
   * REGRESSION #2: trước đây gửi `sender` (DTO chỉ có `senderName`) và `advancedStatus`
   * (DTO không có) → forbidNonWhitelisted trả 400, bộ lọc nâng cao gãy.
   */
  it('KHÔNG gửi param lạ khiến backend trả 400 (sender/advancedStatus)', async () => {
    renderWithRouter(['/petitions?petitions_sender=Nguyen']);
    await waitFor(() => {
      const calls = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => c[0] === '/petitions',
      );
      expect(calls.length).toBeGreaterThan(0);
      const p = calls[calls.length - 1]?.[1]?.params ?? {};
      expect(p.sender).toBeUndefined();
      expect(p.advancedStatus).toBeUndefined();
      expect(p.senderName).toBe('Nguyen');
    });
  });

  /** REGRESSION #1: stats phải nhận cùng bộ lọc với danh sách, nếu không số thẻ lệch. */
  it('stats nhận CÙNG bộ lọc nâng cao với danh sách', async () => {
    renderWithRouter(['/petitions?petitions_sender=Nguyen']);
    await waitFor(() => {
      const statsCalls = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
        (c) => c[0] === '/petitions/stats',
      );
      expect(statsCalls[statsCalls.length - 1]?.[1]?.params.senderName).toBe('Nguyen');
    });
  });
});

/**
 * Bố cục danh sách theo hệ cũ (25/08/2026).
 *
 * Cán bộ vừa chuyển sang hệ mới và nói danh sách "cần giống hệ cũ". Khoảng cách không nằm
 * ở dữ liệu mà ở giao diện: cột Tóm tắt nội dung phủ 99,99% đơn thư nhưng KHÔNG được hiện,
 * nên muốn biết hồ sơ nói gì phải mở từng cái.
 *
 * Anh chốt: giống nội dung và bảng lọc, nhưng GIỮ năng lực mới (chip trạng thái, thẻ thống
 * kê, sắp xếp). Nhóm ca kiểm này chốt cả hai vế.
 */
describe('PetitionListPageShell — bố cục theo hệ cũ', () => {
  const rowDaiDong = {
    ...sampleRow,
    stt: '2026-11171',
    summary:
      'Tố giác bà Phạm Thị Thuỳ Oanh (Sinh năm: 1992; Địa chỉ: 93 Đặng Thuỳ Trâm, phường Bình Lợi Trung, TP. HCM) chiếm đoạt số tiền 769.325.000 đồng thông qua việc vay mượn và tạo các dây hụi ảo để thu tiền của bà Tâm.',
    nguonDon: 'Bưu điện',
    ketQuaXuLyKhac: 'Đã chuyển Tổ 5',
    enteredBy: { id: 'u1', firstName: 'Duy', lastName: 'Trần Hoàng', username: 'duyth' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/petitions') {
        return Promise.resolve({ data: { data: [rowDaiDong], total: 1 } });
      }
      if (url === '/petitions/stats') return Promise.resolve({ data: sampleStats });
      return Promise.reject(new Error('Unknown URL: ' + url));
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
  it('hiện đủ các cột hệ cũ, đúng thứ tự, Thao tác ở ĐẦU', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByText('Bưu điện')).toBeInTheDocument());

    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim() ?? '');
    const viTri = (nhan: string) => headers.findIndex((h) => h.includes(nhan));

    expect(viTri('STT')).toBeGreaterThanOrEqual(0);
    expect(viTri('Nguồn đơn')).toBeGreaterThan(viTri('STT'));
    expect(viTri('Tóm tắt nội dung')).toBeGreaterThan(viTri('Nguồn đơn'));
    expect(viTri('Người nhập')).toBeGreaterThan(viTri('Tóm tắt nội dung'));

    // Ô tick là tiêu đề cột thứ nhất (không có chữ), nên Thao tác là cột thứ hai.
    expect(viTri('Thao tác')).toBe(1);
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

  it('hiện tóm tắt nội dung — cột cán bộ đọc nhiều nhất mà hệ mới đang thiếu', async () => {
    renderWithRouter();
    await waitFor(() =>
      expect(screen.getByTestId('summary-text')).toHaveTextContent('Tố giác bà Phạm Thị Thuỳ Oanh'),
    );
    expect(screen.getByRole('button', { name: /xem thêm/i })).toBeInTheDocument();
  });

  it('mã hồ sơ hiện dạng ngắn như hệ cũ, KHÔNG đổi dữ liệu', async () => {
    renderWithRouter();
    // Máy chủ trả `2026-11171`; màn hình phải hiện `26-11171`.
    await waitFor(() => expect(screen.getByText('26-11171')).toBeInTheDocument());
    expect(screen.queryByText('2026-11171')).not.toBeInTheDocument();
  });

  it('GIỮ chip trạng thái và thẻ thống kê — không đánh đổi năng lực mới lấy giao diện cũ', async () => {
    renderWithRouter();
    await waitFor(() => expect(screen.getByText('Bưu điện')).toBeInTheDocument());
    // Chip trạng thái render bằng role="tab" — hệ cũ không có thứ này, và anh chốt GIỮ.
    expect(screen.getAllByRole('tab').length).toBeGreaterThan(0);
  });


  it('bộ lọc kiểu hệ cũ ĐI VÀO lời gọi API, không chỉ ghi vào địa chỉ trang', async () => {
    // Ca kiểm ĐẶT ĐÚNG TẦNG: mặt lọc có ca kiểm riêng và vẫn xanh kể cả khi trang quên nối
    // tham số xuống API — người dùng thấy ô lọc đổi mà danh sách đứng yên.
    // Khoá địa chỉ trang là khoá của registry (`stt_cu`, `entered_by`), KHÔNG phải tên
    // tham số API (`sttCu`, `enteredById`) — hai thứ khác nhau, và lẫn lộn chúng chính là
    // nguồn gốc của hai ô "Từ ngày" không đồng bộ trước đây.
    renderWithRouter([
      '/petitions?petitions_stt=26-11171&petitions_stt_cu=1964&petitions_entered_by=u1',
    ]);

    await waitFor(() => {
      const goi = (api.get as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
        (c: unknown[]) => c[0] === '/petitions',
      );
      expect(goi).toBeDefined();
      const params = (goi as [string, { params: Record<string, unknown> }])[1].params;
      expect(params.stt).toBe('26-11171');
      expect(params.sttCu).toBe('1964');
      expect(params.enteredById).toBe('u1');
    });
  });
});

/**
 * MỘT mặt lọc duy nhất cho mỗi trang (25/08/2026).
 *
 * Trước đó trang có HAI bộ lọc: accordion sẵn có (registry v0.62) và thẻ lọc riêng em
 * thêm. Cả hai đều có ô "Từ ngày" nhưng dùng hai khoá khác nhau (`petitions_from_date` và
 * `petitions_fromDate`) nên không đồng bộ: cán bộ đặt ngày ở ô này thì ô kia vẫn trống, đặt cả
 * hai thì một cái ghi đè âm thầm. Không có cách nào cho người dùng biết ô nào đang có hiệu lực.
 */
describe('PetitionListPageShell — một mặt lọc duy nhất', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === '/petitions') return Promise.resolve({ data: { data: [sampleRow], total: 1 } });
      if (url === '/petitions/stats') return Promise.resolve({ data: sampleStats });
      return Promise.resolve({ data: { data: [], total: 0 } });
    });
  });

  it('chỉ có ĐÚNG MỘT ô "Từ ngày" trên toàn trang', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Nguyễn Văn A'));

    // Mở bộ lọc nâng cao để mọi ô đều được dựng.
    const nutLoc = screen.queryByRole('button', { name: /bộ lọc/i });
    if (nutLoc) fireEvent.click(nutLoc);

    expect(screen.getAllByLabelText(/Từ ngày/i)).toHaveLength(1);
    expect(screen.getAllByLabelText(/Đến ngày/i)).toHaveLength(1);
  });

  it('không còn thẻ lọc riêng bên ngoài thanh công cụ', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    expect(screen.queryByTestId('legacy-filter-left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('legacy-filter-right')).not.toBeInTheDocument();
  });

  it('ô STT / STT cũ / Cán bộ nhập nằm trong cùng mặt lọc ấy', async () => {
    renderWithRouter();
    await waitFor(() => screen.getByText('Nguyễn Văn A'));
    const nutLoc = screen.queryByRole('button', { name: /bộ lọc/i });
    if (nutLoc) fireEvent.click(nutLoc);

    expect(screen.getByLabelText(/^STT$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/STT cũ/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Cán bộ nhập/i)).toBeInTheDocument();
  });
});
