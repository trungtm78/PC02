import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { documentNumbersApi } from '@/features/document-numbers/api';

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

    const today = new Date();
    const expected =
      `${today.getFullYear()}-` +
      `${String(today.getMonth() + 1).padStart(2, '0')}-` +
      `${String(today.getDate()).padStart(2, '0')}`;
    expect(dateInput.value).toBe(expected);
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
});
