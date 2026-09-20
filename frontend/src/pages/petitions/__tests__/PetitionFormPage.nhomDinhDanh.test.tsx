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

  it('nhóm gồm ba ô CCCD + "Sinh năm" — SĐT đã ra ngoài', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('nhom-dinh-danh-nguyen-don-nut')).toBeInTheDocument());
    expect(screen.getByTestId('nhom-dinh-danh-nguyen-don-nut').textContent).toContain('4 ô');
  });

  /*
    Tiêu đề KHÔNG còn dấu `*`, và đó là điều ĐÚNG: dấu ấy nghĩa là "trong đây có ô có thể chặn
    Lưu". Sau 20/09/2026 "Số điện thoại nguyên đơn" ra ngoài nhóm theo yêu cầu của anh, nên
    trong nhóm không còn ô bắt buộc nào — để dấu `*` lại là nói dối cán bộ rằng mở ra mới lưu
    được. Cổng `features/petitions/__tests__/oBatBuocKhongTrongNhom.gate.test.ts` giữ cho
    trạng thái ấy không đảo ngược.
  */
  it('tiêu đề KHÔNG còn dấu * — trong nhóm không còn ô bắt buộc nào', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('nhom-dinh-danh-nguyen-don-nut')).toBeInTheDocument());
    expect(screen.getByTestId('nhom-dinh-danh-nguyen-don-nut').textContent).not.toContain('*');
  });

  /*
    SĐT phải NHÌN THẤY NGAY, không phụ thuộc nhóm có mở hay không — đó chính là điều anh yêu cầu
    và cũng là lưới an toàn: nó là ô bắt buộc có điều kiện, để trong khối gập là mời lại lỗi #248.
  */
  it('ô SĐT nhìn thấy ngay khi mở form, và KHÔNG nằm trong nhóm', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-senderPhone')).toBeInTheDocument());
    const nhom = screen.getByTestId('nhom-dinh-danh-nguyen-don');
    expect(
      nhom.contains(screen.getByTestId('field-senderPhone')),
      'SĐT nằm trong nhóm gập là chặn Lưu bằng ô có thể bị giấu',
    ).toBe(false);
  });
});
