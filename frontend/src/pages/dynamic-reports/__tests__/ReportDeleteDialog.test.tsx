import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReportDeleteDialog from '../ReportDeleteDialog';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { ReportDeletionImpact } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    getReportDeletionImpact: vi.fn(),
    deleteReport: vi.fn(),
    deleteReportWithData: vi.fn(),
    archiveReport: vi.fn(),
  },
}));

const REPORT = { id: 'r1', code: 'HSLN', name: 'Thống kê', status: 'PUBLISHED' };

const EMPTY: ReportDeletionImpact = {
  reportId: 'r1', code: 'HSLN', name: 'Thống kê', versions: 1, periods: 2, finalizedPeriods: 0,
  assignments: 6, submissionsWithData: 0, revisions: 0, comments: 0, unlocks: 0, hasData: false,
};
const WITH_DATA: ReportDeletionImpact = { ...EMPTY, submissionsWithData: 3, revisions: 9, comments: 2, hasData: true };

function renderDialog(onDone = vi.fn(), onClose = vi.fn()) {
  render(<ReportDeleteDialog report={REPORT} onClose={onClose} onDone={onDone} />);
  return { onDone, onClose };
}

describe('ReportDeleteDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('says how much would be lost before anything can be pressed', async () => {
    vi.mocked(dynamicReportsApi.getReportDeletionImpact).mockResolvedValue(WITH_DATA);
    renderDialog();

    const impact = await screen.findByTestId('delete-impact');
    expect(impact).toHaveTextContent('Bản nộp đã có số liệu');
    expect(impact).toHaveTextContent('9');
  });

  it('a report nobody touched can be deleted outright, and the screen is told it was deleted', async () => {
    vi.mocked(dynamicReportsApi.getReportDeletionImpact).mockResolvedValue(EMPTY);
    vi.mocked(dynamicReportsApi.deleteReport).mockResolvedValue({ deleted: true });
    const { onDone } = renderDialog();

    expect(await screen.findByTestId('delete-no-data')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-force-open')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-delete'));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('deleted'));
    expect(dynamicReportsApi.deleteReport).toHaveBeenCalledWith('r1');
  });

  it('a report with figures cannot be deleted in one click: archive is offered first, the plain delete is gone', async () => {
    vi.mocked(dynamicReportsApi.getReportDeletionImpact).mockResolvedValue(WITH_DATA);
    vi.mocked(dynamicReportsApi.archiveReport).mockResolvedValue({ status: 'ARCHIVED' });
    const { onDone } = renderDialog();

    expect(await screen.findByTestId('delete-has-data')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-delete')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-archive'));

    await waitFor(() => expect(onDone).toHaveBeenCalledWith('archived'));
    expect(dynamicReportsApi.deleteReport).not.toHaveBeenCalled();
  });

  it('deleting together with the figures needs the report code typed back exactly', async () => {
    vi.mocked(dynamicReportsApi.getReportDeletionImpact).mockResolvedValue(WITH_DATA);
    vi.mocked(dynamicReportsApi.deleteReportWithData).mockResolvedValue({ deleted: true });
    const { onDone } = renderDialog();

    fireEvent.click(await screen.findByTestId('btn-force-open'));
    const confirm = screen.getByTestId('btn-force-delete');
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByTestId('input-confirm-code'), { target: { value: 'hsln' } });
    expect(confirm).toBeDisabled(); // the code is case-sensitive, like the server's check

    fireEvent.change(screen.getByTestId('input-confirm-code'), { target: { value: 'HSLN' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);

    await waitFor(() => expect(dynamicReportsApi.deleteReportWithData).toHaveBeenCalledWith('r1', 'HSLN'));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('deleted'));
  });

  it('when the server refuses (not an admin), the reason is shown and nothing is reported as deleted', async () => {
    vi.mocked(dynamicReportsApi.getReportDeletionImpact).mockResolvedValue(WITH_DATA);
    vi.mocked(dynamicReportsApi.deleteReportWithData).mockRejectedValue(new Error('Không đủ quyền'));
    const { onDone } = renderDialog();

    fireEvent.click(await screen.findByTestId('btn-force-open'));
    fireEvent.change(screen.getByTestId('input-confirm-code'), { target: { value: 'HSLN' } });
    fireEvent.click(screen.getByTestId('btn-force-delete'));

    expect(await screen.findByTestId('delete-error')).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('an already archived report is not offered "archive" again', async () => {
    vi.mocked(dynamicReportsApi.getReportDeletionImpact).mockResolvedValue(WITH_DATA);
    render(<ReportDeleteDialog report={{ ...REPORT, status: 'ARCHIVED' }} onClose={vi.fn()} onDone={vi.fn()} />);

    await screen.findByTestId('delete-has-data');
    expect(screen.queryByTestId('btn-archive')).not.toBeInTheDocument();
  });

  it('cancel closes without calling anything that changes data', async () => {
    vi.mocked(dynamicReportsApi.getReportDeletionImpact).mockResolvedValue(EMPTY);
    const { onClose } = renderDialog();

    await screen.findByTestId('btn-delete');
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));

    expect(onClose).toHaveBeenCalled();
    expect(dynamicReportsApi.deleteReport).not.toHaveBeenCalled();
    expect(dynamicReportsApi.archiveReport).not.toHaveBeenCalled();
  });
});
