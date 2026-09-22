import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { documentNumbersApi } from '@/features/document-numbers/api';
import { today } from '@/lib/dates';

// Mock api: /admin/users (used to load FKSelect options) returns empty list,
// /petitions/:id is never hit because we test create mode only.
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: {
    me: vi.fn(),
  },
}));

vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: {
    draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-00001', isDraft: true, templateId: 'tmpl-2' }),
  },
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
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ─── v0.42: stt field → DocNumberPreviewField (AUTO mode) ────────────────────

describe('PetitionFormPage — stt field DocNumberPreviewField (v0.42)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authStore.setProfile(SAMPLE_PROFILE);
    (documentNumbersApi.draft as ReturnType<typeof vi.fn>).mockResolvedValue({
      previewNumber: 'DT-2026-00001',
      isDraft: true,
      templateId: 'tmpl-2',
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('calls documentNumbersApi.draft("PETITION") on mount in create mode', async () => {
    await renderForm();
    await waitFor(() => {
      expect(documentNumbersApi.draft).toHaveBeenCalledWith('PETITION');
    });
  });

  it('stt field renders as DocNumberPreviewField (AUTO mode) with draft number', async () => {
    await renderForm();
    await waitFor(() => {
      expect(screen.getByTestId('docnum-preview-value')).toHaveTextContent('DT-2026-00001');
    });
    expect(screen.getByTestId('docnum-auto-badge')).toBeInTheDocument();
  });

  it('stt text input is replaced (no editable text input for stt)', async () => {
    await renderForm();
    await waitFor(() => {
      expect(screen.getByTestId('docnum-auto-badge')).toBeInTheDocument();
    });
    // The old plain text input for stt should be gone
    expect(screen.queryByTestId('field-receivedNumber')).toBeNull();
  });
});

describe('PetitionFormPage — create-mode defaults', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('pre-fills receivedDate with today() in create mode', async () => {
    authStore.setProfile(SAMPLE_PROFILE);
    await renderForm();

    const dateInput = await screen.findByTestId('field-receivedDate') as HTMLInputElement;
    await waitFor(() => {
      expect(dateInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    // Dùng cùng helper today() (giờ VN) như component — tránh lệch biên múi giờ khi test chạy UTC.
    expect(dateInput.value).toBe(today());
  });

  it('does NOT crash when profile is not yet hydrated (isLoaded=false)', async () => {
    // No profile set — defaults.isLoaded=false; useEffect must skip apply.
    await renderForm();

    // Form mounts without throwing. receivedDate falls back to INITIAL_FORM today().
    const dateInput = await screen.findByTestId('field-receivedDate') as HTMLInputElement;
    expect(dateInput.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('persists primaryTeam profile in store for downstream forms', () => {
    // Verifies the contract that defaults helpers depend on.
    authStore.setProfile(SAMPLE_PROFILE);
    expect(authStore.getProfile()?.primaryTeam?.teamName).toBe('Đội 1');
    expect(authStore.getProfile()?.primaryTeam?.teamId).toBe('team-doi-1');
    expect(authStore.getProfile()?.id).toBe('u1');
  });

  // Cycle 9 — v0.52: PetitionFormPage gets a Tài liệu section
  it('Cycle 9: does NOT render EntityDocumentsTab in create mode (no petitionId)', async () => {
    await renderForm();
    // Section exists conditionally — chỉ hiện trong edit mode.
    expect(screen.queryByTestId('entity-documents-petition')).toBeNull();
  });

  /**
   * MỐC ĐÚNG ĐÃ ĐỔI LẦN HAI, 22/09/2026 — anh yêu cầu bỏ hẳn ô này khỏi form Đơn thư.
   *
   * Mốc cũ (26/08/2026) đòi ô mang nhãn hệ cũ "Đồ vật, tài liệu kèm theo". Nay ô không còn, nên
   * mệnh đề đảo chiều. Đây là đổi YÊU CẦU, không phải sửa ca kiểm cho khớp mã sai: cột
   * `attachmentsNote` vẫn giữ nguyên 11.591 hồ sơ và bản in vẫn đọc nó — xem
   * `o-an.def.ts` và `baOAnKhongDungNua.gate.test.tsx`.
   */
  it('ô "Đồ vật, tài liệu kèm theo" đã bỏ khỏi form (yêu cầu 22/09/2026)', async () => {
    await renderForm();
    await screen.findByTestId('field-senderName');
    expect(screen.queryByTestId('field-attachmentsNote')).toBeNull();
    expect(screen.queryByText(/Đồ vật, tài liệu kèm theo/i)).toBeNull();
  });
});

// ── Nhóm V — suspect-search + duplicate-search combobox ──────────────────────

describe('PetitionFormPage — Nhóm V combobox fields', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authStore.setProfile(SAMPLE_PROFILE);
    (documentNumbersApi.draft as ReturnType<typeof vi.fn>).mockResolvedValue({
      previewNumber: 'DT-2026-00001',
      isDraft: true,
      templateId: 'tmpl-2',
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  /*
    V-FE1 và V-FE3 (ô tra tiền án) gỡ ngày 20/09/2026 cùng ô "Tội danh cũ trước đây" — anh yêu
    cầu bỏ ô ấy khỏi form Đơn thư. Hai ca ấy chạy trên thứ không còn tồn tại; giữ lại và đổi
    thành "không tìm thấy" cũng chẳng khẳng định thêm gì, vì
    `baOAnKhongDungNua.gate.test.tsx` đã canh việc ba ô không dựng ở BẤT KỲ tab nào, kèm phép
    gieo lỗi chứng minh cổng ấy đỏ được.

    Đầu API `/petitions/suspect-search` vẫn còn và vẫn có ca kiểm riêng ở máy chủ — chỉ phần
    dựng trên form là bỏ.
  */

  it('V-FE2: renders duplicate-search-input field with correct testid', async () => {
    await renderForm();
    const input = await screen.findByTestId('duplicate-search-input');
    expect(input).toBeInTheDocument();
  });

  it('V-FE4: duplicate-search-input triggers API call on user input', async () => {
    const { api } = await import('@/lib/api');
    (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (String(url).includes('duplicate-search')) {
        return Promise.resolve({ data: [{ id: 'pet-1', stt: 'DT-2025-00001', senderName: 'Lê C', receivedDate: '2025-01-01', summary: null }] });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    await renderForm();
    const input = await screen.findByTestId('duplicate-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Lê C' } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining('duplicate-search'),
        expect.objectContaining({ params: expect.objectContaining({ q: 'Lê C' }) }),
      );
    }, { timeout: 1500 });
  });
});

// Nhóm II tests: see PetitionFormPageConvert.test.tsx
