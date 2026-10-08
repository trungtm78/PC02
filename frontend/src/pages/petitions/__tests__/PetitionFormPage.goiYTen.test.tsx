/**
 * Ô "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại" của form Đơn thư gợi ý TỪNG ĐƠN kèm Tóm tắt nội dung
 * (anh yêu cầu 08/10/2026) — ca kiểm đi đúng đường người dùng đi: gõ tên → thấy các đơn đã có → chọn thì điền tên.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { api } from '@/lib/api';

const GOI_Y = [
  {
    id: 'p1',
    stt: '2026-01234',
    ten: 'Trần Thị A',
    ngayTiepNhan: '2026-03-12T00:00:00.000Z',
    tomTat: 'Tố giác chiếm đoạt số tiền 769.325.000 đồng thông qua việc vay mượn và tạo các dây hụi ảo.',
    trangThai: 'DANG_XU_LY',
    soDonCungTen: 29,
  },
  {
    id: 'p2',
    stt: '2025-08812',
    ten: 'Trần Thị A',
    ngayTiepNhan: '2025-11-02T00:00:00.000Z',
    tomTat: null,
    trangThai: 'DA_GIAI_QUYET',
    soDonCungTen: 29,
  },
];

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url === '/petitions/goi-y-don-theo-ten') return Promise.resolve({ data: GOI_Y });
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-00001', isDraft: true }) },
}));
vi.mock('@/components/FKSelect', () => ({
  FKSelect: ({ testId }: { testId?: string }) => <div data-testid={testId} />,
}));
vi.mock('@/components/CrimeSelect', () => ({
  CrimeSelect: ({ testId }: { testId?: string }) => <div data-testid={testId} />,
}));

const PROFILE: AuthUser = {
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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/petitions/new']}>
        <Routes>
          <Route path="/petitions/new" element={<PetitionFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const oTen = () => screen.getByTestId('field-senderName') as HTMLInputElement;

async function gonTen(chu = 'tran') {
  fireEvent.change(oTen(), { target: { value: chu } });
  await waitFor(() => expect(screen.getByTestId('field-senderName-goi-y')).toBeInTheDocument(), { timeout: 4000 });
}

describe('PetitionFormPage — gợi ý từng đơn theo tên người gửi', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authStore.setProfile(PROFILE);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('gõ tên → gọi endpoint MỚI (từng đơn), không còn gọi endpoint chỉ trả "tên + số lần"', async () => {
    await renderForm();
    await gonTen('tran');
    const urls = vi.mocked(api.get).mock.calls.map((c) => c[0]);
    expect(urls).toContain('/petitions/goi-y-don-theo-ten');
    expect(urls).not.toContain('/petitions/goi-y-ten-nguoi-gui');
    const goi = vi.mocked(api.get).mock.calls.find((c) => c[0] === '/petitions/goi-y-don-theo-ten');
    expect(goi?.[1]).toEqual({ params: { q: 'tran' } });
  });

  it('mỗi hàng là MỘT ĐƠN: STT, ngày tiếp nhận, trạng thái, số đơn cùng tên và Tóm tắt nội dung', async () => {
    await renderForm();
    await gonTen();
    const hang = screen.getByTestId('goi-y-don-p1');
    expect(hang).toHaveTextContent('Trần Thị A');
    expect(hang).toHaveTextContent('2026-01234');
    expect(hang).toHaveTextContent('12/03/2026');
    expect(hang).toHaveTextContent('Đang xử lý');
    expect(hang).toHaveTextContent('29 đơn cùng tên');
    expect(hang).toHaveTextContent('769.325.000 đồng');
    // Hai đơn cùng một tên → hai hàng, khoá theo mã đơn (không gộp, không đè nhau).
    expect(screen.getByTestId('goi-y-don-p2')).toHaveTextContent('2025-08812');
    expect(within(screen.getByTestId('field-senderName-goi-y')).getAllByRole('option')).toHaveLength(2);
  });

  it('bấm "Xem thêm" để đọc toàn bộ KHÔNG chọn gợi ý và KHÔNG làm đổi chữ đã gõ', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(90);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(18);
    await renderForm();
    await gonTen('tran');
    const xemThem = screen.getByRole('button', { name: /xem thêm/i });
    fireEvent.mouseDown(xemThem);
    fireEvent.click(xemThem);
    expect(oTen().value).toBe('tran');
    expect(screen.getByTestId('field-senderName-goi-y')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thu gọn/i })).toBeInTheDocument();
  });

  it('chọn một hàng → điền ĐÚNG tên của đơn đó vào ô và đóng danh sách', async () => {
    await renderForm();
    await gonTen('tran');
    fireEvent.mouseDown(screen.getByTestId('goi-y-don-p2'));
    expect(oTen().value).toBe('Trần Thị A');
    expect(screen.queryByTestId('field-senderName-goi-y')).not.toBeInTheDocument();
  });

  it('bàn phím: ↓ tô hàng đầu và hàng ấy TỰ BUNG tóm tắt; Enter điền tên', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(90);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(18);
    await renderForm();
    await gonTen('tran');
    expect(screen.getAllByTestId('goi-y-tom-tat')[0].className).toMatch(/line-clamp-1/);
    fireEvent.keyDown(oTen(), { key: 'ArrowDown' });
    expect(screen.getAllByTestId('goi-y-tom-tat')[0].className).not.toMatch(/line-clamp/);
    fireEvent.keyDown(oTen(), { key: 'Enter' });
    expect(oTen().value).toBe('Trần Thị A');
  });

  it('bàn phím: Ctrl+Enter trên hàng đang tô MỞ đơn ở tab mới (noopener), không điền tên vào ô', async () => {
    const moTab = vi.spyOn(window, 'open').mockImplementation(() => null);
    await renderForm();
    await gonTen('tran');
    fireEvent.keyDown(oTen(), { key: 'ArrowDown' });
    fireEvent.keyDown(oTen(), { key: 'ArrowDown' });
    fireEvent.keyDown(oTen(), { key: 'Enter', ctrlKey: true });
    expect(moTab).toHaveBeenCalledTimes(1);
    expect(moTab).toHaveBeenCalledWith('/petitions/p2', '_blank', 'noopener,noreferrer');
    expect(oTen().value).toBe('tran');
  });

  it('gợi ý hỏng (mạng/403) không chặn nhập liệu: ô vẫn gõ được, không có danh sách', async () => {
    vi.mocked(api.get).mockImplementation(((url: string) => {
      if (url === '/petitions/goi-y-don-theo-ten') return Promise.reject(new Error('mạng hỏng'));
      return Promise.resolve({ data: { success: true, data: [] } });
    }) as never);
    await renderForm();
    fireEvent.change(oTen(), { target: { value: 'Nguyễn Văn B' } });
    await new Promise((r) => setTimeout(r, 600));
    expect(oTen().value).toBe('Nguyễn Văn B');
    expect(screen.queryByTestId('field-senderName-goi-y')).not.toBeInTheDocument();
  });
});
