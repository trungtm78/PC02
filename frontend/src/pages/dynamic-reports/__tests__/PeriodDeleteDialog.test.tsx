import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PeriodDeleteDialog from '../PeriodDeleteDialog';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { PeriodDeletionImpact } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: { getPeriodDeletionImpact: vi.fn(), deletePeriod: vi.fn(), deletePeriodWithData: vi.fn() },
}));

const EMPTY: PeriodDeletionImpact = {
  periodId: 'p1', reportId: 'r1', periodKey: '2026-10', status: 'OPEN', assignments: 3,
  submissionsWithData: 0, revisions: 0, comments: 0, unlocks: 0, hasData: false,
};
const WITH_DATA: PeriodDeletionImpact = { ...EMPTY, submissionsWithData: 2, revisions: 6, hasData: true };

function renderDialog(onDeleted = vi.fn(), onClose = vi.fn(), canDeleteWithData = true) {
  render(<PeriodDeleteDialog periodId="p1" periodKey="2026-10" canDeleteWithData={canDeleteWithData} onClose={onClose} onDeleted={onDeleted} />);
  return { onDeleted, onClose };
}

describe('PeriodDeleteDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('says how much would be lost before anything can be pressed', async () => {
    vi.mocked(dynamicReportsApi.getPeriodDeletionImpact).mockResolvedValue(WITH_DATA);
    renderDialog();
    const impact = await screen.findByTestId('period-delete-impact');
    expect(impact).toHaveTextContent('Bản nộp đã có số liệu');
    expect(impact).toHaveTextContent('6');
  });

  it('an empty period is deleted outright and the screen is told', async () => {
    vi.mocked(dynamicReportsApi.getPeriodDeletionImpact).mockResolvedValue(EMPTY);
    vi.mocked(dynamicReportsApi.deletePeriod).mockResolvedValue({ deleted: true, periodKey: '2026-10' });
    const { onDeleted } = renderDialog();

    expect(await screen.findByTestId('period-delete-no-data')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-delete-period'));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(dynamicReportsApi.deletePeriod).toHaveBeenCalledWith('p1');
  });

  it('a period with figures has no plain delete; the forced one needs the key typed back exactly', async () => {
    vi.mocked(dynamicReportsApi.getPeriodDeletionImpact).mockResolvedValue(WITH_DATA);
    vi.mocked(dynamicReportsApi.deletePeriodWithData).mockResolvedValue({ deleted: true, periodKey: '2026-10' });
    const { onDeleted } = renderDialog();

    expect(await screen.findByTestId('period-delete-has-data')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-delete-period')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-period-force-open'));
    const go = screen.getByTestId('btn-period-force-delete');
    expect(go).toBeDisabled();
    fireEvent.change(screen.getByTestId('input-confirm-period-key'), { target: { value: '2026-1' } });
    expect(go).toBeDisabled();
    fireEvent.change(screen.getByTestId('input-confirm-period-key'), { target: { value: '2026-10' } });
    expect(go).toBeEnabled();
    fireEvent.click(go);

    await waitFor(() => expect(dynamicReportsApi.deletePeriodWithData).toHaveBeenCalledWith('p1', '2026-10'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it('does not offer forced deletion to a report manager', async () => {
    vi.mocked(dynamicReportsApi.getPeriodDeletionImpact).mockResolvedValue(WITH_DATA);
    renderDialog(vi.fn(), vi.fn(), false);

    expect(await screen.findByTestId('period-delete-has-data')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-delete-period')).not.toBeInTheDocument();
    expect(screen.queryByTestId('btn-period-force-open')).not.toBeInTheDocument();
  });

  it('a refusal (not an admin) is shown and nothing is reported as deleted', async () => {
    vi.mocked(dynamicReportsApi.getPeriodDeletionImpact).mockResolvedValue(WITH_DATA);
    vi.mocked(dynamicReportsApi.deletePeriodWithData).mockRejectedValue(new Error('Chỉ quản trị viên'));
    const { onDeleted } = renderDialog();
    fireEvent.click(await screen.findByTestId('btn-period-force-open'));
    fireEvent.change(screen.getByTestId('input-confirm-period-key'), { target: { value: '2026-10' } });
    fireEvent.click(screen.getByTestId('btn-period-force-delete'));

    expect(await screen.findByTestId('period-delete-error')).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('a closed period is called out; cancel changes nothing', async () => {
    vi.mocked(dynamicReportsApi.getPeriodDeletionImpact).mockResolvedValue({ ...WITH_DATA, status: 'FINALIZED' });
    const { onClose } = renderDialog();
    expect(await screen.findByTestId('period-delete-has-data')).toHaveTextContent('đã chốt');
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ' }));
    expect(onClose).toHaveBeenCalled();
    expect(dynamicReportsApi.deletePeriod).not.toHaveBeenCalled();
    expect(dynamicReportsApi.deletePeriodWithData).not.toHaveBeenCalled();
  });
});
