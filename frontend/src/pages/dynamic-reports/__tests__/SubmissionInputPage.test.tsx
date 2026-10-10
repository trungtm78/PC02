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
    requestUnlock: vi.fn(),
    previewExcelImport: vi.fn(),
    applyExcelImport: vi.fn(),
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
};

describe('SubmissionInputPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
