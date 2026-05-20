import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { api } from '@/lib/api';

// Mock /lib/api: /admin/users returns empty list for FKSelect, /incidents/* for submit.
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { success: true, data: { id: 'inc-1' } } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
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
