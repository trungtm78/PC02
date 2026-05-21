/**
 * RestorePage integration tests — v0.32.0.0.
 * Covers:
 * - FE-R1: ADMIN sees 3 tabs + list deleted records
 * - FE-R2: click Restore → modal opens + reason validation
 * - FE-R3: success → row disappears + success banner
 * - FE-R4: non-admin user → block message, no API call
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { authStore, type AuthUser } from '@/stores/auth.store';

const apiState = {
  deletedCases: [
    {
      id: 'case-del-001',
      name: 'Vụ án đã xóa test',
      deletedAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
      createdBy: { username: 'nguyenva', firstName: 'A', lastName: 'B' },
      deleteAudit: {
        userId: 'u1',
        metadata: { reason: 'Nhập sai thông tin' },
        createdAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
      },
    },
  ],
  restoreShouldFail: false,
};

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.includes('/cases/admin/deleted')) {
        return Promise.resolve({ data: { success: true, data: apiState.deletedCases, total: apiState.deletedCases.length } });
      }
      if (url.includes('/incidents/admin/deleted') || url.includes('/petitions/admin/deleted')) {
        return Promise.resolve({ data: { success: true, data: [], total: 0 } });
      }
      return Promise.resolve({ data: { success: true, data: [], total: 0 } });
    }),
    post: vi.fn((url: string) => {
      if (url.includes('/restore')) {
        if (apiState.restoreShouldFail) {
          return Promise.reject({ response: { data: { message: 'Đã được khôi phục bởi quản trị viên khác' } } });
        }
        return Promise.resolve({ data: { success: true } });
      }
      return Promise.resolve({ data: { success: true } });
    }),
  },
}));

const ADMIN_PROFILE: AuthUser = {
  id: 'admin-1',
  email: 'admin@pc02.local',
  username: 'admin',
  firstName: 'Quản',
  lastName: 'Trị',
  role: 'ADMIN',
  canDispatch: true,
  teams: [],
  primaryTeam: null,
};

const OFFICER_PROFILE: AuthUser = {
  ...ADMIN_PROFILE,
  id: 'u2',
  username: 'officer',
  role: 'OFFICER',
};

async function renderPage() {
  const { default: RestorePage } = await import('../RestorePage');
  return render(
    <MemoryRouter initialEntries={['/admin/khoi-phuc']}>
      <Routes>
        <Route path="/admin/khoi-phuc" element={<RestorePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RestorePage v0.32.0.0', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    apiState.restoreShouldFail = false;
    apiState.deletedCases = [
      {
        id: 'case-del-001',
        name: 'Vụ án đã xóa test',
        deletedAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
        createdBy: { username: 'nguyenva', firstName: 'A', lastName: 'B' },
        deleteAudit: {
          userId: 'u1',
          metadata: { reason: 'Nhập sai thông tin' },
          createdAt: new Date(Date.now() - 24 * 3_600_000).toISOString(),
        },
      },
    ];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('FE-R1: ADMIN sees 3 tabs and deleted records list', async () => {
    authStore.setProfile(ADMIN_PROFILE);
    await renderPage();
    expect(screen.getByTestId('restore-page')).toBeInTheDocument();
    expect(screen.getByTestId('tab-cases')).toBeInTheDocument();
    expect(screen.getByTestId('tab-incidents')).toBeInTheDocument();
    expect(screen.getByTestId('tab-petitions')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Vụ án đã xóa test')).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByText('Nhập sai thông tin')).toBeInTheDocument();
  });

  it('FE-R2: click Khôi phục → modal opens + reason min 10 chars validation', async () => {
    authStore.setProfile(ADMIN_PROFILE);
    await renderPage();
    await waitFor(() => expect(screen.getByText('Vụ án đã xóa test')).toBeInTheDocument(), { timeout: 5000 });

    fireEvent.click(screen.getByTestId('btn-restore-case-del-001'));
    await waitFor(() => expect(screen.getByTestId('restore-modal')).toBeInTheDocument());

    // Submit initially disabled
    expect(screen.getByTestId('btn-confirm-restore')).toBeDisabled();
    expect(screen.getByTestId('restore-reason-counter').textContent).toBe('0/500');

    // Type valid reason
    const textarea = screen.getByTestId('restore-reason-input') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Khôi phục đúng theo yêu cầu' } });
    await waitFor(() => expect(screen.getByTestId('btn-confirm-restore')).not.toBeDisabled());
  });

  it('FE-R3: restore success → row disappears + success banner', async () => {
    authStore.setProfile(ADMIN_PROFILE);
    await renderPage();
    await waitFor(() => expect(screen.getByText('Vụ án đã xóa test')).toBeInTheDocument(), { timeout: 5000 });

    fireEvent.click(screen.getByTestId('btn-restore-case-del-001'));
    await waitFor(() => expect(screen.getByTestId('restore-modal')).toBeInTheDocument());

    const textarea = screen.getByTestId('restore-reason-input') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Khôi phục theo yêu cầu thủ trưởng' } });
    fireEvent.click(screen.getByTestId('btn-confirm-restore'));

    await waitFor(() => expect(screen.queryByTestId('restore-modal')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('success-banner')).toBeInTheDocument());
    expect(screen.queryByText('Vụ án đã xóa test')).not.toBeInTheDocument();
  });

  it('FE-R4: non-admin user sees block message, no API call', async () => {
    authStore.setProfile(OFFICER_PROFILE);
    const { api } = await import('@/lib/api');
    await renderPage();
    expect(screen.getByTestId('restore-non-admin-block')).toBeInTheDocument();
    expect(screen.queryByTestId('restore-page')).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });
});
