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
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: {
    draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-1', isDraft: true, templateId: 't' }),
  },
}));

const TOI: AuthUser = {
  id: 'u1', email: 'a@b.c', username: 'a', firstName: 'A', lastName: 'B',
  role: 'OFFICER', canDispatch: false,
  teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }],
  primaryTeam: { teamId: 't1', teamName: 'Tổ 1' },
};

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
 * Yêu cầu 5 của anh: "Điều tra viên thụ lý, Lãnh đạo phụ trách tố tụng cho vào group
 * 'thông tin khác', thu nhỏ vì rất ít khi nhập; khi nhập user sẽ bung ra".
 */
describe('Form Đơn thư — nhóm "Thông tin khác"', () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: { success: true, data: [] } });
    authStore.setProfile(TOI);
  });
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

  it('có nhóm "Thông tin khác", và nó THU GỌN sẵn', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('nhom-thong-tin-khac')).toBeInTheDocument());
    // Hai ô này rất ít khi nhập — để mở sẵn là bắt cán bộ cuộn và Tab qua mỗi lần nhập đơn.
    expect(screen.queryByTestId('field-dieuTraVien')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-lanhDaoToTung')).not.toBeInTheDocument();
  });

  it('bấm vào là bung ra để nhập', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('nhom-thong-tin-khac-nut')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('nhom-thong-tin-khac-nut'));
    expect(screen.getByTestId('field-dieuTraVien')).toBeInTheDocument();
    expect(screen.getByTestId('field-lanhDaoToTung')).toBeInTheDocument();
  });

  it('tiêu đề nói rõ trong nhóm có 2 ô', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('nhom-thong-tin-khac-nut')).toBeInTheDocument());
    expect(screen.getByTestId('nhom-thong-tin-khac-nut').textContent).toContain('2 ô');
  });
});
