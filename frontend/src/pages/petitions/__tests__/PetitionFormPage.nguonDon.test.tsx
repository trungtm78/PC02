import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

// Ô chỉ mời "Tạo mới" khi có popup tạo nhanh (`canCreate={!!taoNhanh}`) — đúng điều kiện của
// ô "Loại thông tin". Không có provider thì nút không hiện, và đó là hành vi ĐÚNG.
const moPopupTaoNhanh = vi.hoisted(() => vi.fn());
vi.mock('@/features/_shared/modals/useQuickCreateDirectoryModal', () => ({
  useQuickCreateDirectoryModalSafe: () => ({ open: moPopupTaoNhanh }),
}));

vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: {
    draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-00001', isDraft: true, templateId: 't' }),
  },
}));

const TOI: AuthUser = {
  id: 'u1', email: 'a@b.c', username: 'a', firstName: 'A', lastName: 'B',
  role: 'OFFICER', canDispatch: false,
  teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }],
  primaryTeam: { teamId: 't1', teamName: 'Tổ 1' },
};

const NGUON_DON = [
  { id: 'n1', name: 'Bưu điện', code: 'ND0001' },
  { id: 'n2', name: 'Trực tiếp', code: 'ND0002' },
];

async function moForm() {
  const { PetitionFormPage } = await import('../PetitionFormPage');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/petitions/new']}>
        <Routes><Route path="/petitions/new" element={<PetitionFormPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * Anh nêu: "Nguồn đơn/Đơn vị giao" đang là ô CHỮ, đổi sang control như "Loại thông tin" —
 * tìm được và tạo mới được, dữ liệu ban đầu lấy từ dữ liệu cũ, gộp bản trùng.
 *
 * Đo trên bản chạy thật 20/09/2026: 1.431 cách viết cho cùng vài chục nguồn, vì hệ cũ để ô
 * chữ tự do. Ô chọn từ danh mục là thứ chặn con số ấy phình tiếp.
 */
describe('Form Đơn thư — ô "Nguồn đơn/Đơn vị giao" chọn từ danh mục', () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiGet.mockReset();
    apiGet.mockImplementation((duong: string) => {
      if (typeof duong === 'string' && duong.startsWith('/directories')) {
        return Promise.resolve({ data: { data: NGUON_DON } });
      }
      if (duong === '/admin/users') return Promise.resolve({ data: { data: [], total: 0 } });
      return Promise.resolve({ data: { success: true, data: [] } });
    });
    authStore.setProfile(TOI);
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('là ô TÌM ĐƯỢC, không phải ô chữ trần', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());
  });

  it('hỏi đúng danh mục NGUON_DON', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('field-nguonDon-trigger'));
    await waitFor(() => {
      const hoi = apiGet.mock.calls.map((c) => String(c[0])).filter((d) => d.startsWith('/directories'));
      expect(hoi.some((d) => d.includes('type=NGUON_DON'))).toBe(true);
    });
  });

  it('mời TẠO MỚI khi gõ nguồn chưa có — đúng khuôn "Loại thông tin"', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('field-nguonDon-trigger'));
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-create-new')).toBeInTheDocument());
  });
});
