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
const moPopup = vi.hoisted(() => vi.fn());
vi.mock('@/features/_shared/modals/useQuickCreateDirectoryModal', () => ({
  useQuickCreateDirectoryModalSafe: () => ({ open: moPopup }),
}));

const TOI: AuthUser = {
  id: 'u1', email: 'a@b.c', username: 'a', firstName: 'A', lastName: 'B',
  role: 'OFFICER', canDispatch: false,
  teams: [{ teamId: 't1', teamName: 'Tổ 1', isLeader: false }],
  primaryTeam: { teamId: 't1', teamName: 'Tổ 1' },
};

const NGUON = [
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

const chonNguon = (ten: string) => {
  fireEvent.click(screen.getByTestId('field-nguonDon-trigger'));
  fireEvent.click(screen.getByTestId(`field-nguonDon-option-${ten}`));
};

/**
 * Yêu cầu 2 của anh: gom Số CCCD, Ngày cấp, Nơi cấp, SĐT nguyên đơn vào một nhóm thu nhỏ;
 * bung ra khi Nguồn đơn là Trực tiếp, thu lại khi không phải — để cán bộ khỏi phải Tab qua.
 */
describe('Form Đơn thư — nhóm thông tin định danh nguyên đơn', () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiGet.mockReset();
    apiGet.mockImplementation((duong: string) =>
      typeof duong === 'string' && duong.startsWith('/directories')
        ? Promise.resolve({ data: { data: NGUON } })
        : Promise.resolve({ data: { success: true, data: [] } }),
    );
    authStore.setProfile(TOI);
  });
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

  it('có nhóm định danh và nó THU GỌN sẵn khi chưa chọn nguồn', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('nhom-dinh-danh-nguyen-don')).toBeInTheDocument());
    expect(screen.queryByTestId('field-senderIdNumber')).not.toBeInTheDocument();
  });

  it('chọn Nguồn đơn = "Trực tiếp" thì nhóm TỰ BUNG', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());
    chonNguon('Trực tiếp');
    await waitFor(() => expect(screen.getByTestId('field-senderIdNumber')).toBeInTheDocument());
  });

  it('chọn "Bưu điện" thì nhóm THU lại — khỏi Tab qua bốn ô không có dữ liệu', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-nguonDon-trigger')).toBeInTheDocument());
    chonNguon('Trực tiếp');
    await waitFor(() => expect(screen.getByTestId('field-senderIdNumber')).toBeInTheDocument());
    chonNguon('Bưu điện');
    await waitFor(() => expect(screen.queryByTestId('field-senderIdNumber')).not.toBeInTheDocument());
  });

  it('nhóm gồm đủ bốn ô anh nêu + "Sinh năm"', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('nhom-dinh-danh-nguyen-don-nut')).toBeInTheDocument());
    expect(screen.getByTestId('nhom-dinh-danh-nguyen-don-nut').textContent).toContain('5 ô');
  });

  it('tiêu đề đánh dấu * — trong nhóm có ô bắt buộc (SĐT khi nộp trực tiếp)', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('nhom-dinh-danh-nguyen-don-nut')).toBeInTheDocument());
    expect(screen.getByTestId('nhom-dinh-danh-nguyen-don-nut').textContent).toContain('*');
  });
});
