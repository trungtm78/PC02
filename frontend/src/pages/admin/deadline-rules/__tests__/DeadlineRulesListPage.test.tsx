import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import DeadlineRulesListPage from '../DeadlineRulesListPage';
import { deadlineRulesApi } from '@/features/deadline-rules/api';

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

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DeadlineRulesListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DeadlineRulesListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders summary strip with all four cards', async () => {
    vi.mocked(deadlineRulesApi.listActive).mockResolvedValue({ success: true, data: [] });
    vi.mocked(deadlineRulesApi.getSummary).mockResolvedValue({
      success: true,
      data: { active: 12, submitted: 2, approvedPending: 1, needsDocumentation: 3 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('summary-strip')).toBeInTheDocument();
    });
    expect(screen.getByTestId('summary-card-green')).toBeInTheDocument();
    expect(screen.getByTestId('summary-card-blue')).toBeInTheDocument();
    expect(screen.getByTestId('summary-card-violet')).toBeInTheDocument();
    expect(screen.getByTestId('summary-card-amber')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument(); // active count
  });

  it('renders rule rows from API', async () => {
    vi.mocked(deadlineRulesApi.listActive).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'v1',
          ruleKey: 'THOI_HAN_XAC_MINH',
          value: 20,
          label: 'Thời hạn xác minh',
          legalBasis: 'Điều 147 BLTTHS',
          documentType: 'BLTTHS',
          documentNumber: '101/2015',
          documentIssuer: 'Quốc hội',
          documentDate: null,
          attachmentId: null,
          migrationConfidence: null,
          reason: 'Seed',
          status: 'active',
          effectiveFrom: '2024-01-01T00:00:00.000Z',
          effectiveTo: null,
          supersedesId: null,
          proposedById: null,
          proposedByType: 'SYSTEM',
          proposedAt: '2024-01-01T00:00:00.000Z',
          reviewedById: null,
          reviewedAt: null,
          reviewNotes: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
    });
    vi.mocked(deadlineRulesApi.getSummary).mockResolvedValue({
      success: true,
      data: { active: 1, submitted: 0, approvedPending: 0, needsDocumentation: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('rule-row-THOI_HAN_XAC_MINH')).toBeInTheDocument();
    });
    expect(screen.getByText('Thời hạn xác minh ban đầu')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('shows approval queue badge when submitted > 0', async () => {
    vi.mocked(deadlineRulesApi.listActive).mockResolvedValue({ success: true, data: [] });
    vi.mocked(deadlineRulesApi.getSummary).mockResolvedValue({
      success: true,
      data: { active: 12, submitted: 5, approvedPending: 0, needsDocumentation: 0 },
    });

    renderPage();

    await waitFor(() => {
      const queueLink = screen.getByTestId('link-approval-queue');
      expect(queueLink).toHaveTextContent('5');
    });
  });

  it('shows migration-cleanup link when needsDocumentation > 0', async () => {
    vi.mocked(deadlineRulesApi.listActive).mockResolvedValue({ success: true, data: [] });
    vi.mocked(deadlineRulesApi.getSummary).mockResolvedValue({
      success: true,
      data: { active: 12, submitted: 0, approvedPending: 0, needsDocumentation: 4 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('link-migration-cleanup')).toHaveTextContent('4');
    });
  });

  it('hides migration-cleanup link when needsDocumentation = 0', async () => {
    vi.mocked(deadlineRulesApi.listActive).mockResolvedValue({ success: true, data: [] });
    vi.mocked(deadlineRulesApi.getSummary).mockResolvedValue({
      success: true,
      data: { active: 12, submitted: 0, approvedPending: 0, needsDocumentation: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByTestId('link-migration-cleanup')).toBeNull();
    });
  });
});
