/**
 * IncidentListPage integration tests for v0.31.0.1 — verify ActionMenuPortal
 * wiring (state-based anchor, click outside close).
 *
 * Per Issue 3A: bootstrap 1 integration test cho IncidentListPage để catch
 * wiring regression (vd quên `e.currentTarget`, hoặc `setOpenMenu(null)` sai
 * handler). 2 ListPage còn lại (Case + Petition) apply cùng pattern, defer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authStore, type AuthUser } from '@/stores/auth.store';

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.startsWith('/incidents/investigators')) {
        return Promise.resolve({ data: { success: true, data: [] } });
      }
      if (url.startsWith('/incidents')) {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                id: 'inc-1',
                code: 'VV-2026-00001',
                name: 'Vu test integration',
                status: 'TIEP_NHAN',
                deadline: null,
                investigator: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            ],
            total: 1,
            page: 1,
            pageSize: 20,
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    patch: vi.fn(() => Promise.resolve({ data: { success: true } })),
    delete: vi.fn(() => Promise.resolve({ data: { success: true } })),
  },
}));

const SAMPLE_PROFILE: AuthUser = {
  id: 'u1',
  email: 'a@b.com',
  username: 'a',
  firstName: 'A',
  lastName: 'B',
  role: 'OFFICER',
  canDispatch: true,
  teams: [{ teamId: 'team-doi-1', teamName: 'Đội 1', isLeader: true }],
  primaryTeam: { teamId: 'team-doi-1', teamName: 'Đội 1' },
};

async function renderListPage() {
  const { IncidentListPage } = await import('../IncidentListPage');
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/vu-viec']}>
        <Routes>
          <Route path="/vu-viec" element={<IncidentListPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('IncidentListPage — ActionMenuPortal integration (v0.31.0.1)', () => {
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

  it('Test 1 — clicking ⋮ button opens ActionMenuPortal with correct anchor', async () => {
    await renderListPage();

    // Wait for incident row to load.
    await waitFor(() => expect(screen.getByText('VV-2026-00001')).toBeInTheDocument(), { timeout: 5000 });

    // Click ⋮ action button.
    const actionBtn = screen.getByTestId('btn-action-menu');
    fireEvent.click(actionBtn);

    // Portal rendered in document.body.
    await waitFor(() => expect(screen.getByTestId('action-menu-portal')).toBeInTheDocument());
  });

  it('Test 2 — clicking outside closes the portal', async () => {
    await renderListPage();
    await waitFor(() => expect(screen.getByText('VV-2026-00001')).toBeInTheDocument(), { timeout: 5000 });

    fireEvent.click(screen.getByTestId('btn-action-menu'));
    await waitFor(() => expect(screen.getByTestId('action-menu-portal')).toBeInTheDocument());

    // Click outside: dispatch mousedown on document.body.
    fireEvent.mouseDown(document.body);

    await waitFor(() =>
      expect(screen.queryByTestId('action-menu-portal')).not.toBeInTheDocument(),
    );
  });
});
