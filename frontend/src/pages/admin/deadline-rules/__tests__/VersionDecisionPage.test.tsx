import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import VersionDecisionPage from '../VersionDecisionPage';
import { deadlineRulesApi } from '@/features/deadline-rules/api';
import { authStore } from '@/stores/auth.store';
import type { DeadlineRuleVersion } from '@/features/deadline-rules/types';

vi.mock('@/features/deadline-rules/api', () => ({
  deadlineRulesApi: {
    listActive: vi.fn(),
    getSummary: vi.fn(),
    getApprovalQueue: vi.fn(),
    getHistory: vi.fn(),
    getById: vi.fn(),
    previewImpact: vi.fn(),
    query: vi.fn(),
    propose: vi.fn(),
    updateDraft: vi.fn(),
    submit: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    withdraw: vi.fn(),
    requestChanges: vi.fn(),
    deleteDraft: vi.fn(),
  },
  DEADLINE_RULES_QUERY_KEYS: {
    active: ['deadline-rules', 'active'],
    summary: ['deadline-rules', 'summary'],
    queue: ['deadline-rules', 'approval-queue'],
    history: (k: string) => ['deadline-rules', 'history', k],
    detail: (id: string) => ['deadline-rules', 'detail', id],
    impact: (id: string) => ['deadline-rules', 'impact', id],
  },
}));

const ADMIN_PROFILE = {
  id: 'user-self',
  email: 'self@test',
  username: 'self',
  firstName: 'Self',
  lastName: 'User',
  role: 'ADMIN' as const,
  teams: [],
  primaryTeam: null,
};

function makeVersion(overrides: Partial<DeadlineRuleVersion> = {}): DeadlineRuleVersion {
  return {
    id: 'v1',
    ruleKey: 'THOI_HAN_XAC_MINH',
    value: 25,
    label: 'Thời hạn xác minh',
    legalBasis: 'Điều 147',
    documentType: 'TT',
    documentNumber: '28/2020',
    documentIssuer: 'BCA',
    documentDate: null,
    documentUrl: null,
    withdrawNotes: null,
    attachmentId: null,
    migrationConfidence: null,
    reason: 'Cập nhật theo TT 28/2020',
    status: 'submitted',
    effectiveFrom: null,
    effectiveTo: null,
    supersedesId: null,
    proposedById: 'user-self',
    proposedByType: 'USER',
    proposedAt: new Date('2026-05-01').toISOString(),
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    proposedBy: { id: 'user-self', firstName: 'Self', lastName: 'User', username: 'self' },
    ...overrides,
  };
}

function renderPage(versionId = 'v1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/admin/deadline-rules/version/${versionId}`]}>
        <Routes>
          <Route path="/admin/deadline-rules/version/:id" element={<VersionDecisionPage />} />
          <Route path="*" element={<div>OTHER</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VersionDecisionPage — withdraw + request-changes workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authStore, 'getProfile').mockReturnValue(ADMIN_PROFILE);
    vi.mocked(deadlineRulesApi.listActive).mockResolvedValue({ success: true, data: [] });
    vi.mocked(deadlineRulesApi.previewImpact).mockResolvedValue({
      success: true,
      data: {
        ruleKey: 'THOI_HAN_XAC_MINH',
        proposedValue: 25,
        effectiveFrom: null,
        counts: { notAffected: 0, openWillReextend: 0, futureAll: 0 },
        soonestIncidents: [],
        soonestPetitions: [],
      },
    });
  });

  it('shows btn-withdraw when status=submitted AND viewer is proposer; btn-request-changes is disabled', async () => {
    vi.mocked(deadlineRulesApi.getById).mockResolvedValue({
      success: true,
      data: makeVersion({ status: 'submitted', proposedById: 'user-self' }),
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('self-review-banner')).toBeInTheDocument());
    expect(screen.getByTestId('btn-withdraw')).toBeInTheDocument();
    // Approver-side buttons stay rendered but disabled — matches existing reject/approve pattern.
    // Service-level proposedById === userId check is the source of truth on the server.
    expect(screen.getByTestId('btn-request-changes')).toBeDisabled();
    expect(screen.getByTestId('btn-approve')).toBeDisabled();
  });

  it('hides btn-withdraw when viewer is NOT the proposer (approver view)', async () => {
    vi.mocked(deadlineRulesApi.getById).mockResolvedValue({
      success: true,
      data: makeVersion({ status: 'submitted', proposedById: 'someone-else' }),
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-approve')).toBeInTheDocument());
    expect(screen.queryByTestId('btn-withdraw')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-request-changes')).toBeInTheDocument();
  });

  it('btn-withdraw opens modal, validates ≥10 chars, calls API.withdraw on submit', async () => {
    vi.mocked(deadlineRulesApi.getById).mockResolvedValue({
      success: true,
      data: makeVersion({ status: 'submitted', proposedById: 'user-self' }),
    });
    vi.mocked(deadlineRulesApi.withdraw).mockResolvedValue({
      success: true,
      data: makeVersion({ status: 'draft', proposedById: 'user-self', withdrawNotes: 'Sai số liệu cần sửa' }),
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-withdraw')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-withdraw'));
    await waitFor(() => expect(screen.getByTestId('reason-modal-input')).toBeInTheDocument());

    // Short note → submit shows inline error, API NOT called
    fireEvent.change(screen.getByTestId('reason-modal-input'), { target: { value: 'short' } });
    fireEvent.click(screen.getByTestId('reason-modal-submit'));
    await waitFor(() => expect(screen.getByTestId('reason-modal-error')).toBeInTheDocument());
    expect(vi.mocked(deadlineRulesApi.withdraw)).not.toHaveBeenCalled();

    // Long enough → API.withdraw fires with trimmed reason
    fireEvent.change(screen.getByTestId('reason-modal-input'), {
      target: { value: '  Sai số liệu cần phải sửa lại theo TT mới  ' },
    });
    fireEvent.click(screen.getByTestId('reason-modal-submit'));
    await waitFor(() => {
      expect(vi.mocked(deadlineRulesApi.withdraw)).toHaveBeenCalledWith('v1', {
        withdrawNotes: 'Sai số liệu cần phải sửa lại theo TT mới',
      });
    });
  });

  it('btn-request-changes opens modal and calls API.requestChanges on submit', async () => {
    vi.mocked(deadlineRulesApi.getById).mockResolvedValue({
      success: true,
      data: makeVersion({ status: 'submitted', proposedById: 'someone-else' }),
    });
    vi.mocked(deadlineRulesApi.requestChanges).mockResolvedValue({
      success: true,
      data: makeVersion({
        status: 'draft',
        proposedById: 'someone-else',
        reviewedById: 'user-self',
        reviewedAt: new Date().toISOString(),
        reviewNotes: 'Cần bổ sung điều khoản BLTTHS',
      }),
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-request-changes')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-request-changes'));
    await waitFor(() => expect(screen.getByTestId('reason-modal-input')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('reason-modal-input'), {
      target: { value: 'Cần bổ sung Điều 147 khoản 2 BLTTHS' },
    });
    fireEvent.click(screen.getByTestId('reason-modal-submit'));
    await waitFor(() => {
      expect(vi.mocked(deadlineRulesApi.requestChanges)).toHaveBeenCalledWith('v1', {
        reviewNotes: 'Cần bổ sung Điều 147 khoản 2 BLTTHS',
      });
    });
  });

  it('renders changes-requested-banner when status=draft + reviewNotes set', async () => {
    vi.mocked(deadlineRulesApi.getById).mockResolvedValue({
      success: true,
      data: makeVersion({
        status: 'draft',
        proposedById: 'user-self',
        reviewedById: 'approver-b',
        reviewedAt: new Date().toISOString(),
        reviewNotes: 'Cần bổ sung Điều 147 khoản 2',
        reviewedBy: { id: 'approver-b', firstName: 'Approver', lastName: 'B', username: 'approver_b' },
      }),
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('changes-requested-banner')).toBeInTheDocument());
    expect(screen.getByText(/Cần bổ sung Điều 147 khoản 2/)).toBeInTheDocument();
    // C3 fix: "Duyệt bởi" line MUST NOT appear in header for draft + reviewedAt (only terminal reviews).
    expect(screen.queryByText(/Duyệt bởi:/)).not.toBeInTheDocument();
  });

  it('Sửa nháp button on draft footer navigates to edit route', async () => {
    vi.mocked(deadlineRulesApi.getById).mockResolvedValue({
      success: true,
      data: makeVersion({ status: 'draft', proposedById: 'user-self' }),
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-edit-draft')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-edit-draft'));
    await waitFor(() => expect(screen.getByText('OTHER')).toBeInTheDocument());
  });

  it('shows withdraw-notes-card on draft after a withdraw', async () => {
    vi.mocked(deadlineRulesApi.getById).mockResolvedValue({
      success: true,
      data: makeVersion({
        status: 'draft',
        proposedById: 'user-self',
        withdrawNotes: 'Cần sửa giá trị theo TT mới',
      }),
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('withdraw-notes-card')).toBeInTheDocument());
    expect(screen.getByText(/Cần sửa giá trị theo TT mới/)).toBeInTheDocument();
  });
});
