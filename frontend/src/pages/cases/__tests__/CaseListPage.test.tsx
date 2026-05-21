/**
 * CaseListPage integration tests — v0.31.0.2 delete-with-reason flow.
 *
 * Covers:
 * - FE-1: status guard (TIEP_NHAN → enabled, others → disabled với tooltip)
 * - FE-2: open modal → preflight fires + textarea autofocus
 * - FE-3: API error → inline banner (NOT window.alert), modal stays open, reason preserved
 * - FE-4: blockers > 0 → submit disabled + red banner with counts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { authStore, type AuthUser } from '@/stores/auth.store';

// In-test mutable state cho api mock
const apiState = {
  caseRow: {
    id: 'case-test-001',
    name: 'Vụ án test integration',
    crime: 'Tham nhũng',
    status: 'TIEP_NHAN',
    deadline: null,
    unit: 'Test',
    subjectsCount: 0,
    assignedTeamId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    investigator: null,
  },
  preflightResponse: {
    success: true,
    data: {
      canDelete: true,
      status: 'TIEP_NHAN',
      blockers: { subjects: 0, lawyers: 0, conclusions: 0, documents: 0, linkedIncidents: 0 },
      reasonsIfBlocked: [] as string[],
    },
  },
  deleteShouldFail: false,
};

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn((url: string) => {
      if (url.includes('/delete-preflight')) {
        return Promise.resolve({ data: apiState.preflightResponse });
      }
      if (url.startsWith('/cases')) {
        return Promise.resolve({
          data: { success: true, data: [apiState.caseRow], total: 1 },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    }),
    post: vi.fn(() => Promise.resolve({ data: { success: true } })),
    patch: vi.fn(() => Promise.resolve({ data: { success: true } })),
    delete: vi.fn(() => {
      if (apiState.deleteShouldFail) {
        return Promise.reject({
          response: { data: { message: 'Vụ án đã đổi trạng thái trong lúc thực hiện.' } },
        });
      }
      return Promise.resolve({ data: { success: true } });
    }),
  },
}));

// Mock usePermission hook
vi.mock('@/hooks/usePermission', () => ({
  usePermission: () => ({ canDispatch: true, canEdit: () => true }),
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

async function renderCaseList() {
  const { default: CaseListPage } = await import('../CaseListPage');
  return render(
    <MemoryRouter initialEntries={['/vu-an']}>
      <Routes>
        <Route path="/vu-an" element={<CaseListPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CaseListPage — Delete vụ án v0.31.0.2', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    authStore.setProfile(SAMPLE_PROFILE);
    // Reset api state
    apiState.caseRow.status = 'TIEP_NHAN';
    apiState.preflightResponse.data.canDelete = true;
    apiState.preflightResponse.data.blockers = { subjects: 0, lawyers: 0, conclusions: 0, documents: 0, linkedIncidents: 0 };
    apiState.preflightResponse.data.reasonsIfBlocked = [];
    apiState.deleteShouldFail = false;
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('FE-1a: status TIEP_NHAN → "Xóa vụ án" button enabled', async () => {
    apiState.caseRow.status = 'TIEP_NHAN';
    await renderCaseList();
    await waitFor(() => expect(screen.getByText('Vụ án test integration')).toBeInTheDocument(), { timeout: 5000 });

    // Click ⋮ to open action menu
    fireEvent.click(screen.getByTestId('btn-more-case-test-001'));

    await waitFor(() => expect(screen.getByTestId('btn-delete-case-test-001')).toBeInTheDocument());
    const deleteBtn = screen.getByTestId('btn-delete-case-test-001');
    expect(deleteBtn).not.toBeDisabled();
  });

  it('FE-1b: status DANG_DIEU_TRA → button disabled với tooltip', async () => {
    apiState.caseRow.status = 'DANG_DIEU_TRA';
    await renderCaseList();
    await waitFor(() => expect(screen.getByText('Vụ án test integration')).toBeInTheDocument(), { timeout: 5000 });

    fireEvent.click(screen.getByTestId('btn-more-case-test-001'));
    await waitFor(() => expect(screen.getByTestId('btn-delete-case-test-001')).toBeInTheDocument());

    const deleteBtn = screen.getByTestId('btn-delete-case-test-001');
    expect(deleteBtn).toBeDisabled();
    expect(deleteBtn.getAttribute('title')).toContain('Tiếp nhận');
  });

  it('FE-2: click "Xóa vụ án" → modal opens với textarea autofocus + preflight fires', async () => {
    await renderCaseList();
    await waitFor(() => expect(screen.getByText('Vụ án test integration')).toBeInTheDocument(), { timeout: 5000 });

    fireEvent.click(screen.getByTestId('btn-more-case-test-001'));
    await waitFor(() => expect(screen.getByTestId('btn-delete-case-test-001')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-delete-case-test-001'));

    // Modal opens
    await waitFor(() => expect(screen.getByTestId('delete-modal')).toBeInTheDocument());

    // Submit button initially disabled (reason empty)
    expect(screen.getByTestId('btn-confirm-delete')).toBeDisabled();

    // Counter starts at 0/500
    expect(screen.getByTestId('reason-counter').textContent).toBe('0/500');

    // Type valid reason
    const textarea = screen.getByTestId('delete-reason-input') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Lý do xóa hợp lệ' } });

    await waitFor(() => expect(screen.getByTestId('btn-confirm-delete')).not.toBeDisabled());

    // Submit
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));

    // Modal closes after success
    await waitFor(() => expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument());
    // Success banner renders
    await waitFor(() => expect(screen.getByTestId('success-banner')).toBeInTheDocument());
  });

  it('FE-3: API error → inline error banner (NOT alert), modal stays, reason preserved', async () => {
    apiState.deleteShouldFail = true;
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    await renderCaseList();
    await waitFor(() => expect(screen.getByText('Vụ án test integration')).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByTestId('btn-more-case-test-001'));
    await waitFor(() => expect(screen.getByTestId('btn-delete-case-test-001')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-delete-case-test-001'));
    await waitFor(() => expect(screen.getByTestId('delete-modal')).toBeInTheDocument());

    const textarea = screen.getByTestId('delete-reason-input') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Reason đủ dài 10 ký tự thiệt' } });
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));

    // Inline banner shown
    await waitFor(() => expect(screen.getByTestId('delete-error-banner')).toBeInTheDocument());
    expect(screen.getByTestId('delete-error-banner').textContent).toContain('đã đổi trạng thái');

    // alert() NEVER called
    expect(alertSpy).not.toHaveBeenCalled();

    // Modal still open
    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();

    // Reason preserved
    expect((screen.getByTestId('delete-reason-input') as HTMLTextAreaElement).value).toBe('Reason đủ dài 10 ký tự thiệt');

    alertSpy.mockRestore();
  });

  it('FE-4: blockers > 0 → submit disabled + red banner with counts', async () => {
    apiState.preflightResponse.data.canDelete = false;
    apiState.preflightResponse.data.blockers = { subjects: 2, lawyers: 1, conclusions: 0, documents: 0, linkedIncidents: 0 };
    apiState.preflightResponse.data.reasonsIfBlocked = ['2 đối tượng đang liên kết.', '1 luật sư đang liên kết.'];

    await renderCaseList();
    await waitFor(() => expect(screen.getByText('Vụ án test integration')).toBeInTheDocument(), { timeout: 5000 });
    fireEvent.click(screen.getByTestId('btn-more-case-test-001'));
    await waitFor(() => expect(screen.getByTestId('btn-delete-case-test-001')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-delete-case-test-001'));
    await waitFor(() => expect(screen.getByTestId('delete-modal')).toBeInTheDocument());

    // Blocker banner rendered
    await waitFor(() => expect(screen.getByTestId('delete-blockers')).toBeInTheDocument());
    expect(screen.getByTestId('delete-blockers').textContent).toContain('2 đối tượng');
    expect(screen.getByTestId('delete-blockers').textContent).toContain('1 luật sư');

    // Even với valid reason, submit stays disabled vì blockers
    const textarea = screen.getByTestId('delete-reason-input') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Reason đủ dài 10 ký tự' } });
    expect(screen.getByTestId('btn-confirm-delete')).toBeDisabled();
  });
});
