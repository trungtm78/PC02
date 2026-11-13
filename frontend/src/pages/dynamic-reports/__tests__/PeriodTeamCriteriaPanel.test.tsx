import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PeriodTeamCriteriaPanel from '../PeriodTeamCriteriaPanel';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { reportCriteria } from '@/locales/reportCriteria.vi';
import type { PeriodCriteriaView } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: { loadPeriodCriteria: vi.fn(), setAssignmentCriteria: vi.fn() },
}));

const t = reportCriteria.period;
const VIEW: PeriodCriteriaView = {
  criteria: [
    { itemKey: 'tin-moi', fieldKey: 'S!C2', code: '1.1', label: 'Tin mới', unit: 'tin', parentItemKey: 'tin' },
    { itemKey: 'tin-cu', fieldKey: 'S!C3', code: '1.2', label: 'Tin cũ', unit: 'tin', parentItemKey: 'tin' },
  ],
  groups: [{ itemKey: 'tin', code: 'I', name: 'Tin báo', parentItemKey: null }],
  assignments: [
    { assignmentId: 'a1', ownedFieldKeys: ['S!C2'] },
    { assignmentId: 'a2', ownedFieldKeys: null },
  ],
};
const item = (key: string) => screen.getByTestId(`team-criteria-item-team-1-${key}`) as HTMLInputElement;

function renderPanel(assignmentId = 'a1') {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PeriodTeamCriteriaPanel periodId="p1" assignmentId={assignmentId} teamId="team-1" teamName="Tổ 1" onClose={onClose} onSaved={onSaved} />
    </QueryClientProvider>,
  );
  return { onClose, onSaved };
}

describe('PeriodTeamCriteriaPanel', () => {
  beforeEach(() => {
    vi.mocked(dynamicReportsApi.loadPeriodCriteria).mockReset().mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.setAssignmentCriteria).mockReset();
  });

  it('opens ticked with what the team reports NOW in this period, criteria named with their codes', async () => {
    renderPanel();
    await waitFor(() => expect(item('tin-moi').checked).toBe(true));
    expect(item('tin-cu').checked).toBe(false);
    expect(screen.getByTestId('criteria-panel')).toHaveTextContent('1.1 Tin mới');
    expect(dynamicReportsApi.loadPeriodCriteria).toHaveBeenCalledWith('p1');
  });

  it('a team with no subset opens with everything ticked', async () => {
    renderPanel('a2');
    await waitFor(() => expect(item('tin-moi').checked).toBe(true));
    expect(item('tin-cu').checked).toBe(true);
  });

  it('cannot be saved without a reason, and says so when the reason is left empty', async () => {
    renderPanel();
    await waitFor(() => expect(item('tin-moi')).toBeInTheDocument());
    expect(screen.getByTestId('btn-confirm-criteria')).toBeDisabled();
    fireEvent.blur(screen.getByTestId('criteria-reason-input'));
    expect(screen.getByTestId('criteria-reason-error')).toHaveTextContent(t.reasonRequired);
    expect(dynamicReportsApi.setAssignmentCriteria).not.toHaveBeenCalled();
  });

  it('saves the ticked subset as item keys with the reason', async () => {
    vi.mocked(dynamicReportsApi.setAssignmentCriteria).mockResolvedValue({ assignmentId: 'a2', ownedFieldKeys: ['S!C3'], changed: true });
    const { onSaved } = renderPanel('a2');
    await waitFor(() => expect(item('tin-moi')).toBeInTheDocument());
    fireEvent.click(item('tin-moi'));
    fireEvent.change(screen.getByTestId('criteria-reason-input'), { target: { value: '  Đổi phân công  ' } });
    fireEvent.click(screen.getByTestId('btn-confirm-criteria'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ changed: true, ticked: 1, total: 2 }));
    expect(dynamicReportsApi.setAssignmentCriteria).toHaveBeenCalledWith('p1', 'a2', ['tin-cu'], 'Đổi phân công');
  });

  it('the way back: ticking everything again sends null ("every criterion"), not today\'s list', async () => {
    vi.mocked(dynamicReportsApi.setAssignmentCriteria).mockResolvedValue({ assignmentId: 'a1', ownedFieldKeys: null, changed: true });
    const { onSaved } = renderPanel();
    await waitFor(() => expect(item('tin-cu')).toBeInTheDocument());
    fireEvent.click(item('tin-cu'));
    fireEvent.change(screen.getByTestId('criteria-reason-input'), { target: { value: 'Trả lại' } });
    fireEvent.click(screen.getByTestId('btn-confirm-criteria'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ changed: true, ticked: 2, total: 2 }));
    expect(dynamicReportsApi.setAssignmentCriteria).toHaveBeenCalledWith('p1', 'a1', null, 'Trả lại');
  });

  it('nothing ticked cannot be saved and points to "Miễn nộp"', async () => {
    renderPanel();
    await waitFor(() => expect(item('tin-moi')).toBeInTheDocument());
    fireEvent.click(item('tin-moi'));
    fireEvent.change(screen.getByTestId('criteria-reason-input'), { target: { value: 'x' } });
    expect(screen.getByTestId('criteria-empty-error')).toHaveTextContent(t.emptyTicks);
    expect(screen.getByTestId('btn-confirm-criteria')).toBeDisabled();
  });

  it('a refusal is told by its code and the panel stays open with the ticks', async () => {
    vi.mocked(dynamicReportsApi.setAssignmentCriteria).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error: { code: 'SUBMISSION_MUST_BE_RETURNED', message: 'x', details: [] } } },
    });
    const { onSaved } = renderPanel();
    await waitFor(() => expect(item('tin-cu')).toBeInTheDocument());
    fireEvent.click(item('tin-cu'));
    fireEvent.change(screen.getByTestId('criteria-reason-input'), { target: { value: 'x' } });
    fireEvent.click(screen.getByTestId('btn-confirm-criteria'));

    expect(await screen.findByTestId('criteria-error')).toHaveTextContent(t.errors.SUBMISSION_MUST_BE_RETURNED);
    expect(onSaved).not.toHaveBeenCalled();
    expect(item('tin-cu').checked).toBe(true);
  });

  it('a list that cannot be loaded is not shown as empty: it says so and can be tried again', async () => {
    vi.mocked(dynamicReportsApi.loadPeriodCriteria).mockRejectedValueOnce(new Error('down'));
    renderPanel();
    expect(await screen.findByTestId('criteria-load-error')).toHaveTextContent(t.loadError);
    expect(screen.queryByTestId('criteria-none')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-criteria-retry'));
    await waitFor(() => expect(item('tin-moi')).toBeInTheDocument());
  });

  it('a version with no criteria says so and offers nothing to save', async () => {
    vi.mocked(dynamicReportsApi.loadPeriodCriteria).mockResolvedValue({ criteria: [], groups: [], assignments: [] });
    renderPanel();
    expect(await screen.findByTestId('criteria-none')).toHaveTextContent(t.noCriteria);
    expect(screen.queryByTestId('btn-confirm-criteria')).not.toBeInTheDocument();
  });

  it('"Huỷ" closes without saving', async () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByTestId('btn-cancel-criteria'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dynamicReportsApi.setAssignmentCriteria).not.toHaveBeenCalled();
  });
});
