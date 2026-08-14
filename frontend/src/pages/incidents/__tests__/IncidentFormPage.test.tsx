import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { documentNumbersApi } from '@/features/document-numbers/api';

// Mock /lib/api: /admin/users returns empty list for FKSelect, /incidents/* for submit.
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: { id: 'inc-1' } } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));

vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: {
    draft: vi.fn().mockResolvedValue({ previewNumber: 'VV-2026-00001', isDraft: true, templateId: 'tmpl-1' }),
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
  const { IncidentFormPage } = await import('../IncidentFormPage');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/vu-viec/new']}>
        <Routes>
          <Route path="/vu-viec/new" element={<IncidentFormPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// PR-1 catalog: lyDoKhongKhoiTo render qua CatalogSelect (1 component dùng chung),
// testid mỗi option là `cat-{code}`, nhãn lấy từ registry (đúng pháp lý Đ.157).
describe('IncidentFormPage — lý do không khởi tố qua CatalogSelect (PR-1)', () => {
  it('render checkbox danh mục testid cat-{code} + nhãn pháp lý "đại xá"', async () => {
    await renderForm();
    // Field nằm trong section "Kết quả xử lý vụ việc" (mặc định đóng) → mở ra.
    fireEvent.click(screen.getByText('Kết quả xử lý vụ việc'));
    expect(await screen.findByTestId('cat-KHONG_CO_SU_VIEC')).toBeInTheDocument();
    expect(screen.getByTestId('cat-TOI_PHAM_DA_DUOC_XOA_AN_TICH')).toBeInTheDocument();
    expect(screen.getByText(/đại xá/)).toBeInTheDocument();
  });

  it('PR-2: lyDoTamDinhChiVuViec render qua CatalogSelect (cat-{code}) trong section TĐC', async () => {
    await renderForm();
    fireEvent.click(screen.getByText('Tạm đình chỉ & Phục hồi'));
    expect(await screen.findByTestId('cat-CHUA_CO_KET_QUA_GIAM_DINH')).toBeInTheDocument();
    expect(screen.getByTestId('cat-BAT_KHA_KHANG')).toBeInTheDocument();
  });
});

// Regression guard for the v0.30.0.3 fix: loaiDonVu dropdown must send enum
// values (TO_GIAC, TIN_BAO, KIEN_NGHI_KHOI_TO) — not Vietnamese labels.
// Pre-fix the field was wired to FKSelect directoryType="TDC_SOURCE" which
// used useDirectoryOptions hook returning {value: d.name} — every payload
// shipped the BLTTHS label and backend @IsEnum() rejected with 400.
describe('IncidentFormPage — loaiDonVu enum dropdown (v0.30.0.3 regression)', () => {
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

  it('renders 3 enum options matching BLTTHS Đ.144 (TO_GIAC, TIN_BAO, KIEN_NGHI_KHOI_TO)', async () => {
    await renderForm();

    // Open the loaiDonVu dropdown.
    const trigger = await screen.findByTestId('field-loaiDonVu-trigger');
    fireEvent.click(trigger);

    // All 3 BLTTHS options must be present and selectable by enum value.
    expect(await screen.findByTestId('field-loaiDonVu-option-TO_GIAC')).toBeInTheDocument();
    expect(screen.getByTestId('field-loaiDonVu-option-TIN_BAO')).toBeInTheDocument();
    expect(screen.getByTestId('field-loaiDonVu-option-KIEN_NGHI_KHOI_TO')).toBeInTheDocument();

    // Labels are user-facing Vietnamese per Đ.144 khoản 1a/b/c.
    expect(screen.getByText(/Tố giác của cá nhân/)).toBeInTheDocument();
    expect(screen.getByText(/Tin báo của cơ quan/)).toBeInTheDocument();
    expect(screen.getByText(/Kiến nghị khởi tố/)).toBeInTheDocument();
  });

  it('sends enum value (TO_GIAC), not Vietnamese label, in POST /incidents payload', async () => {
    await renderForm();

    // Fill required name (≥ 5 chars per backend DTO MinLength).
    await act(async () => {
      fireEvent.change(screen.getByTestId('field-name'), {
        target: { value: 'Vụ test enum payload' },
      });
    });

    // Open dropdown.
    await act(async () => {
      fireEvent.click(screen.getByTestId('field-loaiDonVu-trigger'));
    });

    // Pick TO_GIAC option — wrap in act so the controlled value updates flush
    // before the next interaction. React 19 + jsdom otherwise leaves the click
    // pending and the next read of formData sees the empty initial value.
    const optionButton = await screen.findByTestId('field-loaiDonVu-option-TO_GIAC');
    await act(async () => {
      fireEvent.click(optionButton);
    });

    // Verify FKSelect re-rendered with the picked label (state propagated).
    await waitFor(() =>
      expect(screen.getByTestId('field-loaiDonVu-trigger')).toHaveTextContent(/Tố giác/),
    );

    // Submit via the in-form button (type=submit) — uses the form's own onSubmit handler.
    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-save'));
    });

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [url, payload] = (api.post as any).mock.calls[0];
    expect(url).toBe('/incidents');
    expect(payload.loaiDonVu).toBe('TO_GIAC');
    // Negative assertion: payload must NOT contain the Vietnamese label.
    expect(payload.loaiDonVu).not.toMatch(/Tố giác/);
    expect(payload.loaiDonVu).not.toMatch(/khoản/);
  });

  it('omits loaiDonVu when user does not select an option (empty → undefined)', async () => {
    await renderForm();

    fireEvent.change(screen.getByTestId('field-name'), {
      target: { value: 'Vụ test omit loaiDonVu' },
    });
    fireEvent.click(screen.getByTestId('btn-save-top'));

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, payload] = (api.post as any).mock.calls[0];
    // s() helper turns "" into undefined → field omitted from payload.
    expect(payload.loaiDonVu).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// v0.31.0.0 — nguonPhatTin (cascading) + phuongThucTiepNhan (independent)
// Per Đ.144 BLTTHS 2015 + TT 28/2020/TT-BCA Đ.6.
// ─────────────────────────────────────────────────────────────────────────────

describe('IncidentFormPage — nguonPhatTin cascading + phuongThucTiepNhan (v0.31.0.0)', () => {
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

  it('Test 4 — shows only allowed nguonPhatTin options for selected loaiDonVu (TIN_BAO → 4 options)', async () => {
    await renderForm();

    // Pick TIN_BAO.
    fireEvent.click(await screen.findByTestId('field-loaiDonVu-trigger'));
    await act(async () => {
      fireEvent.click(await screen.findByTestId('field-loaiDonVu-option-TIN_BAO'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('field-loaiDonVu-trigger')).toHaveTextContent(/Tin báo/),
    );

    // Open nguonPhatTin dropdown.
    fireEvent.click(screen.getByTestId('field-nguonPhatTin-trigger'));

    // 4 TIN_BAO options must appear.
    expect(await screen.findByTestId('field-nguonPhatTin-option-CO_QUAN_NHA_NUOC')).toBeInTheDocument();
    expect(screen.getByTestId('field-nguonPhatTin-option-TO_CHUC')).toBeInTheDocument();
    expect(screen.getByTestId('field-nguonPhatTin-option-CA_NHAN_BAO_TIN')).toBeInTheDocument();
    expect(screen.getByTestId('field-nguonPhatTin-option-PHUONG_TIEN_TRUYEN_THONG')).toBeInTheDocument();

    // TO_GIAC group options must NOT appear (CA_NHAN_TO_GIAC).
    expect(screen.queryByTestId('field-nguonPhatTin-option-CA_NHAN_TO_GIAC')).not.toBeInTheDocument();
    // KIEN_NGHI_KHOI_TO group options must NOT appear (VIEN_KIEM_SAT).
    expect(screen.queryByTestId('field-nguonPhatTin-option-VIEN_KIEM_SAT')).not.toBeInTheDocument();
  });

  it('Test 5 — auto-resets nguonPhatTin when loaiDonVu changes to a group without the picked value', async () => {
    await renderForm();

    // Pick TIN_BAO + TO_CHUC.
    fireEvent.click(await screen.findByTestId('field-loaiDonVu-trigger'));
    await act(async () => {
      fireEvent.click(await screen.findByTestId('field-loaiDonVu-option-TIN_BAO'));
    });
    fireEvent.click(screen.getByTestId('field-nguonPhatTin-trigger'));
    await act(async () => {
      fireEvent.click(await screen.findByTestId('field-nguonPhatTin-option-TO_CHUC'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('field-nguonPhatTin-trigger')).toHaveTextContent(/Tổ chức/),
    );

    // Change loaiDonVu to TO_GIAC (group does NOT include TO_CHUC).
    fireEvent.click(screen.getByTestId('field-loaiDonVu-trigger'));
    await act(async () => {
      fireEvent.click(await screen.findByTestId('field-loaiDonVu-option-TO_GIAC'));
    });

    // nguonPhatTin trigger should clear (back to placeholder).
    await waitFor(() => {
      const triggerText = screen.getByTestId('field-nguonPhatTin-trigger').textContent ?? '';
      expect(triggerText).not.toMatch(/Tổ chức/);
      expect(triggerText).toMatch(/Chọn nguồn phát tin/);
    });
  });

  it('Test 6 — sends phuongThucTiepNhan enum value (DIEN_THOAI) in POST payload', async () => {
    await renderForm();

    fireEvent.change(screen.getByTestId('field-name'), {
      target: { value: 'Vụ test phuong thuc tiep nhan' },
    });

    // Pick DIEN_THOAI.
    fireEvent.click(screen.getByTestId('field-phuongThucTiepNhan-trigger'));
    await act(async () => {
      fireEvent.click(await screen.findByTestId('field-phuongThucTiepNhan-option-DIEN_THOAI'));
    });
    await waitFor(() =>
      expect(screen.getByTestId('field-phuongThucTiepNhan-trigger')).toHaveTextContent(/điện thoại/i),
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('btn-save-top'));
    });

    await waitFor(() => expect(api.post).toHaveBeenCalled());
    const [, payload] = (api.post as any).mock.calls[0];
    expect(payload.phuongThucTiepNhan).toBe('DIEN_THOAI');
  });

  it('Test 7 — edit-mode load preserves both nguonPhatTin and phuongThucTiepNhan from DB', async () => {
    // Mock GET /incidents/:id to return existing record with both fields set.
    (api.get as any).mockImplementation((url: string) => {
      if (url === '/incidents/inc-edit-1') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: 'inc-edit-1',
              name: 'Vụ edit',
              loaiDonVu: 'TIN_BAO',
              nguonPhatTin: 'TO_CHUC',
              phuongThucTiepNhan: 'BUU_DIEN',
              updatedAt: new Date().toISOString(),
            },
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    const { IncidentFormPage } = await import('../IncidentFormPage');
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/vu-viec/inc-edit-1']}>
          <Routes>
            <Route path="/vu-viec/:id" element={<IncidentFormPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Trigger labels reflect loaded values.
    await waitFor(() => {
      expect(screen.getByTestId('field-loaiDonVu-trigger')).toHaveTextContent(/Tin báo/);
    });
    await waitFor(() => {
      expect(screen.getByTestId('field-nguonPhatTin-trigger')).toHaveTextContent(/Tổ chức/);
    });
    await waitFor(() => {
      expect(screen.getByTestId('field-phuongThucTiepNhan-trigger')).toHaveTextContent(/bưu điện/i);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// v0.42 — DocNumberPreviewField: mã vụ việc tự sinh
// ─────────────────────────────────────────────────────────────────────────────

describe('IncidentFormPage — mã vụ việc draft preview (v0.42)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authStore.setProfile(SAMPLE_PROFILE);
    (documentNumbersApi.draft as ReturnType<typeof vi.fn>).mockResolvedValue({
      previewNumber: 'VV-2026-00001',
      isDraft: true,
      templateId: 'tmpl-1',
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('calls documentNumbersApi.draft("INCIDENT") on mount in create mode', async () => {
    await renderForm();
    await waitFor(() => {
      expect(documentNumbersApi.draft).toHaveBeenCalledWith('INCIDENT');
    });
  });

  it('shows draft incident code in readonly DocNumberPreviewField', async () => {
    await renderForm();
    await waitFor(() => {
      expect(screen.getByTestId('docnum-preview-value')).toHaveTextContent('VV-2026-00001');
    });
    expect(screen.getByTestId('docnum-auto-badge')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test 8 — getNguonPhatTinOptions helper (pure function unit test)
// ─────────────────────────────────────────────────────────────────────────────

describe('getNguonPhatTinOptions helper (pure)', () => {
  it('returns empty array for empty loaiDonVu', async () => {
    const { getNguonPhatTinOptions } = await import('@/shared/enums/status-labels');
    expect(getNguonPhatTinOptions('')).toEqual([]);
  });

  it('returns empty array for unknown loaiDonVu', async () => {
    const { getNguonPhatTinOptions } = await import('@/shared/enums/status-labels');
    expect(getNguonPhatTinOptions('NOT_AN_ENUM_VALUE')).toEqual([]);
  });

  it('returns 1 option for TO_GIAC (Đ.144 K1)', async () => {
    const { getNguonPhatTinOptions } = await import('@/shared/enums/status-labels');
    const opts = getNguonPhatTinOptions('TO_GIAC');
    expect(opts).toHaveLength(1);
    expect(opts[0].value).toBe('CA_NHAN_TO_GIAC');
  });

  it('returns 4 options for TIN_BAO (Đ.144 K2)', async () => {
    const { getNguonPhatTinOptions } = await import('@/shared/enums/status-labels');
    expect(getNguonPhatTinOptions('TIN_BAO')).toHaveLength(4);
  });

  it('returns 5 options for KIEN_NGHI_KHOI_TO (Đ.144 K3)', async () => {
    const { getNguonPhatTinOptions } = await import('@/shared/enums/status-labels');
    expect(getNguonPhatTinOptions('KIEN_NGHI_KHOI_TO')).toHaveLength(5);
  });
});

// Cycle 10 — IncidentFormPage gets Tài liệu section via EntityDocumentsTab
describe('IncidentFormPage — Tài liệu section (Cycle 10)', () => {
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

  it('renders EntityDocumentsTab in create mode but guarded, not hidden', async () => {
    // This test used to assert the tab was absent, and passed for the wrong
    // reason: `Card` dropped every prop it did not name, so the data-testid
    // never reached the DOM anywhere. The form has always rendered the tab
    // unconditionally — see the comment at IncidentFormPage.tsx: "luôn hiển
    // thị; EntityDocumentsTab tự guard khi chưa có incidentId". Now that the
    // testid works, assert what the component is actually meant to do.
    await renderForm();

    expect(screen.getByTestId('entity-documents-incident')).toBeInTheDocument();
    expect(
      screen.getByText('Lưu vụ việc trước để tải lên tài liệu'),
    ).toBeInTheDocument();
  });
});
