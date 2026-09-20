/**
 * Payload form Đơn thư.
 *
 * Lịch sử: v0.37.2.4 form gửi TÊN "Tố cáo" vào `petitionType` (enum) → 100% đơn bị 400. Từ
 * 14/09/2026 form không còn ô Loại đơn thư: chỉ một ô "Loại thông tin" chọn từ danh mục
 * LOAI_THONG_TIN (gửi TÊN), còn nhóm hạn `petitionType` do máy chủ suy — form KHÔNG gửi nó.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { today } from '@/lib/dates';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));

// v0.42: stt is now auto-generated via DocNumberPreviewField — mock the draft call.
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: {
    draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-00001', isDraft: true, templateId: 'tmpl-2' }),
  },
}));

// Mock FKSelect (combobox tự dựng) thành <select> gốc để fireEvent.change dùng được. Ô có
// `onCreateNew` thì kèm nút "tạo mới" giả — kiểm được đường nối popup tạo nhanh của form.
const moPopupTaoNhanh = vi.hoisted(() => vi.fn());
vi.mock('@/features/_shared/modals/useQuickCreateDirectoryModal', () => ({
  useQuickCreateDirectoryModalSafe: () => ({ open: moPopupTaoNhanh }),
}));
// Lựa chọn theo TỪNG loại danh mục. Trước 27/08/2026 giả lập trả đúng ba mức ưu tiên cho
// mọi loại, nên ô "Đơn vị giải quyết" (loại UNIT) không chọn nổi tên tổ nào — `fireEvent.change`
// với giá trị không có trong danh sách thì `<select>` giữ nguyên rỗng, và ca kiểm đọc ra null.
const LUA_CHON_THEO_DANH_MUC: Record<string, string[]> = {
  UNIT: ['Đội 1 PC02', 'Đội 4', 'Đội 8'],
  LOAI_THONG_TIN: ['Tố giác', 'Khiếu nại (Quyết định tố tụng)', 'Đề nghị'],
  // "Nguồn đơn/Đơn vị giao" đổi từ ô CHỮ sang ô chọn danh mục (20/09/2026). Bản giả phải
  // biết loại này, nếu không `fireEvent.change` với tên nguồn chẳng chọn được gì và ca kiểm
  // parity đỏ vì bản giả hẹp hơn thực tế — đúng bẫy đã ghi ở khối trên.
  NGUON_DON: ['Công an phường 1', 'Bưu điện', 'Trực tiếp'],
};
// Ô "Đơn vị xử lý" ở nhánh nội bộ nhận `options={teamOptions}` (KHÔNG có directoryType), nên
// bản giả rơi vào danh sách mặc định — phải có sẵn tên tổ, nếu không `fireEvent.change` với tên
// tổ chẳng chọn được gì và ca kiểm đỏ vì bản giả hẹp hơn thực tế.
const LUA_CHON_MAC_DINH = ['Cao', 'Trung bình', 'Thấp', 'Đội 1 PC02', 'Đội 4', 'Đội 8'];

vi.mock('@/components/FKSelect', () => ({
  FKSelect: ({ value, onChange, testId, directoryType, onCreateNew }: {
    value: string;
    onChange: (v: string) => void;
    testId?: string;
    directoryType?: string;
    onCreateNew?: (tenGoiY: string) => void;
  }) => (
    <>
      <select
        data-testid={testId}
        data-directory-type={directoryType}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">--</option>
        {value && <option value={value}>{value}</option>}
        {(LUA_CHON_THEO_DANH_MUC[directoryType ?? ''] ?? LUA_CHON_MAC_DINH)
          .filter((v) => v !== value)
          .map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
      </select>
      {onCreateNew && (
        <button type="button" data-testid={`${testId}-tao-moi`} onClick={() => onCreateNew('trình báo')}>
          tạo mới
        </button>
      )}
    </>
  ),
}));

// CrimeSelect (master Tội danh) — mock như native select để fireEvent.change được.
vi.mock('@/components/CrimeSelect', () => ({
  CrimeSelect: ({ value, onChange, testId }: {
    value: string;
    onChange: (v: string) => void;
    testId?: string;
  }) => (
    <select data-testid={testId} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">--</option>
      <option value="crime-d173">Điều 173 · Tội trộm cắp tài sản</option>
    </select>
  ),
}));

const SAMPLE_PROFILE: AuthUser = {
  id: 'u1',
  email: 'a@b.com',
  username: 'a',
  firstName: 'A',
  lastName: 'B',
  role: 'OFFICER',
  canDispatch: false,
  teams: [{ teamId: 'team-doi-1', teamName: 'Đội 1', isLeader: true }],
  primaryTeam: { teamId: 'team-doi-1', teamName: 'Đội 1' },
};

async function renderForm() {
  const { PetitionFormPage } = await import('../PetitionFormPage');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/petitions/new']}>
        <Routes>
          <Route path="/petitions/new" element={<PetitionFormPage />} />
          <Route path="/petitions" element={<div>list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}


/**
 * Điền Số điện thoại nguyên đơn.
 *
 * Ô này nay nằm trong nhóm "Thông tin định danh nguyên đơn" thu gọn sẵn (20/09/2026) — nhóm
 * chỉ tự bung khi Nguồn đơn là nộp trực tiếp. Mở nhóm ra như cán bộ thật; mệnh đề này cũng
 * chứng minh ô vẫn ĐIỀN ĐƯỢC ở mọi nguồn, tức gom nhóm không lấy mất chỗ nhập.
 */
function dienSdtNguyenDon(so: string) {
  const nut = screen.queryByTestId('nhom-dinh-danh-nguyen-don-nut');
  if (nut && !screen.queryByTestId('field-senderPhone')) fireEvent.click(nut);
  fireEvent.change(screen.getByTestId('field-senderPhone'), { target: { value: so } });
}


/** Điền "Ngày viết đơn" qua ba ô phân đoạn. */
function dienNgayVietDon(ngay: string, thang: string, nam: string) {
  fireEvent.change(screen.getByTestId('field-petitionDate-ngay'), { target: { value: ngay } });
  fireEvent.change(screen.getByTestId('field-petitionDate-thang'), { target: { value: thang } });
  fireEvent.change(screen.getByTestId('field-petitionDate-nam'), { target: { value: nam } });
}

describe('PetitionFormPage — petitionType payload (v0.37.2.4 P0 fix)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authStore.setProfile(SAMPLE_PROFILE);
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  /**
   * 14/09/2026 — form gộp "Loại đơn thư" vào "Loại thông tin" như hệ cũ (một ô). `petitionType`
   * là NHÓM HẠN máy chủ tự suy từ danh mục; form KHÔNG gửi nó nữa.
   */
  it('chỉ còn MỘT ô hỏi loại: không có ô Loại đơn thư, Loại thông tin là ô chọn danh mục', async () => {
    await renderForm();
    const o = await screen.findByTestId('field-loaiThongTin');
    expect(o).toHaveAttribute('data-directory-type', 'LOAI_THONG_TIN');
    expect(screen.queryByTestId('field-petitionType')).not.toBeInTheDocument();
    expect(screen.queryByText(/Loại đơn thư/)).not.toBeInTheDocument();
  });

  it('gửi loaiThongTin chọn từ danh mục, KHÔNG gửi petitionType', async () => {
    await renderForm();

    fireEvent.change(await screen.findByTestId('field-senderName'), { target: { value: 'UAT Test Sender' } });
    fireEvent.change(screen.getByTestId('field-senderAddress'), { target: { value: 'UAT address' } });
    fireEvent.change(screen.getByTestId('field-detailContent'), { target: { value: 'UAT detail' } });
    fireEvent.change(screen.getByTestId('field-loaiThongTin'), {
      target: { value: 'Khiếu nại (Quyết định tố tụng)' },
    });
    fireEvent.change(screen.getByTestId('field-priority'), { target: { value: 'Cao' } });
    dienSdtNguyenDon('0901234567');
    fireEvent.change(screen.getByTestId('field-crimeChinhId'), { target: { value: 'crime-d173' } });

    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);
    await waitFor(() => expect(api.post).toHaveBeenCalled());

    const [url, body] = (api.post as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/petitions');
    expect(body.loaiThongTin).toBe('Khiếu nại (Quyết định tố tụng)');
    expect(body).not.toHaveProperty('petitionType');
  });

  it('render + gửi 5 field parity tab "Thông tin" (nguonDon/petitionDate/ngayDeXuat/phanLoaiNguonTin/dieuTraVien)', async () => {
    await renderForm();
    // Bắt buộc tối thiểu để qua validation
    fireEvent.change(await screen.findByTestId('field-senderName'), { target: { value: 'Người gửi' } });
    fireEvent.change(screen.getByTestId('field-senderAddress'), { target: { value: 'Địa chỉ' } });
    fireEvent.change(screen.getByTestId('field-detailContent'), { target: { value: 'Nội dung' } });
    fireEvent.change(screen.getByTestId('field-priority'), { target: { value: 'Cao' } });
    dienSdtNguyenDon('0901234567');
    fireEvent.change(screen.getByTestId('field-crimeChinhId'), { target: { value: 'crime-d173' } });

    // 5 field parity mới — input PHẢI tồn tại trên form (getByTestId throw nếu thiếu)
    fireEvent.change(screen.getByTestId('field-nguonDon'), { target: { value: 'Công an phường 1' } });
    // "Ngày viết đơn" nay là BA Ô phân đoạn (cho nhập thiếu thành phần), không còn là một ô
    // `<input type="date">`. Điền từng ô như cán bộ thật.
    dienNgayVietDon('18', '06', '2026');
    fireEvent.change(screen.getByTestId('field-ngayDeXuat'), { target: { value: '2026-06-20' } });
    fireEvent.change(screen.getByTestId('field-phanLoaiNguonTin'), { target: { value: 'don-cong-van-ban-dau' } });
    // "Điều tra viên thụ lý" nay nằm trong nhóm "Thông tin khác" thu gọn sẵn (rất ít khi
    // nhập). Mở nhóm ra như cán bộ thật — mệnh đề này cũng chứng minh ô vẫn ĐIỀN ĐƯỢC, tức
    // gom nhóm không lấy mất chỗ nhập của cột `dieuTraVien`.
    fireEvent.click(screen.getByTestId('nhom-thong-tin-khac-nut'));
    fireEvent.change(screen.getByTestId('field-dieuTraVien'), { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(screen.getByTestId('field-donViGiaiQuyet'), { target: { value: 'Đội 1 PC02' } });

    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);
    await waitFor(() => expect(api.post).toHaveBeenCalled());

    const [, body] = (api.post as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(body.nguonDon).toBe('Công an phường 1');
    expect(body.petitionDate).toBe('2026-06-18');
    expect(body.ngayDeXuat).toBe('2026-06-20');
    expect(body.phanLoaiNguonTin).toBe('don-cong-van-ban-dau');
    expect(body.dieuTraVien).toBe('Nguyễn Văn A');
    expect(body.donViGiaiQuyet).toBe('Đội 1 PC02');
  });

  it('nhãn "Ghi chú trùng đơn" hiển thị (khớp hệ cũ)', async () => {
    await renderForm();
    expect(await screen.findByText(/Ghi chú trùng đơn/i)).toBeInTheDocument();
  });

  /**
   * Nối dây tạo nhanh: ca kiểm popup chỉ chứng minh popup đúng khi ĐƯỢC mở đúng. Mở với loại
   * DON_VI, hay `onCreated` ghi nhầm ô, thì popup vẫn xanh mà cán bộ tạo xong ô vẫn trống.
   */
  it('tạo nhanh Loại thông tin: mở popup đúng loại, tạo xong ô mang tên mới và được gửi đi', async () => {
    await renderForm();

    fireEvent.change(await screen.findByTestId('field-senderName'), { target: { value: 'UAT Sender' } });
    fireEvent.change(screen.getByTestId('field-senderAddress'), { target: { value: 'UAT addr' } });
    fireEvent.change(screen.getByTestId('field-detailContent'), { target: { value: 'detail' } });
    dienSdtNguyenDon('0901234567');
    fireEvent.change(screen.getByTestId('field-crimeChinhId'), { target: { value: 'crime-d173' } });

    fireEvent.click(screen.getByTestId('field-loaiThongTin-tao-moi'));
    expect(moPopupTaoNhanh).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'LOAI_THONG_TIN', tenGoiY: 'trình báo' }),
    );
    const { onCreated } = moPopupTaoNhanh.mock.calls.at(-1)![0] as { onCreated: (ten: string) => void };
    act(() => onCreated('Trình báo'));
    expect(screen.getByTestId('field-loaiThongTin')).toHaveValue('Trình báo');

    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, body] = (api.post as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(body.loaiThongTin).toBe('Trình báo');
  });

  /** Thiếu loại thông tin KHÔNG chặn lưu — hệ cũ không bắt buộc, máy chủ tính hạn theo nhánh mặc định. */
  it('chưa chọn Loại thông tin vẫn lưu được, không còn lỗi "Loại đơn thư là bắt buộc"', async () => {
    await renderForm();

    fireEvent.change(await screen.findByTestId('field-senderName'), { target: { value: 'UAT Sender' } });
    fireEvent.change(screen.getByTestId('field-senderAddress'), { target: { value: 'UAT addr' } });
    fireEvent.change(screen.getByTestId('field-detailContent'), { target: { value: 'detail' } });
    dienSdtNguyenDon('0901234567');
    fireEvent.change(screen.getByTestId('field-crimeChinhId'), { target: { value: 'crime-d173' } });

    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(screen.queryByText(/Loại đơn thư là bắt buộc/i)).not.toBeInTheDocument();
  });

  it('[T8/F2] "Lưu và xuất file" → lưu (bắt id) → mở popup xuất chứng từ, KHÔNG về danh sách', async () => {
    (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true, data: { id: 'new-pet-1' } },
    });
    await renderForm();
    fireEvent.change(await screen.findByTestId('field-senderName'), { target: { value: 'Sender' } });
    fireEvent.change(screen.getByTestId('field-senderAddress'), { target: { value: 'addr' } });
    fireEvent.change(screen.getByTestId('field-detailContent'), { target: { value: 'detail' } });
    fireEvent.change(screen.getByTestId('field-priority'), { target: { value: 'Cao' } });
    dienSdtNguyenDon('0901234567');
    fireEvent.change(screen.getByTestId('field-crimeChinhId'), { target: { value: 'crime-d173' } });

    // Mở menu split-button (nút trên) → "Lưu và xuất file".
    fireEvent.click(screen.getByTestId('btn-save-top-caret'));
    fireEvent.click(screen.getByTestId('btn-save-top-item-export'));

    // Popup "Xuất chứng từ" ĐỘNG hiện; KHÔNG điều hướng về danh sách (route /petitions render "list").
    await waitFor(() => {
      expect(screen.getByTestId('dynamic-export-modal')).toBeInTheDocument();
    });
    expect(api.post).toHaveBeenCalledWith('/petitions', expect.anything());
    expect(screen.queryByText('list')).not.toBeInTheDocument();
  });
});

describe('PetitionFormPage — YC1/2/6 (đơn vị + thẩm quyền + auto-fill ngày)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authStore.setProfile(SAMPLE_PROFILE);
  });
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  async function fillRequired() {
    fireEvent.change(await screen.findByTestId('field-senderName'), { target: { value: 'Người gửi' } });
    fireEvent.change(screen.getByTestId('field-senderAddress'), { target: { value: 'Địa chỉ' } });
    fireEvent.change(screen.getByTestId('field-detailContent'), { target: { value: 'Nội dung đầy đủ của đơn thư' } });
    dienSdtNguyenDon('0901234567');
    fireEvent.change(screen.getByTestId('field-crimeChinhId'), { target: { value: 'crime-d173' } });
  }

  it('YC1: đổi Ngày tiếp nhận → tự điền Ngày tiếp nhận nguồn tin & Ngày đề xuất khi đang trống', async () => {
    await renderForm();
    const rec = await screen.findByTestId('field-receivedDate') as HTMLInputElement;
    fireEvent.change(rec, { target: { value: '2026-03-15' } });
    expect((screen.getByTestId('field-ngayTiepNhanNguonTin') as HTMLInputElement).value).toBe('2026-03-15');
    expect((screen.getByTestId('field-ngayDeXuat') as HTMLInputElement).value).toBe('2026-03-15');
  });

  it('YC1: chấp nhận ngày mặc định (không sửa) → payload vẫn có ngayTiepNhanNguonTin & ngayDeXuat = today', async () => {
    await renderForm();
    await fillRequired(); // KHÔNG chạm field-receivedDate (giữ default today)
    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, body] = (api.post as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(body.ngayTiepNhanNguonTin).toBe(today());
    expect(body.ngayDeXuat).toBe(today());
  });

  it('YC1: KHÔNG ghi đè Ngày đề xuất nếu đã nhập tay', async () => {
    await renderForm();
    fireEvent.change(await screen.findByTestId('field-ngayDeXuat'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByTestId('field-receivedDate'), { target: { value: '2026-03-15' } });
    expect((screen.getByTestId('field-ngayDeXuat') as HTMLInputElement).value).toBe('2026-01-01');
    // ô còn trống thì vẫn được điền
    expect((screen.getByTestId('field-ngayTiepNhanNguonTin') as HTMLInputElement).value).toBe('2026-03-15');
  });

  /**
   * MỐC ĐÚNG ĐÃ ĐỔI 26/08/2026 — form Đơn thư nay dựng theo bố cục hệ cũ, và hệ cũ gọi ô này
   * là "Tóm tắt nội dung". Nhãn ấy PHẢI có, đó đúng là điều anh yêu cầu: cán bộ đang dùng hệ
   * cũ mở tab ra là thấy đúng chữ họ quen.
   *
   * Phần vẫn giữ nguyên: KHÔNG có ô `summary` riêng — tóm tắt suy ra từ Nội dung lúc lưu.
   */
  it('bố cục hệ cũ: có ô "Tóm tắt nội dung", không có ô summary riêng', async () => {
    await renderForm();
    await screen.findByTestId('field-detailContent');
    expect(screen.queryByTestId('field-summary')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Tóm tắt nội dung/i).length).toBeGreaterThan(0);
  });

  it('YC2: summary payload tự lấy từ Nội dung (cắt 300)', async () => {
    await renderForm();
    await fillRequired();
    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, body] = (api.post as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(body.summary).toBe('Nội dung đầy đủ của đơn thư');
  });

  /**
   * Ô tích "Thuộc thẩm quyền" đã được THAY bằng ba lựa chọn hướng xử lý (09/09/2026).
   * Cột `thuocThamQuyen` vẫn còn và vẫn được gửi, nhưng máy chủ suy nó từ `huongXuLy`.
   */
  it('chưa chọn hướng → payload gửi huongXuLy null, giữ thuocThamQuyen mặc định', async () => {
    await renderForm();
    await fillRequired();
    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, body] = (api.post as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(body.huongXuLy).toBeNull();
    expect(body.thuocThamQuyen).toBe(true);
  });

  it('chọn Chuyển đơn → payload gửi huongXuLy=CHUYEN_DON', async () => {
    await renderForm();
    await fillRequired();
    fireEvent.click(await screen.findByTestId('field-huongXuLy-CHUYEN_DON'));
    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, body] = (api.post as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(body.huongXuLy).toBe('CHUYEN_DON');
  });

  /**
   * Đổi hướng phải XOÁ đơn vị đã chọn: danh sách tổ nội bộ và danh mục đơn vị ngoài là hai tập
   * khác nhau, giữ lại sẽ gửi lên một giá trị không có trong nguồn mới — và không ai thấy sai
   * cho tới khi in ra.
   */
  it('đổi hướng → xoá đơn vị xử lý đã chọn', async () => {
    await renderForm();
    await fillRequired();
    fireEvent.click(await screen.findByTestId('field-huongXuLy-GIAO_DON'));
    const o = await screen.findByTestId('field-donViGiaiQuyet');
    fireEvent.change(o, { target: { value: 'Tổ 5' } });
    fireEvent.click(await screen.findByTestId('field-huongXuLy-CHUYEN_DON'));
    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, body] = (api.post as ReturnType<typeof vi.fn>).mock.calls[0];
    // MỘT cột duy nhất từ 10/09/2026; `donViXuLy` không còn được gửi lên nữa.
    expect(body.donViGiaiQuyet).toBeNull();
    expect(body).not.toHaveProperty('donViXuLy');
  });
});
