import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';

Element.prototype.scrollIntoView = vi.fn();
const apiGet = vi.fn();
const apiPost = vi.fn((_duong: string, _than: unknown) =>
  Promise.resolve({ data: { success: true, data: { id: 'p1' } } }),
);
vi.mock('@/lib/api', () => ({
  api: {
    get: (duong: string, cauHinh?: unknown) => apiGet(duong, cauHinh),
    post: (duong: string, than: unknown) => apiPost(duong, than),
    put: vi.fn(),
  },
  authApi: { me: vi.fn() },
}));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-1', isDraft: true, templateId: 't' }) },
}));
vi.mock('@/features/_shared/modals/useQuickCreateDirectoryModal', () => ({
  useQuickCreateDirectoryModalSafe: () => ({ open: vi.fn() }),
}));
// `CrimeSelect` là ô tự dựng, `fireEvent.change` không đặt được giá trị — giả lập thành
// `<select>` gốc, cùng cách tệp payload đang làm.
vi.mock('@/components/CrimeSelect', () => ({
  CrimeSelect: ({ value, onChange, testId }: {
    value: string;
    onChange: (v: string) => void;
    testId?: string;
  }) => (
    <select data-testid={testId} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">--</option>
      <option value="crime-1">Điều 173</option>
    </select>
  ),
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
 * Yêu cầu 3 của anh: "Ngày viết đơn vì không phải lúc nào cũng có data đầy đủ nên cho phép
 * nhập thiếu thành phần (__/12/2026 hoặc __/__/2026)".
 */
describe('Form Đơn thư — Ngày viết đơn nhập thiếu', () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: { success: true, data: [] } });
    apiPost.mockClear();
    authStore.setProfile(TOI);
  });
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks(); });

  it('là BA Ô phân đoạn, không phải một ô ngày của trình duyệt', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-petitionDate-ngay')).toBeInTheDocument());
    expect(screen.getByTestId('field-petitionDate-thang')).toBeInTheDocument();
    expect(screen.getByTestId('field-petitionDate-nam')).toBeInTheDocument();
  });

  it('bỏ trống ô ngày → payload gửi EDTF thiếu ngày và KHÔNG bịa petitionDate', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-petitionDate-nam')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('field-petitionDate-thang'), { target: { value: '12' } });
    fireEvent.change(screen.getByTestId('field-petitionDate-nam'), { target: { value: '2026' } });

    fireEvent.change(screen.getByTestId('field-senderName'), { target: { value: 'Người gửi' } });
    fireEvent.change(screen.getByTestId('field-senderAddress'), { target: { value: 'Địa chỉ' } });
    fireEvent.change(screen.getByTestId('field-detailContent'), { target: { value: 'Nội dung' } });
    // Tội danh chính là ô BẮT BUỘC — thiếu nó thì form chặn và không có lượt gửi nào để soi.
    fireEvent.change(screen.getByTestId('field-crimeChinhId'), { target: { value: 'crime-1' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);

    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    const body = apiPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.ngayVietDonEdtf).toBe('2026-12-XX');
    // KHÔNG BAO GIỜ bịa ngày 01 — cột ngày thật phải trống.
    expect(body.petitionDate).toBeNull();
  });

  it('nhập ĐỦ → gửi cả cột ngày thật lẫn EDTF, lọc/sắp xếp/in không đổi', async () => {
    await moForm();
    await waitFor(() => expect(screen.getByTestId('field-petitionDate-nam')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('field-petitionDate-ngay'), { target: { value: '15' } });
    fireEvent.change(screen.getByTestId('field-petitionDate-thang'), { target: { value: '12' } });
    fireEvent.change(screen.getByTestId('field-petitionDate-nam'), { target: { value: '2026' } });

    fireEvent.change(screen.getByTestId('field-senderName'), { target: { value: 'Người gửi' } });
    fireEvent.change(screen.getByTestId('field-senderAddress'), { target: { value: 'Địa chỉ' } });
    fireEvent.change(screen.getByTestId('field-detailContent'), { target: { value: 'Nội dung' } });
    // Tội danh chính là ô BẮT BUỘC — thiếu nó thì form chặn và không có lượt gửi nào để soi.
    fireEvent.change(screen.getByTestId('field-crimeChinhId'), { target: { value: 'crime-1' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);

    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    const body = apiPost.mock.calls[0][1] as Record<string, unknown>;
    expect(body.ngayVietDonEdtf).toBe('2026-12-15');
    expect(body.petitionDate).toBe('2026-12-15');
  });
});
