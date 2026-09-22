import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { today } from '@/lib/dates';
import { DungLaiTheoId } from '@/lib/features/dungLaiTheoId';

Element.prototype.scrollIntoView = vi.fn();

const apiGet = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: {
    draft: vi.fn().mockResolvedValue({ previewNumber: '2026-99999', isDraft: true, templateId: 't' }),
  },
}));
vi.mock('@/features/_shared/modals/useQuickCreateDirectoryModal', () => ({
  useQuickCreateDirectoryModalSafe: () => ({ open: vi.fn() }),
}));

/** Soi history state của route hiện tại — thứ giữ "mầm chép". */
function SoiMamChep({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  return (
    <>
      <span data-testid="mam-chep">{loc.state ? 'CO' : 'KHONG'}</span>
      {children}
    </>
  );
}

const TOI: AuthUser = {
  id: 'u1', email: 'a@b.c', username: 'a', firstName: 'A', lastName: 'B',
  role: 'ADMIN', canDispatch: true,
  teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }],
  primaryTeam: { teamId: 't1', teamName: 'Tổ 1' },
};

/** Hồ sơ DI TRÚ thật: mã cũ, hạn đã qua, đã có kết quả xử lý. */
const HO_SO = {
  id: 'p1',
  stt: '2024-00123',
  receivedDate: '2024-01-05',
  ngayDeXuat: '2024-01-06',
  deadline: '2024-03-05',
  senderName: 'Nguyễn Văn A',
  senderAddress: 'Phường Bến Nghé, Quận 1',
  senderIdNumber: '079000000001',
  detailContent: 'Nội dung tố giác cần chép sang đơn mới',
  toiDanhBanDau: 'Trộm cắp tài sản',
  ketQuaXuLyKhac: 'Đã chuyển Công an phường xử lý',
  donViGiaiQuyet: 'Đội 2',
  status: 'PENDING',
};

/**
 * Anh yêu cầu 22/09/2026: ở chế độ sửa, cho tạo đơn mới bằng cách chép đơn đang xem.
 *
 * Cổng đơn vị `chepSangDonMoi.gate.test.ts` chứng minh phép phân loại. Ca này chứng minh thứ
 * khác, và là thứ duy nhất chạm tới: nút có thật, bấm được, và màn TẠO MỚI nhận đúng dữ liệu —
 * chứ không phải một hàm thuần đúng mà chẳng ai gọi.
 */
describe('Chép đơn: bấm nút ở màn SỬA → sang màn TẠO MỚI', () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiGet.mockReset();
    apiGet.mockImplementation((duong: string) =>
      typeof duong === 'string' && duong.includes('/petitions/p1')
        ? Promise.resolve({ data: { success: true, data: HO_SO } })
        : Promise.resolve({ data: { success: true, data: [] } }),
    );
    authStore.setProfile(TOI);
  });
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

  it('chép nội dung, đặt lại mã hồ sơ / ngày tháng / kết quả xử lý', async () => {
    const { PetitionFormPage } = await import('../PetitionFormPage');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/petitions/p1/edit']}>
          <Routes>
            {/*
              Bọc <DungLaiTheoId> ĐÚNG như `features/petitions/routes.tsx` — hai route cùng
              dựng một loại component, nên không bọc thì React dùng lại state và màn tạo mới
              mang nguyên mã hồ sơ của đơn cũ. Cổng `dungLaiTheoId.test.tsx` canh cho routes.tsx
              không tụt lại; ca này đo HÀNH VI khi đã bọc.
            */}
            <Route path="/petitions/:id/edit" element={<SoiMamChep><DungLaiTheoId><PetitionFormPage /></DungLaiTheoId></SoiMamChep>} />
            <Route path="/petitions/new" element={<SoiMamChep><DungLaiTheoId><PetitionFormPage /></DungLaiTheoId></SoiMamChep>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Nguyễn Văn A'),
    );

    fireEvent.click(screen.getByTestId('btn-chep-don'));

    // Đã sang màn TẠO MỚI: nút lưu đổi nhãn.
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Lưu đơn thư/ }).length).toBeGreaterThan(0),
    );

    const o = (t: string) => (screen.getByTestId(`field-${t}`) as HTMLInputElement).value;

    // Nội dung — chép.
    expect(o('senderName')).toBe('Nguyễn Văn A');
    expect(o('senderAddress')).toBe('Phường Bến Nghé, Quận 1');
    expect(o('senderIdNumber')).toBe('079000000001');
    expect(o('detailContent')).toBe('Nội dung tố giác cần chép sang đơn mới');

    // Mốc hồ sơ — đặt lại.
    // Mã hồ sơ cũ KHÔNG được còn ở bất cứ đâu trên màn tạo mới — hai đơn cùng một mã.
    // Mã hồ sơ cũ KHÔNG được còn ở bất cứ đâu trên màn tạo mới — hai đơn sẽ cùng một mã.
    expect(document.body.textContent).not.toContain('2024-00123');
    expect(
      document.body.textContent,
      'kết quả xử lý của đơn cũ theo sang đơn mới',
    ).not.toContain('Đã chuyển Công an phường xử lý');
    expect(o('receivedDate')).toBe(today());
    expect(o('ngayDeXuat'), 'giữ ngày đề xuất cũ thì đơn mới rơi khỏi bộ lọc theo kỳ').toBe(today());
    expect(o('deadline'), 'chép hạn cũ là đơn mới quá hạn từ lúc sinh ra').toBe('');

    // Nút chép KHÔNG hiện ở màn tạo mới — chưa có đơn nào để chép.
    expect(screen.queryByTestId('btn-chep-don')).not.toBeInTheDocument();
  }, 25_000);

});
