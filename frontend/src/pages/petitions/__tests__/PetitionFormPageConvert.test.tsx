import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';
import { documentNumbersApi } from '@/features/document-numbers/api';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(() => Promise.resolve({ data: { success: true, data: [] } })),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    put: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
  authApi: { me: vi.fn() },
}));

vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: {
    draft: vi.fn().mockResolvedValue({ previewNumber: 'DT-2026-00001', isDraft: true, templateId: 'tmpl-2' }),
  },
}));

const SAMPLE_PROFILE: AuthUser = {
  id: 'u1', email: 'a@b.com', username: 'a', firstName: 'A', lastName: 'B',
  role: 'OFFICER', canDispatch: false,
  teams: [{ teamId: 'team-doi-1', teamName: 'Đội 1', isLeader: true }],
  primaryTeam: { teamId: 'team-doi-1', teamName: 'Đội 1' },
};

// ─── Nhóm II: button visibility in PetitionFormPage edit mode ─────────────────

describe('PetitionFormPage — Nhóm II: btn-convert-petition visibility', () => {
  async function renderEditFormWrapped(petitionId: string, linkedIncidentId: string | null, linkedCaseId: string | null) {
    const { api } = await import('@/lib/api');
    (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (String(url).includes(`/petitions/${petitionId}`)) {
        return Promise.resolve({ data: { success: true, data: {
          id: petitionId, stt: 'DT-2026-00001', receivedDate: '2026-01-01',
          senderName: 'Nguyễn Văn A', petitionType: 'TO_CAO', summary: 'Test',
          updatedAt: '2026-06-01T10:00:00.000Z',
          linkedIncidentId, linkedCaseId,
        } } });
      }
      // /admin/users must return array for userOptions.map to work
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    const { PetitionFormPage } = await import('../PetitionFormPage');
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    let result: ReturnType<typeof render>;
    await act(async () => {
      result = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={[`/petitions/${petitionId}/edit`]}>
            <Routes>
              <Route path="/petitions/:id/edit" element={<PetitionFormPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
      // Flush all pending microtasks (api call + state updates)
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    return result!;
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authStore.setProfile(SAMPLE_PROFILE);
    (documentNumbersApi.draft as ReturnType<typeof vi.fn>).mockResolvedValue({
      previewNumber: 'DT-2026-00001', isDraft: true, templateId: 'tmpl-2',
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('II-FE1: btn-convert-petition hiển thị trong edit mode khi chưa convert', async () => {
    await renderEditFormWrapped('pet-edit-01', null, null);
    await waitFor(() => {
      expect(screen.getByTestId('btn-convert-petition')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('II-FE2: btn-convert-petition KHÔNG hiển thị khi đã linkedIncidentId', async () => {
    await renderEditFormWrapped('pet-edit-02', 'inc-01', null);
    await waitFor(() => {
      // Form has loaded (can see save button), but no convert button
      expect(screen.queryByTestId('btn-save-main')).toBeInTheDocument();
      expect(screen.queryByTestId('btn-convert-petition')).not.toBeInTheDocument();
    }, { timeout: 5000 });
  });
});
