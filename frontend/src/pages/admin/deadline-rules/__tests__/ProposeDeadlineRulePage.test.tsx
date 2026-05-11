import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProposeDeadlineRulePage from '../ProposeDeadlineRulePage';
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

function renderPage(ruleKey = 'THOI_HAN_XAC_MINH') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/admin/deadline-rules/${ruleKey}/propose`]}>
        <Routes>
          <Route path="/admin/deadline-rules/:key/propose" element={<ProposeDeadlineRulePage />} />
          <Route path="/admin/deadline-rules/edit/:id" element={<ProposeDeadlineRulePage />} />
          <Route path="*" element={<div>OTHER</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderEditPage(versionId = 'v-edit') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/admin/deadline-rules/edit/${versionId}`]}>
        <Routes>
          <Route path="/admin/deadline-rules/:key/propose" element={<ProposeDeadlineRulePage />} />
          <Route path="/admin/deadline-rules/edit/:id" element={<ProposeDeadlineRulePage />} />
          <Route path="*" element={<div>OTHER</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProposeDeadlineRulePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deadlineRulesApi.listActive).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'v0',
          ruleKey: 'THOI_HAN_XAC_MINH',
          value: 20,
          label: 'Thời hạn xác minh',
          legalBasis: 'Điều 147 BLTTHS',
          documentType: 'BLTTHS',
          documentNumber: '101/2015',
          documentIssuer: 'Quốc hội',
          documentDate: null,
          documentUrl: null,
          withdrawNotes: null,
          attachmentId: null,
          migrationConfidence: null,
          reason: 'Initial',
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
  });

  it('pre-fills value, label, legalBasis from current active version', async () => {
    renderPage();
    await waitFor(() => {
      const valueInput = screen.getByTestId('input-value') as HTMLInputElement;
      expect(valueInput.value).toBe('20');
    });
    const labelInput = screen.getByTestId('input-label') as HTMLInputElement;
    expect(labelInput.value).toBe('Thời hạn xác minh');
  });

  it('rejects submit when reason is too short (< 20 chars)', async () => {
    renderPage();
    // Wait for the page to preload from the active version
    await waitFor(() => {
      const v = screen.getByTestId('input-value') as HTMLInputElement;
      expect(v.value).toBe('20');
    });
    // Fill all earlier required fields (validate fails on the first missing one)
    fireEvent.change(screen.getByTestId('input-doc-number'), { target: { value: '28/2020' } });
    fireEvent.change(screen.getByTestId('input-reason'), { target: { value: 'short' } });
    fireEvent.click(screen.getByTestId('btn-submit'));
    await waitFor(() => {
      expect(screen.getByText(/ít nhất 20 ký tự/)).toBeInTheDocument();
    });
    expect(vi.mocked(deadlineRulesApi.propose)).not.toHaveBeenCalled();
  });

  it('rejects submit when value is invalid', async () => {
    renderPage();
    await waitFor(() => {
      const v = screen.getByTestId('input-value') as HTMLInputElement;
      expect(v.value).toBe('20');
    });
    // Set invalid value, fill the rest so we hit the value check specifically
    fireEvent.change(screen.getByTestId('input-value'), { target: { value: '0' } });
    fireEvent.change(screen.getByTestId('input-doc-number'), { target: { value: '28/2020' } });
    fireEvent.change(screen.getByTestId('input-reason'), {
      target: { value: 'A valid long reason for this audit trail purpose' },
    });
    fireEvent.click(screen.getByTestId('btn-submit'));
    await waitFor(() => {
      expect(screen.getByText(/số nguyên dương/)).toBeInTheDocument();
    });
  });

  it('calls API.propose + API.submit when "Gửi duyệt ngay" clicked', async () => {
    vi.mocked(deadlineRulesApi.propose).mockResolvedValue({
      success: true,
      data: { id: 'new-v', ruleKey: 'THOI_HAN_XAC_MINH', value: 25 } as never,
    });
    vi.mocked(deadlineRulesApi.submit).mockResolvedValue({
      success: true,
      data: { id: 'new-v', status: 'submitted' } as never,
    });

    renderPage();
    await waitFor(() => screen.getByTestId('input-value'));
    fireEvent.change(screen.getByTestId('input-value'), { target: { value: '25' } });
    fireEvent.change(screen.getByTestId('input-doc-number'), { target: { value: '28/2020' } });
    fireEvent.change(screen.getByTestId('input-reason'), {
      target: { value: 'Cập nhật theo Thông tư 28/2020/TT-BCA Điều 11 — long enough for audit trail' },
    });
    fireEvent.click(screen.getByTestId('btn-submit'));

    await waitFor(() => {
      expect(vi.mocked(deadlineRulesApi.propose)).toHaveBeenCalled();
      expect(vi.mocked(deadlineRulesApi.submit)).toHaveBeenCalledWith('new-v');
    });
  });

  it('calls API.propose but NOT API.submit when "Lưu nháp" clicked', async () => {
    vi.mocked(deadlineRulesApi.propose).mockResolvedValue({
      success: true,
      data: { id: 'draft-v', ruleKey: 'THOI_HAN_XAC_MINH', value: 25 } as never,
    });

    renderPage();
    await waitFor(() => screen.getByTestId('input-value'));
    fireEvent.change(screen.getByTestId('input-value'), { target: { value: '25' } });
    fireEvent.change(screen.getByTestId('input-doc-number'), { target: { value: '28/2020' } });
    fireEvent.change(screen.getByTestId('input-reason'), {
      target: { value: 'Cập nhật theo Thông tư 28/2020/TT-BCA Điều 11 — long enough for audit trail' },
    });
    fireEvent.click(screen.getByTestId('btn-save-draft'));

    await waitFor(() => {
      expect(vi.mocked(deadlineRulesApi.propose)).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(deadlineRulesApi.submit)).not.toHaveBeenCalled();
  });

  it('shows inline field errors + summary block when validation fails on click', async () => {
    renderPage();
    // Wait for the active-rule preload effect to settle before clearing fields,
    // otherwise the useEffect overwrites our cleared value after fireEvent.change.
    await waitFor(() => {
      const labelInput = screen.getByTestId('input-label') as HTMLInputElement;
      expect(labelInput.value).toBe('Thời hạn xác minh');
    });
    // Clear the preloaded label so it fails along with doc-number + short reason —
    // proves the silent-click bug is dead: multiple errors render at once near the button.
    fireEvent.change(screen.getByTestId('input-label'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('input-doc-number'), { target: { value: '' } });
    fireEvent.change(screen.getByTestId('input-reason'), { target: { value: 'short' } });
    fireEvent.click(screen.getByTestId('btn-save-draft'));

    await waitFor(() => {
      expect(screen.getByTestId('error-label')).toBeInTheDocument();
    });
    expect(screen.getByTestId('error-doc-number')).toBeInTheDocument();
    expect(screen.getByTestId('error-reason')).toBeInTheDocument();
    expect(screen.getByTestId('form-error-summary')).toBeInTheDocument();
    expect(vi.mocked(deadlineRulesApi.propose)).not.toHaveBeenCalled();
  });

  it('clears field error when user fixes the input', async () => {
    renderPage();
    await waitFor(() => {
      const labelInput = screen.getByTestId('input-label') as HTMLInputElement;
      expect(labelInput.value).toBe('Thời hạn xác minh');
    });
    fireEvent.change(screen.getByTestId('input-reason'), { target: { value: 'short' } });
    fireEvent.change(screen.getByTestId('input-doc-number'), { target: { value: '28/2020' } });
    fireEvent.click(screen.getByTestId('btn-save-draft'));
    await waitFor(() => {
      expect(screen.getByTestId('error-reason')).toBeInTheDocument();
    });
    // User starts typing a longer reason — the per-field error should disappear immediately.
    fireEvent.change(screen.getByTestId('input-reason'), { target: { value: 'now this reason is long enough for audit purposes' } });
    expect(screen.queryByTestId('error-reason')).not.toBeInTheDocument();
  });
});

describe('ProposeDeadlineRulePage — edit mode (/admin/deadline-rules/edit/:id)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupEditVersion(overrides: Record<string, unknown> = {}) {
    vi.mocked(deadlineRulesApi.getById).mockResolvedValue({
      success: true,
      data: {
        id: 'v-edit',
        ruleKey: 'THOI_HAN_XAC_MINH',
        value: 30,
        label: 'Thời hạn xác minh — sửa',
        legalBasis: 'Điều 147 BLTTHS sửa đổi',
        documentType: 'TT',
        documentNumber: '99/2026',
        documentIssuer: 'BCA',
        documentDate: null,
        documentUrl: null,
        withdrawNotes: null,
        attachmentId: null,
        migrationConfidence: null,
        reason: 'Lý do đầy đủ cho audit log',
        status: 'draft',
        effectiveFrom: null,
        effectiveTo: null,
        supersedesId: null,
        proposedById: 'user-self',
        proposedByType: 'USER',
        proposedAt: '2026-05-01T00:00:00.000Z',
        reviewedById: null,
        reviewedAt: null,
        reviewNotes: null,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
        ...overrides,
      } as never,
    });
  }

  it('prefills form from getById and shows edit-mode title', async () => {
    setupEditVersion();
    renderEditPage();
    await waitFor(() => {
      expect(screen.getByTestId('page-title').textContent).toBe('Sửa bản nháp đề xuất');
    });
    expect((screen.getByTestId('input-value') as HTMLInputElement).value).toBe('30');
    expect((screen.getByTestId('input-label') as HTMLInputElement).value).toBe('Thời hạn xác minh — sửa');
    expect((screen.getByTestId('input-doc-number') as HTMLInputElement).value).toBe('99/2026');
  });

  it('btn-save-draft in edit mode calls updateDraft (NOT propose)', async () => {
    setupEditVersion();
    vi.mocked(deadlineRulesApi.updateDraft).mockResolvedValue({
      success: true,
      data: { id: 'v-edit', ruleKey: 'THOI_HAN_XAC_MINH', value: 30 } as never,
    });
    renderEditPage();
    await waitFor(() => expect(screen.getByTestId('input-value')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-save-draft'));
    await waitFor(() => {
      expect(vi.mocked(deadlineRulesApi.updateDraft)).toHaveBeenCalledWith('v-edit', expect.any(Object));
    });
    expect(vi.mocked(deadlineRulesApi.propose)).not.toHaveBeenCalled();
  });

  it('btn-submit in edit mode calls updateDraft + submit in sequence', async () => {
    setupEditVersion();
    vi.mocked(deadlineRulesApi.updateDraft).mockResolvedValue({
      success: true,
      data: { id: 'v-edit', ruleKey: 'THOI_HAN_XAC_MINH', value: 30 } as never,
    });
    vi.mocked(deadlineRulesApi.submit).mockResolvedValue({
      success: true,
      data: { id: 'v-edit', status: 'submitted' } as never,
    });
    renderEditPage();
    await waitFor(() => expect(screen.getByTestId('input-value')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-submit'));
    await waitFor(() => {
      expect(vi.mocked(deadlineRulesApi.updateDraft)).toHaveBeenCalled();
      expect(vi.mocked(deadlineRulesApi.submit)).toHaveBeenCalledWith('v-edit');
    });
    expect(vi.mocked(deadlineRulesApi.propose)).not.toHaveBeenCalled();
  });

  it('shows request-changes banner when version.reviewNotes is set', async () => {
    setupEditVersion({ reviewNotes: 'Cần bổ sung BLTTHS Điều 147 khoản 2', reviewedById: 'approver-x' });
    renderEditPage();
    await waitFor(() => {
      expect(screen.getByTestId('request-changes-banner')).toBeInTheDocument();
    });
    expect(screen.getByText(/Cần bổ sung BLTTHS Điều 147 khoản 2/)).toBeInTheDocument();
  });

  it('redirects to /version/:id when loaded version is not a draft (bookmark protection)', async () => {
    setupEditVersion({ status: 'submitted' });
    renderEditPage();
    // Page navigates away (replace) — propose form should not render at all.
    await waitFor(() => expect(screen.getByText('OTHER')).toBeInTheDocument());
    expect(screen.queryByTestId('page-title')).not.toBeInTheDocument();
  });
});
