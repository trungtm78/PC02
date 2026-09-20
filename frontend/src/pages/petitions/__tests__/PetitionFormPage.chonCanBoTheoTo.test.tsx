import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';

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
    draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-00001', isDraft: true, templateId: 't' }),
  },
}));

const TOI: AuthUser = {
  id: 'u-toi',
  email: 'toi@pc02.local',
  username: 'toi',
  firstName: 'Tôi',
  lastName: 'Người Dùng',
  role: 'OFFICER',
  canDispatch: false,
  teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }],
  primaryTeam: { teamId: 't1', teamName: 'Tổ 1' },
};

const CAN_BO = [
  { id: 'u-toi', lastName: 'Người Dùng', firstName: 'Tôi', teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }] },
  { id: 'a', lastName: 'Nguyễn Văn', firstName: 'A', teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }] },
  { id: 'e', lastName: 'Nguyễn Văn', firstName: 'E', teams: [{ teamId: 't2', teamName: 'Tổ 2', isLeader: false }] },
];

async function moForm() {
  const { PetitionFormPage } = await import('../PetitionFormPage');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/petitions/new']}>
        <Routes>
          <Route path="/petitions/new" element={<PetitionFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * Anh nêu: chọn cán bộ trên form rất tốn thời gian vì là danh sách phẳng 245 người, không gõ
 * tìm được. Yêu cầu: ô tìm được, gom nhóm theo Tổ, gõ tên người thì lọc trong nhóm, gõ tên tổ
 * thì ra cả nhóm.
 */
describe('Form Đơn thư — ô chọn cán bộ gom nhóm theo Tổ', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    apiGet.mockReset();
    apiGet.mockImplementation((duong: string) => {
      if (duong === '/admin/users') return Promise.resolve({ data: { data: CAN_BO, total: CAN_BO.length } });
      return Promise.resolve({ data: { success: true, data: [] } });
    });
    authStore.setProfile(TOI);
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('ô "Cán bộ đề xuất" là ô TÌM ĐƯỢC, không phải danh sách phẳng', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-canBoDeXuatId-trigger')).toBeInTheDocument());
  });

  it('mở ra thấy nhóm theo Tổ; gõ "Tổ 2" ra cả nhóm Tổ 2', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-canBoDeXuatId-trigger')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('field-canBoDeXuatId-trigger'));

    const ds = await screen.findByRole('listbox');
    expect(within(ds).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual([
      'Tổ 1', 'Tổ 2',
    ]);

    fireEvent.change(screen.getByTestId('field-canBoDeXuatId-search'), { target: { value: 'Tổ 2' } });
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent?.trim()))
      .toEqual(['Nguyễn Văn E']);
  });

  /**
   * Yêu cầu 4 của anh. Mã gán mặc định đã có từ trước (`useFormDefaults().userId`) và vẫn đúng;
   * chỗ hỏng nằm ở DANH SÁCH.
   *
   * NGUYÊN NHÂN GỐC: ô cũ là `<select>` đổ từ `/admin/users?limit=200` sắp theo `createdAt desc`.
   * Prod có 245 tài khoản đang hoạt động, nên cán bộ nào có tài khoản CŨ (nằm ngoài 200 người
   * mới nhất) thì chính tên mình không nằm trong danh sách — `<select>` không có `<option>` nào
   * khớp `value` nên hiện TRẮNG, dù `formData.canBoDeXuatId` đã đúng. Sửa ở lời gọi, không phải
   * ở chỗ gán mặc định.
   */
  it('tạo mới → "Cán bộ đề xuất" có sẵn người đang đăng nhập', async () => {
    await moForm();
    await waitFor(() =>
      expect(screen.getByTestId('field-canBoDeXuatId-trigger').textContent).toContain('Người Dùng Tôi'),
    );
  });

  it('hồ sơ đăng nhập về MUỘN thì vẫn điền được', async () => {
    sessionStorage.removeItem('authProfile');
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-canBoDeXuatId-trigger')).toBeInTheDocument());
    authStore.setProfile(TOI);
    await waitFor(() =>
      expect(screen.getByTestId('field-canBoDeXuatId-trigger').textContent).toContain('Người Dùng Tôi'),
    );
  });
});
