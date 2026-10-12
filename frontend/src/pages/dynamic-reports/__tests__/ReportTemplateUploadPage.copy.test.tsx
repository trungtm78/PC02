import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportCopyPage from '../ReportCopyPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import { api } from '@/lib/api';
import type { ReportDetailView, TemplatePreviewResult } from '@/features/dynamic-reports/types';
import { makeGrid } from '@/features/dynamic-reports/grid/__tests__/fixtures';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    getReportDetail: vi.fn(),
    listTemplateSheets: vi.fn(),
    previewTemplate: vi.fn(),
    getNonWorkingDates: vi.fn(),
    downloadVersionFile: vi.fn(),
    saveReportConfig: vi.fn(),
  },
}));
vi.mock('@/hooks/useOfficerOptions', () => ({ useOfficerOptions: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

/** "Sao chép cấu hình": a new report that starts as a copy of an existing one. */
const SOURCE: ReportDetailView = {
  id: 'r1',
  code: 'HSLN',
  name: 'Thống kê hình sự',
  description: 'Mô tả gốc',
  status: 'PUBLISHED',
  reportingUnit: 'TEAM',
  effectiveFrom: '2026-10-01T00:00:00.000Z',
  configVersion: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  schedule: {
    periodType: 'MONTHLY',
    periodStartDay: 1,
    dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
    openRule: { kind: 'AT_PERIOD_START' },
    shiftNonWorking: false,
    oneTimeDate: null,
    timezone: 'Asia/Ho_Chi_Minh',
    effectiveFrom: '2026-10-01T00:00:00.000Z',
  },
  roles: [{ userId: 'u1', name: 'Nguyễn An', role: 'MANAGER', teamScopeId: null }],
  targets: [{ teamId: 't1', teamCode: 'DOI-1', teamName: 'Đội 1', editors: [{ userId: 'u1', name: 'Nguyễn An' }] }],
  currentVersion: {
    versionId: 'v1',
    version: 1,
    status: 'PUBLISHED',
    fileName: 'mau.xlsx',
    selectedSheets: ['Đội 3'],
    dateSystem: '1900',
    publishedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    fields: [
      { sheetKey: 'Đội 3', address: 'C6', fieldKey: 'Đội 3!C6', label: 'Số vụ', type: 'NUM', format: null, aggregate: 'SUM', blankPolicy: 'ZERO', required: true, min: null, max: null, scale: null, maxLength: null, helpText: null, source: 'WEB' },
    ],
    rules: [],
  },
  versionCount: 1,
  periods: [],
  periodTotal: 0,
};

const PREVIEW = {
  dateSystem: '1900',
  fields: [],
  formulas: [],
  issues: [],
  markableCells: [{ sheetKey: 'Đội 3', address: 'C6', suggestedLabel: null }],
  totalCells: 10,
  inputCellCount: 0,
  sha256: 'a',
  suggestedRules: [],
  layout: {},
  grid: makeGrid({}, {}),
} as unknown as TemplatePreviewResult;

function renderCopy() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/bao-cao-dong/thiet-lap/r1/sao-chep']}>
        <Routes>
          <Route path="/bao-cao-dong/thiet-lap/:reportId/sao-chep" element={<ReportCopyPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportCopyPage / wizard in copy mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dynamicReportsApi.getReportDetail).mockResolvedValue(SOURCE);
    vi.mocked(dynamicReportsApi.listTemplateSheets).mockResolvedValue([{ name: 'Đội 3', state: 'visible' }]);
    vi.mocked(dynamicReportsApi.previewTemplate).mockResolvedValue(PREVIEW);
    vi.mocked(dynamicReportsApi.getNonWorkingDates).mockResolvedValue([]);
    vi.mocked(dynamicReportsApi.downloadVersionFile).mockResolvedValue(new File(['x'], 'mau.xlsx'));
    vi.mocked(useOfficerOptions).mockReturnValue({
      data: [{ value: 'u1', label: 'Nguyễn An', teams: [{ teamId: 't1', teamName: 'Đội 1', isLeader: true, laDiaBan: false }] }],
      isLoading: false,
    } as never);
    vi.mocked(api.get).mockResolvedValue({ data: [{ id: 't1', name: 'Đội 1', isActive: true, wardId: null }] });
  });

  it('is a NEW report: the code is empty and must be chosen, the name starts as "(bản sao)", the description is copied', async () => {
    renderCopy();
    expect(await screen.findByTestId('wizard-title')).toHaveTextContent('Sao chép báo cáo — Thống kê hình sự');
    expect(screen.getByTestId('input-report-code')).toHaveValue('');
    expect(screen.getByTestId('input-report-name')).toHaveValue('Thống kê hình sự (bản sao)');
    expect(screen.getByTestId('input-report-description')).toHaveValue('Mô tả gốc');
  });

  it('loads the source report\'s template file in one click, with its sheets pre-selected', async () => {
    renderCopy();
    fireEvent.click(await screen.findByTestId('btn-use-current-file'));

    await waitFor(() => expect(dynamicReportsApi.downloadVersionFile).toHaveBeenCalledWith('r1', 'v1', 'mau.xlsx'));
    expect(await screen.findByTestId('sheet-checkbox-Đội 3')).toBeChecked();
  });

  it('the preview keeps the source\'s input cells, and the schedule and teams steps start from the source\'s', async () => {
    renderCopy();
    fireEvent.click(await screen.findByTestId('btn-use-current-file'));
    await screen.findByTestId('sheet-checkbox-Đội 3');
    fireEvent.change(screen.getByTestId('input-report-code'), { target: { value: 'HSLN-2' } });
    fireEvent.click(screen.getByTestId('btn-preview'));

    expect(await screen.findByTestId('carry-over-note')).toHaveTextContent('Giữ lại 1 ô nhập');
    fireEvent.click(screen.getByTestId('btn-go-to-schedule'));

    expect(await screen.findByTestId('input-days-after-end')).toHaveValue(5);
    fireEvent.click(screen.getByTestId('btn-schedule-next'));

    expect(await screen.findByTestId('manager-list')).toHaveTextContent('Nguyễn An');
    expect(screen.getByTestId('target-t1')).toHaveTextContent('Đội 1');
    expect(screen.getByTestId('btn-teams-next')).toBeEnabled();
  });

  it('publishing sends the NEW code with the carried fields (their required flag included)', async () => {
    vi.mocked(dynamicReportsApi.saveReportConfig).mockResolvedValue({ reportId: 'r2', versionId: 'v9', status: 'PUBLISHED' });
    renderCopy();
    fireEvent.click(await screen.findByTestId('btn-use-current-file'));
    await screen.findByTestId('sheet-checkbox-Đội 3');
    fireEvent.change(screen.getByTestId('input-report-code'), { target: { value: 'HSLN-2' } });
    fireEvent.click(screen.getByTestId('btn-preview'));
    fireEvent.click(await screen.findByTestId('btn-go-to-schedule'));
    fireEvent.click(await screen.findByTestId('btn-schedule-next'));
    fireEvent.click(await screen.findByTestId('btn-teams-next'));
    fireEvent.click(await screen.findByTestId('btn-rules-next'));
    fireEvent.click(await screen.findByTestId('btn-publish'));

    await waitFor(() => expect(dynamicReportsApi.saveReportConfig).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(dynamicReportsApi.saveReportConfig).mock.calls[0][1];
    expect(payload.code).toBe('HSLN-2');
    expect(payload.fields).toEqual([expect.objectContaining({ fieldKey: 'Đội 3!C6', label: 'Số vụ', required: true })]);
    expect(payload.targets).toEqual([{ teamId: 't1', editorUserIds: ['u1'] }]);
    expect(payload.schedule.dueRule).toMatchObject({ kind: 'DAYS_AFTER_END', days: 5 });
  });

  it('a source report that cannot be loaded says so', async () => {
    vi.mocked(dynamicReportsApi.getReportDetail).mockRejectedValue(new Error('404'));
    renderCopy();
    expect(await screen.findByTestId('copy-error')).toBeInTheDocument();
  });
});
