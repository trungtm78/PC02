import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ApprovalQueuePage from '../ApprovalQueuePage';
import { deadlineRulesApi } from '@/features/deadline-rules/api';
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

function makeVersion(overrides: Partial<DeadlineRuleVersion> = {}): DeadlineRuleVersion {
  return {
    id: 'v1',
    ruleKey: 'THOI_HAN_XAC_MINH',
    value: 25,
    label: 'Thời hạn',
    legalBasis: 'Điều 147',
    documentType: 'TT',
    documentNumber: '28/2020',
    documentIssuer: 'BCA',
    documentDate: null,
    attachmentId: null,
    migrationConfidence: null,
    reason: 'Some reason',
    status: 'submitted',
    effectiveFrom: null,
    effectiveTo: null,
    supersedesId: null,
    proposedById: 'u1',
    proposedByType: 'USER',
    proposedAt: new Date().toISOString(),
    reviewedById: null,
    reviewedAt: null,
    reviewNotes: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    proposedBy: { id: 'u1', firstName: 'Nguyen', lastName: 'A', username: 'nguyena' },
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ApprovalQueuePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ApprovalQueuePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "inbox-zero" empty state when no submissions', async () => {
    vi.mocked(deadlineRulesApi.getApprovalQueue).mockResolvedValue({ success: true, data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('queue-empty')).toBeInTheDocument();
    });
  });

  it('buckets versions by age', async () => {
    const now = Date.now();
    const fresh = makeVersion({ id: 'fresh', proposedAt: new Date(now - 1 * 3600 * 1000).toISOString() });
    const pending = makeVersion({ id: 'pending', proposedAt: new Date(now - 36 * 3600 * 1000).toISOString() });
    const overdue = makeVersion({ id: 'overdue', proposedAt: new Date(now - 96 * 3600 * 1000).toISOString() });
    vi.mocked(deadlineRulesApi.getApprovalQueue).mockResolvedValue({
      success: true,
      data: [fresh, pending, overdue],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('bucket-new')).toBeInTheDocument();
    });
    expect(screen.getByTestId('bucket-pending')).toBeInTheDocument();
    expect(screen.getByTestId('bucket-overdue')).toBeInTheDocument();
    expect(screen.getByTestId('queue-card-fresh')).toBeInTheDocument();
    expect(screen.getByTestId('queue-card-pending')).toBeInTheDocument();
    expect(screen.getByTestId('queue-card-overdue')).toBeInTheDocument();
  });

  it('overdue section uses red theme', async () => {
    const overdue = makeVersion({ id: 'old', proposedAt: new Date(Date.now() - 96 * 3600 * 1000).toISOString() });
    vi.mocked(deadlineRulesApi.getApprovalQueue).mockResolvedValue({ success: true, data: [overdue] });

    renderPage();

    await waitFor(() => {
      const overdueBucket = screen.getByTestId('bucket-overdue');
      expect(overdueBucket.querySelector('.text-red-800')).toBeTruthy();
    });
  });
});
