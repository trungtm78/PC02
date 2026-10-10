import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  it('shows a reload prompt on REVISION_CONFLICT (409)', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.saveSubmissionValues).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { error: { code: 'REVISION_CONFLICT', message: 'Bản nộp đã bị sửa bởi một phiên khác — tải lại để lấy bản mới nhất.' } },
      },
    });
    renderPage();

    await waitFor(() => screen.getByTestId('input-Đội 3!C6'));
    const input = screen.getByTestId('input-Đội 3!C6');
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.blur(input);

    await waitFor(() => screen.getByTestId('btn-reload'));
    expect(screen.getByTestId('save-error')).toHaveTextContent('phiên khác');
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
});
