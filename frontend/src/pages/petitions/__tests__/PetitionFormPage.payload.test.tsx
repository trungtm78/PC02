/**
 * v0.37.2.4 — Regression test for P0 bug found during user UAT 2026-05-23.
 *
 * Bug: PetitionFormPage submitted Vietnamese name "Tố cáo" as petitionType
 * (because FKSelect with directoryType="PETITION_TYPE" returns Directory.name)
 * but backend DTO `@IsEnum(LoaiDon)` requires enum value "TO_CAO" → 100%
 * submissions returned 400 with error "petitionType phải là TO_CAO,
 * KHIEU_NAI, KIEN_NGHI hoặc PHAN_ANH".
 *
 * Fix: dùng native <select> với hardcoded enum options (LOAI_DON_OPTIONS from
 * shared/enums/status-labels.ts). value=enum, label=Vietnamese.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

// v0.42: stt is now auto-generated via DocNumberPreviewField — mock the draft call.
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: {
    draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-00001', isDraft: true, templateId: 'tmpl-2' }),
  },
}));

// Mock FKSelect (custom button-based combobox) as plain native <select> so that
// fireEvent.change works in tests. petitionType is now a native <select> in
// production code, but priority + unit still use FKSelect — mocking unifies them.
vi.mock('@/components/FKSelect', () => ({
  FKSelect: ({ value, onChange, testId }: {
    value: string;
    onChange: (v: string) => void;
    testId?: string;
  }) => (
    <select
      data-testid={testId}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">--</option>
      <option value="Cao">Cao</option>
      <option value="Trung bình">Trung bình</option>
      <option value="Thấp">Thấp</option>
    </select>
  ),
}));

// CrimeSelect (master Tội danh) — mock như native select để fireEvent.change được.
vi.mock('@/components/CrimeSelect', () => ({
  CrimeSelect: ({ value, onChange, testId }: {
    value: string;
    onChange: (v: string) => void;
    testId?: string;
  }) => (
    <select data-testid={testId} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">--</option>
      <option value="crime-d173">Điều 173 · Tội trộm cắp tài sản</option>
    </select>
  ),
}));

const SAMPLE_PROFILE: AuthUser = {
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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/petitions/new']}>
        <Routes>
          <Route path="/petitions/new" element={<PetitionFormPage />} />
          <Route path="/petitions" element={<div>list</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PetitionFormPage — petitionType payload (v0.37.2.4 P0 fix)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authStore.setProfile(SAMPLE_PROFILE);
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('submits petitionType as enum value (TO_CAO), not Vietnamese name', async () => {
    await renderForm();

    // v0.42: stt is now auto-generated (readonly DocNumberPreviewField), no manual fill needed.
    fireEvent.change(await screen.findByTestId('field-senderName'), { target: { value: 'UAT Test Sender' } });
    fireEvent.change(screen.getByTestId('field-senderAddress'), { target: { value: 'UAT address' } });
    fireEvent.change(screen.getByTestId('field-summary'), { target: { value: 'UAT summary' } });
    fireEvent.change(screen.getByTestId('field-detailContent'), { target: { value: 'UAT detail' } });
    fireEvent.change(screen.getByTestId('field-petitionType'), { target: { value: 'TO_CAO' } });
    fireEvent.change(screen.getByTestId('field-priority'), { target: { value: 'Cao' } });
    // Required-on-create mới: SĐT nguyên đơn + Tội danh chính
    fireEvent.change(screen.getByTestId('field-senderPhone'), { target: { value: '0901234567' } });
    fireEvent.change(screen.getByTestId('field-crimeChinhId'), { target: { value: 'crime-d173' } });

    const submitBtns = screen.getAllByRole('button', { name: /Lưu đơn thư/ });
    fireEvent.click(submitBtns[0]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalled();
    });

    const [url, body] = (api.post as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/petitions');
    expect(body.petitionType).toBe('TO_CAO');
    expect(body.petitionType).not.toBe('Tố cáo');
  });

  it('exposes all 4 LoaiDon enum values as <option> with Vietnamese labels', async () => {
    await renderForm();
    const select = await screen.findByTestId('field-petitionType') as HTMLSelectElement;
    const optionValues = Array.from(select.options).map((o) => o.value);
    const optionLabels = Array.from(select.options).map((o) => o.textContent);

    expect(optionValues).toContain('TO_CAO');
    expect(optionValues).toContain('KHIEU_NAI');
    expect(optionValues).toContain('KIEN_NGHI');
    expect(optionValues).toContain('PHAN_ANH');

    expect(optionLabels.join(' | ')).toContain('Tố cáo');
    expect(optionLabels.join(' | ')).toContain('Khiếu nại');
    expect(optionLabels.join(' | ')).toContain('Kiến nghị');
    expect(optionLabels.join(' | ')).toContain('Phản ánh');
  });

  it('render + gửi 5 field parity tab "Thông tin" (nguonDon/petitionDate/ngayDeXuat/phanLoaiNguonTin/dieuTraVien)', async () => {
    await renderForm();
    // Bắt buộc tối thiểu để qua validation
    fireEvent.change(await screen.findByTestId('field-senderName'), { target: { value: 'Người gửi' } });
    fireEvent.change(screen.getByTestId('field-senderAddress'), { target: { value: 'Địa chỉ' } });
    fireEvent.change(screen.getByTestId('field-summary'), { target: { value: 'Tóm tắt' } });
    fireEvent.change(screen.getByTestId('field-detailContent'), { target: { value: 'Nội dung' } });
    fireEvent.change(screen.getByTestId('field-petitionType'), { target: { value: 'TO_CAO' } });
    fireEvent.change(screen.getByTestId('field-priority'), { target: { value: 'Cao' } });
    fireEvent.change(screen.getByTestId('field-senderPhone'), { target: { value: '0901234567' } });
    fireEvent.change(screen.getByTestId('field-crimeChinhId'), { target: { value: 'crime-d173' } });

    // 5 field parity mới — input PHẢI tồn tại trên form (getByTestId throw nếu thiếu)
    fireEvent.change(screen.getByTestId('field-nguonDon'), { target: { value: 'Công an phường 1' } });
    fireEvent.change(screen.getByTestId('field-petitionDate'), { target: { value: '2026-06-18' } });
    fireEvent.change(screen.getByTestId('field-ngayDeXuat'), { target: { value: '2026-06-20' } });
    fireEvent.change(screen.getByTestId('field-phanLoaiNguonTin'), { target: { value: 'don-cong-van-ban-dau' } });
    fireEvent.change(screen.getByTestId('field-dieuTraVien'), { target: { value: 'Nguyễn Văn A' } });

    fireEvent.click(screen.getAllByRole('button', { name: /Lưu đơn thư/ })[0]);
    await waitFor(() => expect(api.post).toHaveBeenCalled());

    const [, body] = (api.post as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(body.nguonDon).toBe('Công an phường 1');
    expect(body.petitionDate).toBe('2026-06-18');
    expect(body.ngayDeXuat).toBe('2026-06-20');
    expect(body.phanLoaiNguonTin).toBe('don-cong-van-ban-dau');
    expect(body.dieuTraVien).toBe('Nguyễn Văn A');
  });

  it('nhãn "Ghi chú trùng đơn" hiển thị (khớp hệ cũ)', async () => {
    await renderForm();
    expect(await screen.findByText(/Ghi chú trùng đơn/i)).toBeInTheDocument();
  });

  it('client-side validation rejects empty petitionType (does not POST)', async () => {
    await renderForm();

    // v0.42: stt is now auto-generated (readonly), no manual fill needed.
    fireEvent.change(await screen.findByTestId('field-senderName'), { target: { value: 'UAT Sender' } });
    fireEvent.change(screen.getByTestId('field-senderAddress'), { target: { value: 'UAT addr' } });
    fireEvent.change(screen.getByTestId('field-summary'), { target: { value: 'sum' } });
    fireEvent.change(screen.getByTestId('field-detailContent'), { target: { value: 'detail' } });
    // Intentionally skip petitionType + priority

    const submitBtns = screen.getAllByRole('button', { name: /Lưu đơn thư/ });
    fireEvent.click(submitBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/Loại đơn thư là bắt buộc/i)).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
  });
});
