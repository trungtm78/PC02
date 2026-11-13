import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportSummaryStep from '../ReportSummaryStep';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { ParsedField, ReportSourceKind, ReportTargetConfig } from '@/features/dynamic-reports/types';
import type { ScheduleRule } from '@/features/dynamic-reports/engine/generated/period';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: { saveReportConfig: vi.fn() },
}));

/** The summary says per team how many criteria it reports, and where a criteria report's workbook came from. */
function field(fieldKey: string, itemKey?: string): ParsedField {
  const [sheetKey, address] = fieldKey.split('!');
  return {
    sheetKey,
    address,
    fieldKey,
    label: fieldKey,
    type: 'NUM',
    format: '',
    aggregate: 'SUM',
    source: 'TOKEN',
    ...(itemKey ? { itemKey, origin: 'FILE' as const } : {}),
  };
}

const SCHEDULE: ScheduleRule = {
  periodType: 'MONTHLY',
  due: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
  open: { kind: 'AT_PERIOD_START' },
};

function renderStep(opts: { fields: ParsedField[]; targets: ReportTargetConfig[]; sourceKind?: ReportSourceKind }) {
  return render(
    <MemoryRouter>
      <ReportSummaryStep
        file={new File(['x'], 'tieu-chi.xlsx')}
        code="TC"
        name="Báo cáo tiêu chí"
        description=""
        selectedSheets={['Chỉ tiêu']}
        dateSystem="1900"
        fields={opts.fields}
        layout={{}}
        formulas={[]}
        schedule={SCHEDULE}
        roles={[{ userId: 'u1', role: 'MANAGER' }]}
        targets={opts.targets}
        rules={[]}
        sourceKind={opts.sourceKind}
        teamNames={{ t1: 'Tổ 1', t2: 'Tổ 2' }}
        onBack={() => {}}
      />
    </MemoryRouter>,
  );
}

const CRITERIA_FIELDS = [field('Chỉ tiêu!C2', 'trom-cap'), field('Chỉ tiêu!C3', 'cuop'), field('Chỉ tiêu!C4', 'khac')];
const TARGETS: ReportTargetConfig[] = [
  { teamId: 't1', editorUserIds: ['u1'], itemKeys: ['trom-cap', 'khac'] },
  { teamId: 't2', editorUserIds: ['u1'] },
];

describe('ReportSummaryStep — criteria', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dynamicReportsApi.saveReportConfig).mockResolvedValue({ reportId: 'r', versionId: 'v', status: 'DRAFT' });
  });

  it('says per team how many criteria it reports; a team with no subset reports all', () => {
    renderStep({ fields: CRITERIA_FIELDS, targets: TARGETS, sourceKind: 'CRITERIA' });
    expect(screen.getByTestId('summary-team-criteria-t1')).toHaveTextContent('Tổ 1: 2/3 tiêu chí');
    expect(screen.getByTestId('summary-team-criteria-t2')).toHaveTextContent('Tổ 2: 3/3 tiêu chí');
  });

  it('a criteria report names its source, and saves sourceKind CRITERIA with each team\'s itemKeys', async () => {
    renderStep({ fields: CRITERIA_FIELDS, targets: TARGETS, sourceKind: 'CRITERIA' });
    expect(screen.getByTestId('summary-source')).toHaveTextContent('Sinh từ danh sách tiêu chí');

    fireEvent.click(screen.getByTestId('btn-save-draft'));
    await waitFor(() => expect(dynamicReportsApi.saveReportConfig).toHaveBeenCalledTimes(1));
    const config = vi.mocked(dynamicReportsApi.saveReportConfig).mock.calls[0][1];
    expect(config.sourceKind).toBe('CRITERIA');
    expect(config.targets).toEqual(TARGETS);
    expect(config.fields.map((f) => f.itemKey)).toEqual(['trom-cap', 'cuop', 'khac']);
  });

  it('an ordinary template report shows no source line and sends no sourceKind; its subset counts by field key', async () => {
    renderStep({
      fields: [field('Đội 3!C6'), field('Đội 3!C7')],
      targets: [{ teamId: 't1', editorUserIds: ['u1'], itemKeys: ['Đội 3!C7'] }],
    });
    expect(screen.queryByTestId('summary-source')).not.toBeInTheDocument();
    expect(screen.getByTestId('summary-team-criteria-t1')).toHaveTextContent('Tổ 1: 1/2 tiêu chí');

    fireEvent.click(screen.getByTestId('btn-save-draft'));
    await waitFor(() => expect(dynamicReportsApi.saveReportConfig).toHaveBeenCalledTimes(1));
    expect(vi.mocked(dynamicReportsApi.saveReportConfig).mock.calls[0][1]).not.toHaveProperty('sourceKind');
  });

  it('a refused subset is explained in the screen\'s words, by its code', async () => {
    vi.mocked(dynamicReportsApi.saveReportConfig).mockRejectedValue(
      Object.assign(new Error('x'), {
        isAxiosError: true,
        response: { status: 400, data: { error: { code: 'TARGET_SUBSET_EMPTY', message: 'TARGET_SUBSET_EMPTY', details: [] } } },
      }),
    );
    renderStep({ fields: CRITERIA_FIELDS, targets: TARGETS, sourceKind: 'CRITERIA' });
    fireEvent.click(screen.getByTestId('btn-publish'));
    expect(await screen.findByTestId('save-error')).toHaveTextContent('chưa được giao tiêu chí nào');
  });
});
