import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ReportSubmissionReviewPage from '../ReportSubmissionReviewPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { SubmissionView } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    getSubmissionForManager: vi.fn(),
    approveSubmission: vi.fn(),
    returnSubmission: vi.fn(),
    unapproveSubmission: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/bao-cao-dong/duyet/assign1']}>
        <Routes>
          <Route path="/bao-cao-dong/duyet/:assignmentId" element={<ReportSubmissionReviewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const SUBMITTED_VIEW: SubmissionView = {
  assignmentId: 'assign1',
  reportName: 'HSLN',
  periodKey: '2026-10',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  opensAt: '2026-10-01T00:00:00.000Z',
  dueAt: '2026-11-05T17:00:00.000Z',
  state: 'SUBMITTED',
  revision: '2',
  values: { 'Đội 3!C6': { t: 'NUM', v: '5' } },
  fields: [
    {
      fieldKey: 'Đội 3!C6',
      sheetKey: 'Đội 3',
      address: 'C6',
      label: 'Số vụ mới',
      type: 'NUM',
      format: null,
      aggregate: 'SUM',
      required: false,
      min: null,
      max: null,
      scale: null,
      maxLength: null,
    },
  ],
  editable: false,
  effectiveLockAt: null,
  serverTime: '2026-10-10T10:00:00.000Z',
};

describe('ReportSubmissionReviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders field values read-only, grouped by sheet', async () => {
    vi.mocked(dynamicReportsApi.getSubmissionForManager).mockResolvedValue(SUBMITTED_VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('value-Đội 3!C6'));
    expect(screen.getByTestId('value-Đội 3!C6')).toHaveTextContent('5');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('approves after confirmation and refetches', async () => {
    vi.mocked(dynamicReportsApi.getSubmissionForManager).mockResolvedValue(SUBMITTED_VIEW);
    vi.mocked(dynamicReportsApi.approveSubmission).mockResolvedValue({
      revision: '3',
      state: 'APPROVED',
      savedAt: '2026-10-10T10:01:00.000Z',
      serverTime: '2026-10-10T10:01:00.000Z',
      effectiveLockAt: null,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-approve'));
    fireEvent.click(screen.getByTestId('btn-approve'));

    await waitFor(() => {
      expect(dynamicReportsApi.approveSubmission).toHaveBeenCalledWith('assign1', '2');
    });
    confirmSpy.mockRestore();
  });

  it('does not approve when the confirmation dialog is declined', async () => {
    vi.mocked(dynamicReportsApi.getSubmissionForManager).mockResolvedValue(SUBMITTED_VIEW);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-approve'));
    fireEvent.click(screen.getByTestId('btn-approve'));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(dynamicReportsApi.approveSubmission).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('submits a return with reason and returnDueAt via the inline form', async () => {
    vi.mocked(dynamicReportsApi.getSubmissionForManager).mockResolvedValue(SUBMITTED_VIEW);
    vi.mocked(dynamicReportsApi.returnSubmission).mockResolvedValue({
      revision: '3',
      state: 'RETURNED',
      savedAt: '2026-10-10T10:01:00.000Z',
      serverTime: '2026-10-10T10:01:00.000Z',
      effectiveLockAt: '2026-10-20T17:00:00.000Z',
    });
    renderPage();

    await waitFor(() => screen.getByTestId('btn-show-return'));
    fireEvent.click(screen.getByTestId('btn-show-return'));

    fireEvent.change(screen.getByTestId('return-reason-input'), {
      target: { value: 'Thiếu số liệu tổ 3' },
    });
    fireEvent.change(screen.getByTestId('return-due-at-input'), {
      target: { value: '2026-10-20T17:00' },
    });
    fireEvent.click(screen.getByTestId('btn-submit-return'));

    await waitFor(() => {
      expect(dynamicReportsApi.returnSubmission).toHaveBeenCalledWith(
        'assign1',
        '2',
        'Thiếu số liệu tổ 3',
        new Date('2026-10-20T17:00').toISOString(),
      );
    });
  });

  it('shows a validation error instead of calling the API when the return reason is blank', async () => {
    vi.mocked(dynamicReportsApi.getSubmissionForManager).mockResolvedValue(SUBMITTED_VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-show-return'));
    fireEvent.click(screen.getByTestId('btn-show-return'));
    fireEvent.change(screen.getByTestId('return-due-at-input'), {
      target: { value: '2026-10-20T17:00' },
    });
    fireEvent.click(screen.getByTestId('btn-submit-return'));

    await waitFor(() => screen.getByTestId('action-error'));
    expect(dynamicReportsApi.returnSubmission).not.toHaveBeenCalled();
  });

  it('shows the unapprove button for an APPROVED submission and calls the API on confirm', async () => {
    vi.mocked(dynamicReportsApi.getSubmissionForManager).mockResolvedValue({
      ...SUBMITTED_VIEW,
      state: 'APPROVED',
    });
    vi.mocked(dynamicReportsApi.unapproveSubmission).mockResolvedValue({
      revision: '3',
      state: 'SUBMITTED',
      savedAt: '2026-10-10T10:01:00.000Z',
      serverTime: '2026-10-10T10:01:00.000Z',
      effectiveLockAt: null,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-unapprove'));
    fireEvent.click(screen.getByTestId('btn-unapprove'));

    await waitFor(() => {
      expect(dynamicReportsApi.unapproveSubmission).toHaveBeenCalledWith('assign1', '2');
    });
    confirmSpy.mockRestore();
  });

  it('shows a "chưa nộp" note and no action buttons for a DRAFT submission', async () => {
    vi.mocked(dynamicReportsApi.getSubmissionForManager).mockResolvedValue({
      ...SUBMITTED_VIEW,
      state: 'DRAFT',
    });
    renderPage();

    await waitFor(() => screen.getByTestId('not-yet-submitted-note'));
    expect(screen.queryByTestId('btn-approve')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-unapprove')).not.toBeInTheDocument();
  });

  it('renders the revision history with Vietnamese action labels, actor, and reason (S16)', async () => {
    vi.mocked(dynamicReportsApi.getSubmissionForManager).mockResolvedValue({
      ...SUBMITTED_VIEW,
      history: [
        {
          revision: '1',
          kind: 'SUBMIT',
          actorName: 'Nguyễn Văn A',
          reason: null,
          committedAt: '2026-10-09T08:00:00.000Z',
        },
        {
          revision: '2',
          kind: 'RETURN',
          actorName: 'Trần Thị B',
          reason: 'Thiếu số liệu',
          committedAt: '2026-10-10T08:00:00.000Z',
        },
      ],
    });
    renderPage();

    await waitFor(() => screen.getByTestId('history-list'));
    expect(screen.getByTestId('history-entry-1')).toHaveTextContent('Nộp');
    expect(screen.getByTestId('history-entry-1')).toHaveTextContent('Nguyễn Văn A');
    expect(screen.getByTestId('history-entry-2')).toHaveTextContent('Trả lại');
    expect(screen.getByTestId('history-entry-2')).toHaveTextContent('Thiếu số liệu');
  });

  it('does not render the history section when there is no history', async () => {
    vi.mocked(dynamicReportsApi.getSubmissionForManager).mockResolvedValue(SUBMITTED_VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-approve'));
    expect(screen.queryByTestId('history-list')).not.toBeInTheDocument();
  });

  it('shows the reopen deadline note when effectiveLockAt differs from the original dueAt', async () => {
    vi.mocked(dynamicReportsApi.getSubmissionForManager).mockResolvedValue({
      ...SUBMITTED_VIEW,
      state: 'RETURNED',
      effectiveLockAt: '2026-11-08T12:00:00.000Z',
    });
    renderPage();

    await waitFor(() => screen.getByTestId('reopen-deadline-note'));
    expect(screen.getByTestId('reopen-deadline-note')).toHaveTextContent('mở lại');
  });

  it('does not show the reopen deadline note when effectiveLockAt equals the original dueAt', async () => {
    vi.mocked(dynamicReportsApi.getSubmissionForManager).mockResolvedValue({
      ...SUBMITTED_VIEW,
      effectiveLockAt: SUBMITTED_VIEW.dueAt,
    });
    renderPage();

    await waitFor(() => screen.getByTestId('btn-approve'));
    expect(screen.queryByTestId('reopen-deadline-note')).not.toBeInTheDocument();
  });
});
