import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, createEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SubmissionInputPage from '../SubmissionInputPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { SubmissionView } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    getSubmission: vi.fn(),
    saveSubmissionValues: vi.fn(),
    submitSubmission: vi.fn(),
    validateForSubmit: vi.fn(),
    requestUnlock: vi.fn(),
    withdrawUnlockRequest: vi.fn(),
    previewExcelImport: vi.fn(),
    applyExcelImport: vi.fn(),
    exportOwnSubmission: vi.fn(),
    listComments: vi.fn(),
    addComment: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/bao-cao-dong/nhap/assign1']}>
        <Routes>
          <Route path="/bao-cao-dong/nhap/:assignmentId" element={<SubmissionInputPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const VIEW: SubmissionView = {
  assignmentId: 'assign1',
  versionId: 'version1',
  reportName: 'HSLN',
  periodKey: '2026-10',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  opensAt: '2026-10-01T00:00:00.000Z',
  dueAt: '2026-11-05T17:00:00.000Z',
  state: 'DRAFT',
  revision: '1',
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
    {
      fieldKey: 'Đội 3!C7',
      sheetKey: 'Đội 3',
      address: 'C7',
      label: 'Số vụ đã giải quyết',
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
  editable: true,
  effectiveLockAt: '2026-11-05T17:00:00.000Z',
  serverTime: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-09T08:30:00.000Z',
};

describe('SubmissionInputPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // S36 (PR9 slice 1) — handleSubmit always calls this first; default to
    // "no violations" so every pre-existing submit test still reaches the
    // normal confirm/submit flow unchanged.
    vi.mocked(dynamicReportsApi.validateForSubmit).mockResolvedValue({
      errors: [],
      warnings: [],
    });
    vi.mocked(dynamicReportsApi.listComments).mockResolvedValue([]);
  });

  it('renders fields grouped by sheet, prefilled from the current submission values', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
    expect(screen.getByText('Đội 3')).toBeInTheDocument();
    expect(screen.getByTestId('input-Đội 3!C6')).toHaveValue('5');
    // effectiveLockAt === dueAt here — a normal open period, not a reopen grant.
    expect(screen.queryByTestId('reopened-banner')).not.toBeInTheDocument();
  });

  it('"Xuất Excel" calls exportOwnSubmission with the current assignmentId', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.exportOwnSubmission).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-export-own-submission'));
    fireEvent.click(screen.getByTestId('btn-export-own-submission'));

    await waitFor(() => {
      expect(dynamicReportsApi.exportOwnSubmission).toHaveBeenCalledWith('assign1');
    });
  });

  it('"Xuất Excel" stays available even when the submission is read-only (past the deadline)', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue({
      ...VIEW,
      editable: false,
    });
    vi.mocked(dynamicReportsApi.exportOwnSubmission).mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-export-own-submission'));
    expect(screen.getByTestId('btn-export-own-submission')).not.toBeDisabled();
  });

  it('saves on blur with the typed value and the current revision, then updates to the new revision', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.saveSubmissionValues).mockResolvedValue({
      revision: '2',
      state: 'DRAFT',
      savedAt: '2026-10-10T10:00:01.000Z',
      serverTime: '2026-10-10T10:00:01.000Z',
      effectiveLockAt: '2026-11-05T17:00:00.000Z',
    });
    renderPage();

    await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
    const input = screen.getByTestId('input-Đội 3!C6');
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledWith(
        'assign1',
        { 'Đội 3!C6': '12' },
        '1',
        expect.any(String),
      );
    });
    await waitFor(() => screen.getByText('Đã lưu'));
  });

  it('shows a locked banner and disables inputs when not editable', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue({
      ...VIEW,
      editable: false,
    });
    renderPage();

    await waitFor(() => screen.getByTestId('locked-banner'));
    expect(screen.getByTestId('input-Đội 3!C6')).toBeDisabled();
  });

  it('sends an unlock request with the prompted reason and shows a pending confirmation', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue({
      ...VIEW,
      editable: false,
    });
    vi.mocked(dynamicReportsApi.requestUnlock).mockResolvedValue({
      id: 'req1',
      assignmentId: 'assign1',
      reportName: 'HSLN',
      periodKey: '2026-10',
      teamName: 'Đội 3',
      reason: 'Nhập nhầm số',
      requestedAt: '2026-10-10T10:00:00.000Z',
      requestedByName: 'Văn Nguyễn',
    });
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Nhập nhầm số');
    renderPage();

    await waitFor(() => screen.getByTestId('btn-request-unlock'));
    fireEvent.click(screen.getByTestId('btn-request-unlock'));

    await waitFor(() => {
      expect(dynamicReportsApi.requestUnlock).toHaveBeenCalledWith('assign1', 'Nhập nhầm số');
    });
    await waitFor(() => screen.getByTestId('unlock-request-sent'));
    promptSpy.mockRestore();
  });

  it('a request that was sent can be taken back while it waits; the "Xin mở lại" button comes back', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue({ ...VIEW, editable: false });
    vi.mocked(dynamicReportsApi.requestUnlock).mockResolvedValue({
      id: 'req1', assignmentId: 'assign1', reportName: 'HSLN', periodKey: '2026-10', teamName: 'Đội 3',
      reason: 'Nhập nhầm số', requestedAt: '2026-10-10T10:00:00.000Z', requestedByName: 'Văn Nguyễn',
    });
    vi.mocked(dynamicReportsApi.withdrawUnlockRequest).mockResolvedValue({ withdrawn: true });
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('Nhập nhầm số');
    renderPage();

    fireEvent.click(await screen.findByTestId('btn-request-unlock'));
    await screen.findByTestId('unlock-request-sent');
    fireEvent.click(screen.getByTestId('btn-withdraw-unlock'));

    await waitFor(() => expect(dynamicReportsApi.withdrawUnlockRequest).toHaveBeenCalledWith('assign1'));
    await screen.findByTestId('btn-request-unlock');
    expect(screen.queryByTestId('unlock-request-sent')).not.toBeInTheDocument();
    promptSpy.mockRestore();
  });

  it('a request made on an earlier visit shows as waiting at once, with the way to take it back', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue({
      ...VIEW,
      editable: false,
      pendingUnlockRequest: { id: 'req0', reason: 'Nhập nhầm', createdAt: '2026-10-09T10:00:00.000Z' },
    });
    renderPage();

    await screen.findByTestId('unlock-request-sent');
    expect(screen.getByTestId('btn-withdraw-unlock')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-request-unlock')).not.toBeInTheDocument();
  });

  it('when taking it back is refused (already decided) the reason is shown and the request still shows as sent', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue({
      ...VIEW,
      editable: false,
      pendingUnlockRequest: { id: 'req0', reason: 'x', createdAt: '2026-10-09T10:00:00.000Z' },
    });
    vi.mocked(dynamicReportsApi.withdrawUnlockRequest).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error: { message: 'Không còn yêu cầu mở lại nào đang chờ để rút lại.' } } },
    });
    renderPage();

    fireEvent.click(await screen.findByTestId('btn-withdraw-unlock'));
    expect(await screen.findByTestId('unlock-request-error')).toHaveTextContent('Không còn yêu cầu');
    expect(screen.getByTestId('unlock-request-sent')).toBeInTheDocument();
  });

  it('does not send an unlock request when the reason prompt is cancelled', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue({
      ...VIEW,
      editable: false,
    });
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue(null);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-request-unlock'));
    fireEvent.click(screen.getByTestId('btn-request-unlock'));

    await waitFor(() => expect(promptSpy).toHaveBeenCalled());
    expect(dynamicReportsApi.requestUnlock).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('shows an error message when the unlock request fails', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue({
      ...VIEW,
      editable: false,
    });
    vi.mocked(dynamicReportsApi.requestUnlock).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: { error: { message: 'Đã có yêu cầu mở lại đang chờ duyệt cho lượt giao này.' } },
      },
    });
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('r');
    renderPage();

    await waitFor(() => screen.getByTestId('btn-request-unlock'));
    fireEvent.click(screen.getByTestId('btn-request-unlock'));

    await waitFor(() => screen.getByTestId('unlock-request-error'));
    promptSpy.mockRestore();
  });

  it('shows a side-by-side conflict dialog on REVISION_CONFLICT (409) during autosave (S26)', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.saveSubmissionValues).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { error: { code: 'REVISION_CONFLICT', message: 'conflict' } },
      },
    });
    renderPage();

    await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
    const input = screen.getByTestId('input-Đội 3!C6');
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.blur(input);

    await waitFor(() => screen.getByTestId('conflict-dialog'));
    expect(screen.getByTestId('conflict-row-Đội 3!C6')).toHaveTextContent('12');
    expect(screen.getByTestId('conflict-row-Đội 3!C6')).toHaveTextContent('5'); // server's current value from VIEW
    expect(screen.getByTestId('btn-conflict-keep-mine')).toBeInTheDocument();
    expect(screen.getByTestId('btn-conflict-use-server')).toBeInTheDocument();
  });

  it('conflict dialog "Giữ bản của tôi" retries the save against the server\'s new revision', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.saveSubmissionValues)
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 409,
          data: { error: { code: 'REVISION_CONFLICT', message: 'conflict' } },
        },
      })
      .mockResolvedValueOnce({
        revision: '2',
        state: 'DRAFT',
        savedAt: '2026-10-10T10:00:01.000Z',
        serverTime: '2026-10-10T10:00:01.000Z',
        effectiveLockAt: '2026-11-05T17:00:00.000Z',
      });
    renderPage();

    await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
    fireEvent.change(screen.getByTestId('input-Đội 3!C6'), { target: { value: '12' } });
    fireEvent.blur(screen.getByTestId('input-Đội 3!C6'));
    await waitFor(() => screen.getByTestId('conflict-dialog'));

    fireEvent.click(screen.getByTestId('btn-conflict-keep-mine'));

    await waitFor(() => {
      expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledTimes(2);
    });
    const secondCall = vi.mocked(dynamicReportsApi.saveSubmissionValues).mock.calls[1];
    expect(secondCall[2]).toBe('1'); // VIEW's server revision from getSubmission, used as the new expectedRevision
    expect(screen.queryByTestId('conflict-dialog')).not.toBeInTheDocument();
  });

  it('conflict dialog "Dùng bản trên máy chủ" discards the local edit and adopts the server value', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.saveSubmissionValues).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { error: { code: 'REVISION_CONFLICT', message: 'conflict' } },
      },
    });
    renderPage();

    await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
    fireEvent.change(screen.getByTestId('input-Đội 3!C6'), { target: { value: '12' } });
    fireEvent.blur(screen.getByTestId('input-Đội 3!C6'));
    await waitFor(() => screen.getByTestId('conflict-dialog'));

    fireEvent.click(screen.getByTestId('btn-conflict-use-server'));

    expect(screen.queryByTestId('conflict-dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('input-Đội 3!C6')).toHaveValue('5'); // falls back to VIEW's server value, local edit dropped
  });

  it('shows a retry button on a network error and resends the same request on retry (S26)', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.saveSubmissionValues)
      .mockRejectedValueOnce({ isAxiosError: true, response: undefined })
      .mockResolvedValueOnce({
        revision: '2',
        state: 'DRAFT',
        savedAt: '2026-10-10T10:00:01.000Z',
        serverTime: '2026-10-10T10:00:01.000Z',
        effectiveLockAt: '2026-11-05T17:00:00.000Z',
      });
    renderPage();

    await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
    fireEvent.change(screen.getByTestId('input-Đội 3!C6'), { target: { value: '12' } });
    fireEvent.blur(screen.getByTestId('input-Đội 3!C6'));

    await waitFor(() => screen.getByTestId('btn-retry-save'));
    expect(screen.getByTestId('save-error')).toHaveTextContent('Mất kết nối');

    fireEvent.click(screen.getByTestId('btn-retry-save'));

    await waitFor(() => {
      expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledTimes(2);
    });
    const [firstCall, secondCall] = vi.mocked(dynamicReportsApi.saveSubmissionValues).mock.calls;
    expect(secondCall[3]).toBe(firstCall[3]); // same idempotencyKey reused on retry
    await waitFor(() => screen.getByText('Đã lưu'));
  });

  it('shows a field-level error on CELL_VALIDATION (400)', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.saveSubmissionValues).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: { error: { code: 'CELL_VALIDATION', message: 'Ô "Đội 3!C6": không phải số hợp lệ.' } },
      },
    });
    renderPage();

    await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
    const input = screen.getByTestId('input-Đội 3!C6');
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);

    await waitFor(() => screen.getByTestId('save-error'));
    expect(screen.getByTestId('save-error')).toHaveTextContent('không phải số hợp lệ');
  });

  it('submits after confirmation and shows the "submitted" note instead of the button', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.submitSubmission).mockResolvedValue({
      revision: '2',
      state: 'SUBMITTED',
      savedAt: '2026-10-10T10:00:02.000Z',
      serverTime: '2026-10-10T10:00:02.000Z',
      effectiveLockAt: null,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-submit'));
    fireEvent.click(screen.getByTestId('btn-submit'));

    await waitFor(() => screen.getByTestId('submitted-note'));
    expect(dynamicReportsApi.submitSubmission).toHaveBeenCalledWith('assign1', '1');
    expect(screen.queryByTestId('btn-submit')).not.toBeInTheDocument();
    expect(screen.getByTestId('input-Đội 3!C6')).toBeDisabled();
    confirmSpy.mockRestore();
  });

  it('does not submit when the confirmation dialog is declined', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-submit'));
    fireEvent.click(screen.getByTestId('btn-submit'));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(dynamicReportsApi.submitSubmission).not.toHaveBeenCalled();
    expect(screen.getByTestId('btn-submit')).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('warns about blank optional fields before submitting when any are empty', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue({
      ...VIEW,
      values: {},
    });
    vi.mocked(dynamicReportsApi.submitSubmission).mockResolvedValue({
      revision: '2',
      state: 'SUBMITTED',
      savedAt: '2026-10-10T10:00:02.000Z',
      serverTime: '2026-10-10T10:00:02.000Z',
      effectiveLockAt: null,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-submit'));
    fireEvent.click(screen.getByTestId('btn-submit'));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('ô để trống sẽ tính là 0'),
      );
    });
    confirmSpy.mockRestore();
  });

  it('blocks "Nộp" and shows the rule list when validate returns ERROR violations (S36)', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.validateForSubmit).mockResolvedValue({
      errors: [
        { ruleId: 'r1', name: 'D10 phải khớp tổng', severity: 'ERROR', message: 'D10 không khớp D11+D12' },
      ],
      warnings: [],
    });
    const confirmSpy = vi.spyOn(window, 'confirm');
    renderPage();

    await waitFor(() => screen.getByTestId('btn-submit'));
    fireEvent.click(screen.getByTestId('btn-submit'));

    await waitFor(() => screen.getByTestId('rule-errors'));
    expect(screen.getByTestId('rule-errors')).toHaveTextContent('D10 không khớp D11+D12');
    expect(dynamicReportsApi.submitSubmission).not.toHaveBeenCalled();
    // Never even reaches the blank-optional/submit confirm dialogs.
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('shows a confirm dialog listing WARNING violations, proceeds to submit on confirm', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.validateForSubmit).mockResolvedValue({
      errors: [],
      warnings: [{ ruleId: 'r1', name: 'Cảnh báo nhẹ', severity: 'WARNING', message: 'Giá trị hơi bất thường' }],
    });
    vi.mocked(dynamicReportsApi.submitSubmission).mockResolvedValue({
      revision: '2',
      state: 'SUBMITTED',
      savedAt: '2026-10-10T10:00:02.000Z',
      serverTime: '2026-10-10T10:00:02.000Z',
      effectiveLockAt: null,
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-submit'));
    fireEvent.click(screen.getByTestId('btn-submit'));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Giá trị hơi bất thường'));
    });
    await waitFor(() => screen.getByTestId('submitted-note'));
    expect(dynamicReportsApi.submitSubmission).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('declining the WARNING confirm dialog never calls submit', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.validateForSubmit).mockResolvedValue({
      errors: [],
      warnings: [{ ruleId: 'r1', name: 'Cảnh báo nhẹ', severity: 'WARNING', message: 'Giá trị hơi bất thường' }],
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-submit'));
    fireEvent.click(screen.getByTestId('btn-submit'));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalled());
    expect(dynamicReportsApi.submitSubmission).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('shows a reload prompt when submit hits REVISION_CONFLICT', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.submitSubmission).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          error: {
            code: 'REVISION_CONFLICT',
            message: 'Bản nộp đã bị sửa bởi một phiên khác — tải lại để lấy bản mới nhất.',
          },
        },
      },
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-submit'));
    fireEvent.click(screen.getByTestId('btn-submit'));

    await waitFor(() => screen.getByTestId('btn-reload'));
    expect(screen.getByTestId('save-error')).toHaveTextContent('phiên khác');
    confirmSpy.mockRestore();
  });

  it('pastes a TSV block across fields in the same sheet and saves them in one batch', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.saveSubmissionValues).mockResolvedValue({
      revision: '2',
      state: 'DRAFT',
      savedAt: '2026-10-10T10:00:01.000Z',
      serverTime: '2026-10-10T10:00:01.000Z',
      effectiveLockAt: '2026-11-05T17:00:00.000Z',
    });
    renderPage();

    await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
    const input = screen.getByTestId('input-Đội 3!C6');
    const pasteEvent = createEvent.paste(input, {
      clipboardData: { getData: () => '12\n34' },
    });
    fireEvent(input, pasteEvent);

    await waitFor(() => {
      expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledWith(
        'assign1',
        { 'Đội 3!C6': '12', 'Đội 3!C7': '34' },
        '1',
        expect.any(String),
      );
    });
    expect(screen.getByTestId('input-Đội 3!C7')).toHaveValue('34');
  });

  it('rejects the whole paste batch when a targeted cell is not an input field', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
    const input = screen.getByTestId('input-Đội 3!C6');
    const pasteEvent = createEvent.paste(input, {
      // Tab shifts the second value to D6, which has no field — the whole
      // batch (including C6) must be rejected, not just D6.
      clipboardData: { getData: () => '12\t34' },
    });
    fireEvent(input, pasteEvent);

    await waitFor(() => screen.getByTestId('save-error'));
    expect(dynamicReportsApi.saveSubmissionValues).not.toHaveBeenCalled();
    expect(screen.getByTestId('input-Đội 3!C6')).toHaveValue('5');
  });

  it('rejects the whole paste batch when one pasted cell fails type validation', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    renderPage();

    await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
    const input = screen.getByTestId('input-Đội 3!C6');
    const pasteEvent = createEvent.paste(input, {
      clipboardData: { getData: () => '12\nabc' },
    });
    fireEvent(input, pasteEvent);

    await waitFor(() => screen.getByTestId('save-error'));
    expect(dynamicReportsApi.saveSubmissionValues).not.toHaveBeenCalled();
    expect(screen.getByTestId('input-Đội 3!C6')).toHaveValue('5');
    expect(screen.getByTestId('input-Đội 3!C7')).toHaveValue('');
  });

  it('switches to read-only with a "hết hạn" message when autosave hits REPORT_LOCKED (S12)', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.saveSubmissionValues).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { error: { code: 'REPORT_LOCKED', message: 'Kỳ đã khoá.' } },
      },
    });
    renderPage();

    await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
    const input = screen.getByTestId('input-Đội 3!C6');
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.blur(input);

    await waitFor(() => screen.getByTestId('save-error'));
    expect(screen.getByTestId('save-error')).toHaveTextContent('chưa được lưu do hết hạn');
    // The typed value stays visible — only the save was rejected, not the buffer.
    expect(screen.getByTestId('input-Đội 3!C6')).toHaveValue('12');
    expect(screen.getByTestId('input-Đội 3!C6')).toBeDisabled();
    expect(screen.getByTestId('locked-banner')).toBeInTheDocument();
  });

  it('switches to read-only with a "hết hạn" message when submit hits REPORT_LOCKED (S12)', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.submitSubmission).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { error: { code: 'REPORT_LOCKED', message: 'Kỳ đã khoá.' } },
      },
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();

    await waitFor(() => screen.getByTestId('btn-submit'));
    fireEvent.click(screen.getByTestId('btn-submit'));

    await waitFor(() => screen.getByTestId('save-error'));
    expect(screen.getByTestId('save-error')).toHaveTextContent('chưa được lưu do hết hạn');
    expect(screen.getByTestId('input-Đội 3!C6')).toBeDisabled();
    confirmSpy.mockRestore();
  });

  it('shows the reopened banner when effectiveLockAt extends past the original due date (S14)', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue({
      ...VIEW,
      state: 'RETURNED',
      effectiveLockAt: '2026-11-08T12:00:00.000Z',
    });
    renderPage();

    await waitFor(() => screen.getByTestId('reopened-banner'));
    expect(screen.getByTestId('reopened-banner')).toHaveTextContent('08/11/2026');
    // dueAt is 17:00 UTC on 05/11 — +7h VN offset rolls it to 06/11 local.
    expect(screen.getByTestId('reopened-banner')).toHaveTextContent('06/11/2026');
    expect(screen.getByTestId('input-Đội 3!C6')).not.toBeDisabled();
  });

  it('previews a diff after selecting an Excel file (S35)', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.previewExcelImport).mockResolvedValue({
      values: { 'Đội 3!C6': '12' },
      diff: [
        {
          fieldKey: 'Đội 3!C6',
          sheetKey: 'Đội 3',
          address: 'C6',
          label: 'Số vụ mới',
          current: '5',
          imported: '12',
        },
      ],
    });
    renderPage();

    await waitFor(() => screen.getByTestId('btn-import-excel'));
    const file = new File(['fake'], 'HSLN.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(screen.getByTestId('import-excel-input'), { target: { files: [file] } });

    await waitFor(() => screen.getByTestId('import-preview'));
    expect(dynamicReportsApi.previewExcelImport).toHaveBeenCalledWith('assign1', file);
    expect(screen.getByTestId('import-diff-row-Đội 3!C6')).toHaveTextContent('5 → 12');
  });

  it('applies the import, then clears the preview and updates the revision', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.previewExcelImport).mockResolvedValue({
      values: { 'Đội 3!C6': '12' },
      diff: [
        { fieldKey: 'Đội 3!C6', sheetKey: 'Đội 3', address: 'C6', label: 'Số vụ mới', current: '5', imported: '12' },
      ],
    });
    vi.mocked(dynamicReportsApi.applyExcelImport).mockResolvedValue({
      revision: '2',
      state: 'DRAFT',
      savedAt: '2026-10-10T10:00:01.000Z',
      serverTime: '2026-10-10T10:00:01.000Z',
      effectiveLockAt: '2026-11-05T17:00:00.000Z',
    });
    renderPage();

    await waitFor(() => screen.getByTestId('btn-import-excel'));
    const file = new File(['fake'], 'HSLN.xlsx');
    fireEvent.change(screen.getByTestId('import-excel-input'), { target: { files: [file] } });
    await waitFor(() => screen.getByTestId('btn-import-apply'));

    fireEvent.click(screen.getByTestId('btn-import-apply'));

    await waitFor(() => {
      expect(dynamicReportsApi.applyExcelImport).toHaveBeenCalledWith(
        'assign1',
        { 'Đội 3!C6': '12' },
        '1',
      );
    });
    expect(screen.queryByTestId('import-preview')).not.toBeInTheDocument();
    expect(screen.getByTestId('input-Đội 3!C6')).toHaveValue('12');
  });

  it('cancels the import preview without applying anything', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.previewExcelImport).mockResolvedValue({
      values: { 'Đội 3!C6': '12' },
      diff: [
        { fieldKey: 'Đội 3!C6', sheetKey: 'Đội 3', address: 'C6', label: 'Số vụ mới', current: '5', imported: '12' },
      ],
    });
    renderPage();

    await waitFor(() => screen.getByTestId('btn-import-excel'));
    const file = new File(['fake'], 'HSLN.xlsx');
    fireEvent.change(screen.getByTestId('import-excel-input'), { target: { files: [file] } });
    await waitFor(() => screen.getByTestId('btn-import-cancel'));

    fireEvent.click(screen.getByTestId('btn-import-cancel'));

    expect(screen.queryByTestId('import-preview')).not.toBeInTheDocument();
    expect(dynamicReportsApi.applyExcelImport).not.toHaveBeenCalled();
  });

  it('shows an error when the uploaded file is rejected (e.g. missing sheet)', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.previewExcelImport).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 400,
        data: { error: { message: 'File thiếu sheet: Đội 5.' } },
      },
    });
    renderPage();

    await waitFor(() => screen.getByTestId('btn-import-excel'));
    const file = new File(['fake'], 'wrong.xlsx');
    fireEvent.change(screen.getByTestId('import-excel-input'), { target: { files: [file] } });

    await waitFor(() => screen.getByTestId('import-error'));
    expect(screen.getByTestId('import-error')).toHaveTextContent('thiếu sheet');
  });

  it('does not show the "Nhập từ Excel" button when the submission is not editable', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue({ ...VIEW, editable: false });
    renderPage();

    await waitFor(() => screen.getByTestId('locked-banner'));
    expect(screen.queryByTestId('btn-import-excel')).not.toBeInTheDocument();
  });

  // PR H0 — save/submit sequencing. Before this fix a failed or still-in-flight
  // autosave did not stop "Nộp": the submit went out against the stale revision
  // and silently left the latest typed values out of the submitted version.
  describe('save queue (H0)', () => {
    const SAVED_2 = {
      revision: '2',
      state: 'DRAFT' as const,
      savedAt: '2026-10-10T10:00:01.000Z',
      serverTime: '2026-10-10T10:00:01.000Z',
      effectiveLockAt: '2026-11-05T17:00:00.000Z',
    };
    const SUBMITTED_3 = {
      revision: '3',
      state: 'SUBMITTED' as const,
      savedAt: '2026-10-10T10:00:03.000Z',
      serverTime: '2026-10-10T10:00:03.000Z',
      effectiveLockAt: null,
    };

    it('does not submit when the pre-submit save fails — the typed value would be dropped', async () => {
      vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
      vi.mocked(dynamicReportsApi.saveSubmissionValues).mockRejectedValue({
        isAxiosError: true,
        response: undefined,
      });
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderPage();

      await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
      fireEvent.change(screen.getByTestId('input-Đội 3!C6'), { target: { value: '99' } });
      fireEvent.click(screen.getByTestId('btn-submit'));

      await waitFor(() => screen.getByTestId('save-error'));
      expect(dynamicReportsApi.submitSubmission).not.toHaveBeenCalled();
      expect(dynamicReportsApi.validateForSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('btn-retry-save')).toBeInTheDocument();
      confirmSpy.mockRestore();
    });

    it('does not submit when the pre-submit save is rejected by CELL_VALIDATION', async () => {
      vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
      vi.mocked(dynamicReportsApi.saveSubmissionValues).mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 400,
          data: { error: { code: 'CELL_VALIDATION', message: 'Ô "Đội 3!C6": không phải số hợp lệ.' } },
        },
      });
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderPage();

      await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
      fireEvent.change(screen.getByTestId('input-Đội 3!C6'), { target: { value: 'abc' } });
      fireEvent.click(screen.getByTestId('btn-submit'));

      await waitFor(() => screen.getByTestId('save-error'));
      expect(dynamicReportsApi.submitSubmission).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('waits for an in-flight autosave, then submits against the ACKNOWLEDGED revision', async () => {
      vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
      let releaseSave!: (v: typeof SAVED_2) => void;
      vi.mocked(dynamicReportsApi.saveSubmissionValues).mockImplementationOnce(
        () => new Promise((resolve) => { releaseSave = resolve; }),
      );
      vi.mocked(dynamicReportsApi.submitSubmission).mockResolvedValue(SUBMITTED_3);
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderPage();

      await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
      const input = screen.getByTestId('input-Đội 3!C6');
      fireEvent.change(input, { target: { value: '12' } });
      fireEvent.blur(input); // autosave starts and stays in flight
      await waitFor(() => expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledTimes(1));

      fireEvent.click(screen.getByTestId('btn-submit'));
      // The in-flight save has not been acknowledged: nothing may be submitted yet.
      await Promise.resolve();
      expect(dynamicReportsApi.submitSubmission).not.toHaveBeenCalled();

      releaseSave(SAVED_2);
      await waitFor(() => screen.getByTestId('submitted-note'));
      expect(dynamicReportsApi.submitSubmission).toHaveBeenCalledWith('assign1', '2');
      expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledTimes(1);
      confirmSpy.mockRestore();
    });

    it('serialises saves: a value typed during a save is sent after it, with the new revision', async () => {
      vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
      let releaseFirst!: (v: typeof SAVED_2) => void;
      vi.mocked(dynamicReportsApi.saveSubmissionValues)
        .mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }))
        .mockResolvedValueOnce({ ...SAVED_2, revision: '3' });
      renderPage();

      await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
      const c6 = screen.getByTestId('input-Đội 3!C6');
      const c7 = screen.getByTestId('input-Đội 3!C7');
      fireEvent.change(c6, { target: { value: '12' } });
      fireEvent.blur(c6);
      await waitFor(() => expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledTimes(1));

      // Typed + blurred while save #1 is still unacknowledged.
      fireEvent.change(c7, { target: { value: '7' } });
      fireEvent.blur(c7);
      await Promise.resolve();
      expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledTimes(1);

      releaseFirst(SAVED_2);
      await waitFor(() => expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledTimes(2));
      const second = vi.mocked(dynamicReportsApi.saveSubmissionValues).mock.calls[1];
      expect(second[1]).toEqual({ 'Đội 3!C7': '7' });
      expect(second[2]).toBe('2'); // never the stale '1' → no self-inflicted 409
    });

    it('keeps the unsaved value pending after a failed save so the next save resends it', async () => {
      vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
      vi.mocked(dynamicReportsApi.saveSubmissionValues)
        .mockRejectedValueOnce({
          isAxiosError: true,
          response: { status: 500, data: { error: { code: 'INTERNAL', message: 'Lỗi máy chủ' } } },
        })
        .mockResolvedValueOnce(SAVED_2);
      renderPage();

      await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
      const c6 = screen.getByTestId('input-Đội 3!C6');
      fireEvent.change(c6, { target: { value: '12' } });
      fireEvent.blur(c6);
      await waitFor(() => screen.getByTestId('btn-retry-save'));

      fireEvent.click(screen.getByTestId('btn-retry-save'));
      await waitFor(() => expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledTimes(2));
      const [first, second] = vi.mocked(dynamicReportsApi.saveSubmissionValues).mock.calls;
      expect(second[1]).toEqual(first[1]);
      expect(second[3]).toBe(first[3]); // 5xx may have committed — same idempotency key
      await waitFor(() => screen.getByText('Đã lưu'));
    });

    it('locks inputs and "Nộp" while an Excel import is being applied, then shows the imported value', async () => {
      vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
      vi.mocked(dynamicReportsApi.previewExcelImport).mockResolvedValue({
        values: { 'Đội 3!C6': '12' },
        diff: [
          { fieldKey: 'Đội 3!C6', sheetKey: 'Đội 3', address: 'C6', label: 'Số vụ mới', current: '5', imported: '12' },
        ],
      });
      let releaseImport!: (v: typeof SAVED_2) => void;
      vi.mocked(dynamicReportsApi.applyExcelImport).mockImplementationOnce(
        () => new Promise((resolve) => { releaseImport = resolve; }),
      );
      renderPage();

      await waitFor(() => screen.getByTestId('btn-import-excel'));
      fireEvent.change(screen.getByTestId('import-excel-input'), {
        target: { files: [new File(['fake'], 'HSLN.xlsx')] },
      });
      await waitFor(() => screen.getByTestId('btn-import-apply'));
      fireEvent.click(screen.getByTestId('btn-import-apply'));

      // A value typed now would be overwritten by the import response, and a
      // submit now would lock the pre-import server copy if the import fails.
      await waitFor(() => expect(screen.getByTestId('input-Đội 3!C6')).toBeDisabled());
      expect(screen.getByTestId('btn-submit')).toBeDisabled();

      releaseImport(SAVED_2);
      await waitFor(() => expect(screen.getByTestId('input-Đội 3!C6')).not.toBeDisabled());
      expect(screen.getByTestId('input-Đội 3!C6')).toHaveValue('12');
      expect(screen.getByTestId('btn-submit')).not.toBeDisabled();
    });

    it('"Dùng bản trên máy chủ" shows the SERVER\'s current value, not the stale cached one', async () => {
      vi.mocked(dynamicReportsApi.getSubmission)
        .mockResolvedValueOnce(VIEW) // initial load: C6 = 5
        .mockResolvedValue({
          ...VIEW,
          revision: '2',
          values: { 'Đội 3!C6': { t: 'NUM', v: '12' } }, // someone else saved 12
        });
      vi.mocked(dynamicReportsApi.saveSubmissionValues).mockRejectedValue({
        isAxiosError: true,
        response: { status: 409, data: { error: { code: 'REVISION_CONFLICT', message: 'conflict' } } },
      });
      renderPage();

      await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
      fireEvent.change(screen.getByTestId('input-Đội 3!C6'), { target: { value: '99' } });
      fireEvent.blur(screen.getByTestId('input-Đội 3!C6'));
      await waitFor(() => screen.getByTestId('conflict-dialog'));

      fireEvent.click(screen.getByTestId('btn-conflict-use-server'));

      expect(screen.getByTestId('input-Đội 3!C6')).toHaveValue('12');
    });

    it('"Tải lại" adopts the fresh server snapshot: next save uses the fresh revision and values', async () => {
      vi.mocked(dynamicReportsApi.getSubmission)
        .mockResolvedValueOnce(VIEW) // revision 1
        .mockResolvedValue({
          ...VIEW,
          revision: '7',
          values: { 'Đội 3!C6': { t: 'NUM', v: '9' } },
        });
      vi.mocked(dynamicReportsApi.submitSubmission).mockRejectedValue({
        isAxiosError: true,
        response: { status: 409, data: { error: { code: 'REVISION_CONFLICT', message: 'x' } } },
      });
      vi.mocked(dynamicReportsApi.saveSubmissionValues).mockResolvedValue({
        ...SAVED_2,
        revision: '8',
      });
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderPage();

      await waitFor(() => screen.getByTestId('btn-submit'));
      fireEvent.click(screen.getByTestId('btn-submit'));
      await waitFor(() => screen.getByTestId('btn-reload'));

      fireEvent.click(screen.getByTestId('btn-reload'));
      await waitFor(() => expect(screen.getByTestId('input-Đội 3!C6')).toHaveValue('9'));

      const c7 = screen.getByTestId('input-Đội 3!C7');
      fireEvent.change(c7, { target: { value: '3' } });
      fireEvent.blur(c7);
      await waitFor(() => expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalled());
      expect(vi.mocked(dynamicReportsApi.saveSubmissionValues).mock.calls[0][2]).toBe('7');
      confirmSpy.mockRestore();
    });
  });
});
