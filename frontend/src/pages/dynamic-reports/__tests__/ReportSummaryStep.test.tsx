import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportSummaryStep from '../ReportSummaryStep';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { ParsedField } from '@/features/dynamic-reports/types';
import type { ScheduleRule } from '@/features/dynamic-reports/engine/generated/period';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: { saveReportConfig: vi.fn() },
}));

const FIELDS: ParsedField[] = [
  {
    sheetKey: 'Đội 3',
    address: 'C6',
    fieldKey: 'Đội 3!C6',
    label: 'Số vụ mới',
    type: 'NUM',
    format: '',
    aggregate: 'SUM',
    source: 'TOKEN',
  },
];

const SCHEDULE: ScheduleRule = {
  periodType: 'MONTHLY',
  due: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
  open: { kind: 'AT_PERIOD_START' },
};

function renderStep(onBack = vi.fn()) {
  return render(
    <MemoryRouter>
      <ReportSummaryStep
        file={new File(['x'], 'mau.xlsx')}
        code="HSLN"
        name="Thống kê hình sự liên ngành"
        description=""
        selectedSheets={['Đội 3']}
        dateSystem="1900"
        fields={FIELDS}
        layout={{ sheetOrder: ['Đội 3'], sheets: [] }}
        formulas={[]}
        schedule={SCHEDULE}
        roles={[{ userId: 'u1', role: 'MANAGER' }]}
        targets={[{ teamId: 't1', editorUserIds: ['u2'] }]}
        onBack={onBack}
      />
    </MemoryRouter>,
  );
}

describe('ReportSummaryStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a summary of the whole config', () => {
    renderStep();
    const details = screen.getByTestId('summary-details');
    expect(details).toHaveTextContent('HSLN');
    expect(details).toHaveTextContent('MONTHLY');
    expect(details).toHaveTextContent('Đội 3');
  });

  it('publishing calls saveReportConfig with publish:true and shows the PUBLISHED result', async () => {
    vi.mocked(dynamicReportsApi.saveReportConfig).mockResolvedValue({
      reportId: 'rep1',
      versionId: 'ver1',
      status: 'PUBLISHED',
    });
    renderStep();

    fireEvent.click(screen.getByTestId('btn-publish'));

    await waitFor(() => screen.getByTestId('summary-result'));
    expect(screen.getByTestId('summary-result')).toHaveTextContent('Đã xuất bản');

    const [, config] = vi.mocked(dynamicReportsApi.saveReportConfig).mock.calls[0];
    expect(config.publish).toBe(true);
    expect(config.code).toBe('HSLN');
    expect(config.roles).toEqual([{ userId: 'u1', role: 'MANAGER' }]);
    expect(config.targets).toEqual([{ teamId: 't1', editorUserIds: ['u2'] }]);
    expect(config.schedule.periodType).toBe('MONTHLY');
    expect(config.layout).toEqual({ sheetOrder: ['Đội 3'], sheets: [] });
    expect(config.formulas).toEqual([]);
    expect(typeof config.idempotencyKey).toBe('string');
    expect(config.idempotencyKey.length).toBeGreaterThan(0);
  });

  it('saving a draft calls saveReportConfig with publish:false and shows the DRAFT result', async () => {
    vi.mocked(dynamicReportsApi.saveReportConfig).mockResolvedValue({
      reportId: 'rep1',
      versionId: 'ver1',
      status: 'DRAFT',
    });
    renderStep();

    fireEvent.click(screen.getByTestId('btn-save-draft'));

    await waitFor(() => screen.getByTestId('summary-result'));
    expect(screen.getByTestId('summary-result')).toHaveTextContent('lưu nháp');
    const [, config] = vi.mocked(dynamicReportsApi.saveReportConfig).mock.calls[0];
    expect(config.publish).toBe(false);
  });

  it('shows a readable error and stays on the form when the save fails', async () => {
    vi.mocked(dynamicReportsApi.saveReportConfig).mockRejectedValue(
      Object.assign(new Error('Phải có ít nhất một quản lý trước khi xuất bản.'), {
        isAxiosError: false,
      }),
    );
    renderStep();

    fireEvent.click(screen.getByTestId('btn-publish'));

    await waitFor(() => screen.getByTestId('save-error'));
    expect(screen.getByTestId('save-error')).toHaveTextContent('quản lý');
    expect(screen.queryByTestId('summary-result')).not.toBeInTheDocument();
  });

  it('reuses the SAME idempotency key across a retry after a failed attempt', async () => {
    vi.mocked(dynamicReportsApi.saveReportConfig)
      .mockRejectedValueOnce(Object.assign(new Error('network'), { isAxiosError: false }))
      .mockResolvedValueOnce({ reportId: 'rep1', versionId: 'ver1', status: 'PUBLISHED' });
    renderStep();

    fireEvent.click(screen.getByTestId('btn-publish'));
    await waitFor(() => screen.getByTestId('save-error'));
    fireEvent.click(screen.getByTestId('btn-publish'));
    await waitFor(() => screen.getByTestId('summary-result'));

    const firstKey = vi.mocked(dynamicReportsApi.saveReportConfig).mock.calls[0][1].idempotencyKey;
    const secondKey = vi.mocked(dynamicReportsApi.saveReportConfig).mock.calls[1][1].idempotencyKey;
    expect(firstKey).toBe(secondKey);
  });

  it('calls onBack when "Quay lại" is clicked', () => {
    const onBack = vi.fn();
    renderStep(onBack);
    fireEvent.click(screen.getByText('Quay lại'));
    expect(onBack).toHaveBeenCalled();
  });
});
