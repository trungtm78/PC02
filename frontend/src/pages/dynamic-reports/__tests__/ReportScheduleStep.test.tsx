import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportScheduleStep from '../ReportScheduleStep';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    getNonWorkingDates: vi.fn(),
  },
}));

describe('ReportScheduleStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dynamicReportsApi.getNonWorkingDates).mockResolvedValue([]);
  });

  it('previews at least 6 periods for the default MONTHLY rule', async () => {
    render(<ReportScheduleStep onBack={() => {}} onNext={() => {}} />);

    await waitFor(() => {
      expect(screen.getByTestId('period-preview-list').children.length).toBeGreaterThanOrEqual(6);
    });
  });

  it('switching to WEEKLY shows a weekday selector instead of a day-of-month input', async () => {
    render(<ReportScheduleStep onBack={() => {}} onNext={() => {}} />);
    fireEvent.change(screen.getByTestId('select-period-type'), { target: { value: 'WEEKLY' } });

    expect(screen.queryByTestId('input-anchor-day')).not.toBeInTheDocument();
    expect(screen.getByText('Ngày trong tuần')).toBeInTheDocument();
  });

  it('ONE_TIME disables "Tiếp theo" until a date is chosen', async () => {
    render(<ReportScheduleStep onBack={() => {}} onNext={() => {}} />);
    fireEvent.change(screen.getByTestId('select-period-type'), { target: { value: 'ONE_TIME' } });

    expect(screen.getByTestId('btn-schedule-next')).toBeDisabled();

    fireEvent.change(screen.getByTestId('input-one-time-date'), { target: { value: '2026-12-01' } });
    expect(screen.getByTestId('btn-schedule-next')).not.toBeDisabled();
  });

  it('fetches non-working dates when "shift non-working" is checked, and the preview reflects them', async () => {
    vi.mocked(dynamicReportsApi.getNonWorkingDates).mockResolvedValue(['2026-01-01']);
    render(<ReportScheduleStep onBack={() => {}} onNext={() => {}} />);

    await waitFor(() => {
      expect(dynamicReportsApi.getNonWorkingDates).toHaveBeenCalled();
    });
  });

  it('calls onNext with the constructed rule when clicked', async () => {
    const onNext = vi.fn();
    render(<ReportScheduleStep onBack={() => {}} onNext={onNext} />);

    await waitFor(() => screen.getByTestId('period-preview-list'));
    fireEvent.click(screen.getByTestId('btn-schedule-next'));

    expect(onNext).toHaveBeenCalledWith(
      expect.objectContaining({ periodType: 'MONTHLY', shiftNonWorking: true }),
    );
  });

  it('calls onBack when "Quay lại" is clicked', async () => {
    const onBack = vi.fn();
    render(<ReportScheduleStep onBack={onBack} onNext={() => {}} />);
    fireEvent.click(screen.getByText('Quay lại'));
    expect(onBack).toHaveBeenCalled();
  });

  it('shows a friendly error (not a crash) when getNonWorkingDates fails', async () => {
    vi.mocked(dynamicReportsApi.getNonWorkingDates).mockRejectedValue(new Error('network'));
    render(<ReportScheduleStep onBack={() => {}} onNext={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText(/Không tải được danh sách ngày nghỉ/)).toBeInTheDocument();
    });
  });
});
