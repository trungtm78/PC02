/**
 * Đường ĐẦY ĐỦ: chi tiết trả về từ máy chủ → cờ "hồ sơ di trú" → phép kiểm trên form.
 *
 * Ca kiểm ở tầng hàm thuần chỉ chứng minh nhánh rẽ đúng khi ĐƯỢC TRUYỀN cờ đúng. Nó không
 * chứng minh cờ ấy được tính đúng từ dữ liệu máy chủ trả về — mà đó mới là chỗ hỏng: 161 hồ sơ
 * di trú là VỎ LIÊN KẾT, bản thô nằm ở thực thể anh em nên `legacyRaw` của chính nó để trống.
 * Tính cờ theo `legacyRaw` thì đúng nhóm ấy vẫn bị chặn Lưu.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: {} } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));

vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: {
    draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-00001', isDraft: true, templateId: 't' }),
  },
}));

vi.mock('@/components/FKSelect', () => ({
  FKSelect: ({ value, onChange, testId }: { value: string; onChange: (v: string) => void; testId?: string }) => (
    <select data-testid={testId} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">--</option>
    </select>
  ),
}));

vi.mock('@/components/CrimeSelect', () => ({
  CrimeSelect: ({ value, onChange, testId }: { value: string; onChange: (v: string) => void; testId?: string }) => (
    <select data-testid={testId} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">--</option>
      <option value="crime-d173">Điều 173</option>
    </select>
  ),
}));

const NGUOI_DUNG: AuthUser = {
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

/** Hồ sơ như máy chủ trả về: đủ ô bắt buộc, TRỐNG `petitionType`, và không có `legacyRaw`. */
const HO_SO = (them: Record<string, unknown>) => ({
  id: 'p1',
  stt: '2026-1',
  receivedDate: '2026-08-01T00:00:00.000Z',
  senderName: 'Nguyễn Văn A',
  senderAddress: '12 Lê Lợi',
  senderPhone: '0912345678',
  detailContent: 'Nội dung đơn di trú',
  crimeChinhId: 'crime-d173',
  petitionType: null,
  status: 'MOI_TIEP_NHAN',
  ...them,
});

function napChiTiet(d: Record<string, unknown>) {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/petitions/p1') return Promise.resolve({ data: { success: true, data: d } } as never);
    return Promise.resolve({ data: { success: true, data: [] } } as never);
  });
}

async function moManSua() {
  const { PetitionFormPage } = await import('../PetitionFormPage');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/petitions/p1/edit']}>
        <Routes>
          <Route path="/petitions/:id/edit" element={<PetitionFormPage />} />
          <Route path="/petitions" element={<div>danh sách</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function bamLuu() {
  const nut = (await screen.findAllByRole('button')).filter((b) => b.textContent?.trim() === 'Cập nhật');
  fireEvent.click(nut[nut.length - 1]);
}

describe('Hồ sơ di trú lưu được mà không phải chọn loại đơn', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authStore.setProfile(NGUOI_DUNG);
  });
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  /** Nhóm 161 hồ sơ vỏ liên kết: có `legacySourceId`, KHÔNG có `legacyRaw`. */
  it('hồ sơ chỉ có legacySourceId (bản thô ở thực thể anh em) vẫn lưu được', async () => {
    napChiTiet(HO_SO({ legacySourceId: 'ho_so_doi_1:9', legacyRaw: null }));
    await moManSua();
    await screen.findByDisplayValue('Nguyễn Văn A');
    await bamLuu();
    await waitFor(() => expect(api.put).toHaveBeenCalled());
    expect(screen.queryByText(/Loại đơn thư là bắt buộc/)).toBeNull();
  });

  it('hồ sơ có legacyRaw cũng lưu được', async () => {
    napChiTiet(HO_SO({ legacySourceId: 'ho_so_doi_1:9', legacyRaw: { stt: '11170' } }));
    await moManSua();
    await screen.findByDisplayValue('Nguyễn Văn A');
    await bamLuu();
    await waitFor(() => expect(api.put).toHaveBeenCalled());
  });

  /** Đơn của hệ mới: không có dấu vết hệ cũ nào thì vẫn phải chọn loại đơn. */
  it('đơn tạo trên hệ mới vẫn bị chặn khi thiếu loại đơn', async () => {
    napChiTiet(HO_SO({ legacySourceId: null, legacyRaw: null }));
    await moManSua();
    await screen.findByDisplayValue('Nguyễn Văn A');
    await bamLuu();
    expect(await screen.findByText(/Loại đơn thư là bắt buộc/)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });
});
