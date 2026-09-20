import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { O_AN_KHOI_DON_THU } from '@/features/petitions/o-an.def';

Element.prototype.scrollIntoView = vi.fn();

const apiGet = vi.fn();
const apiPut = vi.fn((_duong: string, _than: Record<string, unknown>) =>
  Promise.resolve({ data: { success: true, data: { id: 'p1' } } }),
);
vi.mock('@/lib/api', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    put: (duong: string, than: Record<string, unknown>) => apiPut(duong, than),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: {
    draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-1', isDraft: true, templateId: 't' }),
  },
}));
vi.mock('@/features/_shared/modals/useQuickCreateDirectoryModal', () => ({
  useQuickCreateDirectoryModalSafe: () => ({ open: vi.fn() }),
}));

const TOI: AuthUser = {
  id: 'u1', email: 'a@b.c', username: 'a', firstName: 'A', lastName: 'B',
  role: 'ADMIN', canDispatch: true,
  teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }],
  primaryTeam: { teamId: 't1', teamName: 'Tổ 1' },
};

/** Giá trị thật kiểu dữ liệu di trú đang mang. */
const DANG_CO = {
  suspectedPerson: 'Nguyễn Văn A, sinh 1990',
  toiDanhBanDau: 'Trộm cắp tài sản',
  noiXayRa: 'Phường Bến Nghé, Quận 1',
};

const HO_SO = {
  id: 'p1',
  stt: '2026-11973',
  senderName: 'Người gửi',
  senderAddress: 'Địa chỉ',
  detailContent: 'Nội dung đơn',
  crimeChinhId: 'crime-1',
  status: 'PENDING',
  ...DANG_CO,
};

/**
 * CỔNG NGHIÊM TRỌNG NHẤT của đợt ẩn ô: mở hồ sơ CŨ rồi bấm Lưu mà KHÔNG sửa gì —
 * ba ô đã ẩn phải đi nguyên vẹn lên máy chủ.
 *
 * Ẩn ô mà thân lời gọi vẫn gửi rỗng đè lên thì 15.185 hồ sơ mất "Tội danh cũ trước đây",
 * 655 mất "Nghi vấn đối tượng", 141 mất "Nơi xảy ra tội phạm" — ngay lần cán bộ mở ra sửa
 * một ô khác rồi bấm Lưu. Không ai thấy, vì ô gây mất đã không còn trên màn hình.
 *
 * Anh chốt GIỮ NGUYÊN DỮ LIỆU. Mệnh đề này là chỗ duy nhất chứng minh điều đó, chứ không
 * phải suy từ việc đọc mã.
 */
describe('CỔNG: ẩn ô KHÔNG được làm mất dữ liệu của hồ sơ cũ', () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiGet.mockReset();
    apiPut.mockClear();
    apiGet.mockImplementation((duong: string) =>
      typeof duong === 'string' && duong.includes('/petitions/p1')
        ? Promise.resolve({ data: { success: true, data: HO_SO } })
        : Promise.resolve({ data: { success: true, data: [] } }),
    );
    authStore.setProfile(TOI);
  });
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

  it('mở hồ sơ cũ → KHÔNG sửa gì → Lưu: ba ô đã ẩn đi nguyên vẹn lên máy chủ', async () => {
    const { PetitionFormPage } = await import('../PetitionFormPage');
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/petitions/p1/edit']}>
          <Routes><Route path="/petitions/:id/edit" element={<PetitionFormPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect((screen.getByTestId('field-senderName') as HTMLInputElement).value).toBe('Người gửi'),
    );
    // Ba ô KHÔNG còn trên màn hình — nếu chúng vẫn hiện thì ca này chứng minh nhầm thứ khác.
    for (const o of O_AN_KHOI_DON_THU)
      expect(screen.queryByTestId(`legacy-field-${o}`)).not.toBeInTheDocument();

    // Ở chế độ SỬA nút mang nhãn "Cập nhật", không phải "Lưu đơn thư".
    fireEvent.click(screen.getAllByRole('button', { name: /Cập nhật/ })[0]);
    await waitFor(() => expect(apiPut).toHaveBeenCalled());

    const body = apiPut.mock.calls[0][1];
    const daGui = Object.fromEntries(
      Object.keys(DANG_CO).map((k) => [k, body[k]]),
    );
    expect(daGui, 'ẩn ô mà gửi rỗng đè lên là mất dữ liệu của 15.981 hồ sơ').toEqual(DANG_CO);
  });
});
