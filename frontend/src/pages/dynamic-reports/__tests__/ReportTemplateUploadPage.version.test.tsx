import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportTemplateUploadPage from '../ReportTemplateUploadPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { ReportDetailView, TemplatePreviewResult } from '@/features/dynamic-reports/types';
import { makeGrid } from '@/features/dynamic-reports/grid/__tests__/fixtures';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    listTemplateSheets: vi.fn(),
    previewTemplate: vi.fn(),
    getNonWorkingDates: vi.fn(),
    downloadVersionFile: vi.fn(),
    createReportVersion: vi.fn(),
  },
}));

/** "Cập nhật mẫu": the same wizard, run for an existing report. */
const REPORT: ReportDetailView = {
  id: 'r1',
  code: 'HSLN',
  name: 'Thống kê hình sự',
  description: 'Mô tả cũ',
  status: 'PUBLISHED',
  reportingUnit: 'TEAM',
  effectiveFrom: '2026-10-01T00:00:00.000Z',
  configVersion: 3,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  schedule: null,
  roles: [],
  targets: [],
  currentVersion: {
    versionId: 'v1',
    version: 1,
    status: 'PUBLISHED',
    fileName: 'mau-cu.xlsx',
    selectedSheets: ['Đội 3'],
    dateSystem: '1900',
    publishedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    fields: [
      { sheetKey: 'Đội 3', address: 'C6', fieldKey: 'Đội 3!C6', label: 'Số vụ cũ', type: 'NUM', format: null, aggregate: 'SUM', blankPolicy: 'ZERO', required: true, min: null, max: null, scale: null, maxLength: null, helpText: null, source: 'WEB' },
      { sheetKey: 'Đội 3', address: 'C9', fieldKey: 'Đội 3!C9', label: 'Ô đã mất', type: 'NUM', format: null, aggregate: 'SUM', blankPolicy: 'ZERO', required: false, min: null, max: null, scale: null, maxLength: null, helpText: null, source: 'WEB' },
    ],
    rules: [
      { name: 'Quy tắc cũ', leftExpr: 'C6', operator: 'GTE', rightExpr: '0', severity: 'ERROR', message: 'Không âm', missingStrategy: null, origin: 'MANUAL' },
    ],
  },
  versionCount: 1,
  periods: [],
  periodTotal: 0,
};

const PREVIEW: TemplatePreviewResult = {
  dateSystem: '1900',
  fields: [],
  formulas: [],
  issues: [],
  markableCells: [{ sheetKey: 'Đội 3', address: 'C6', suggestedLabel: null }],
  totalCells: 100,
  inputCellCount: 0,
  sha256: 'abc',
  suggestedRules: [],
  layout: {},
};

function renderVersionPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReportTemplateUploadPage report={REPORT} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const newFile = () => new File(['x'], 'mau-moi.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

async function chooseFile() {
  fireEvent.change(screen.getByTestId('file-input'), { target: { files: [newFile()] } });
  await waitFor(() => screen.getByTestId('sheet-checkbox-Đội 3'));
}

describe('ReportTemplateUploadPage — "Cập nhật mẫu" (version mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dynamicReportsApi.listTemplateSheets).mockResolvedValue([
      { name: 'Đội 3', state: 'visible' },
      { name: 'Đội 4', state: 'visible' },
    ]);
    vi.mocked(dynamicReportsApi.previewTemplate).mockResolvedValue({ ...PREVIEW, grid: makeGrid({}, {}) } as TemplatePreviewResult);
    vi.mocked(dynamicReportsApi.getNonWorkingDates).mockResolvedValue([]);
  });

  it('is about this report: no code/name/description to type again, and the title names it', () => {
    renderVersionPage();
    expect(screen.getByTestId('wizard-title')).toHaveTextContent('Cập nhật mẫu — Thống kê hình sự');
    expect(screen.queryByTestId('input-report-code')).not.toBeInTheDocument();
    expect(screen.queryByTestId('input-report-name')).not.toBeInTheDocument();
    expect(screen.getByTestId('version-mode-note')).toHaveTextContent('HSLN');
  });

  it('pre-selects the sheets the report already uses, and previews without asking for a code or name', async () => {
    renderVersionPage();
    await chooseFile();

    expect(screen.getByTestId('sheet-checkbox-Đội 3')).toBeChecked();
    expect(screen.getByTestId('sheet-checkbox-Đội 4')).not.toBeChecked();
    expect(screen.getByTestId('btn-preview')).toBeEnabled();
  });

  it('carries the previous input cells over and says which ones the new template no longer has', async () => {
    renderVersionPage();
    await chooseFile();
    fireEvent.click(screen.getByTestId('btn-preview'));

    const note = await screen.findByTestId('carry-over-note');
    expect(note).toHaveTextContent('Giữ lại 1 ô nhập');
    expect(screen.getByTestId('carry-over-lost')).toHaveTextContent('Đội 3!C9');
    expect(screen.getByTestId('field-list')).toHaveTextContent('Số vụ cũ');
  });

  it('goes from the preview straight to the rules (schedule and teams belong to the report), starting from the old rules', async () => {
    renderVersionPage();
    await chooseFile();
    fireEvent.click(screen.getByTestId('btn-preview'));
    fireEvent.click(await screen.findByTestId('btn-go-to-schedule'));

    expect(screen.queryByTestId('schedule-step')).not.toBeInTheDocument();
    expect(await screen.findByTestId('btn-rules-next')).toHaveTextContent('Xuất bản');
    expect(screen.getByText('Quy tắc cũ')).toBeInTheDocument();
  });

  it('"Dùng lại file đang áp dụng" loads the file the report already has, without a trip to the disk', async () => {
    vi.mocked(dynamicReportsApi.downloadVersionFile).mockResolvedValue(newFile());
    renderVersionPage();

    fireEvent.click(screen.getByTestId('btn-use-current-file'));

    await waitFor(() => expect(dynamicReportsApi.downloadVersionFile).toHaveBeenCalledWith('r1', 'v1', 'mau-cu.xlsx'));
    await waitFor(() => screen.getByTestId('sheet-checkbox-Đội 3'));
    expect(dynamicReportsApi.listTemplateSheets).toHaveBeenCalled();
  });

  it('publishes a new version for THIS report with the carried fields (their required flag included) and shows where it applies', async () => {
    vi.mocked(dynamicReportsApi.createReportVersion).mockResolvedValue({
      reportId: 'r1', versionId: 'v2', version: 2, status: 'PUBLISHED',
      appliedToPeriods: ['2026-10'], keptOnOldVersionPeriods: ['2026-09'],
    });
    renderVersionPage();
    await chooseFile();
    fireEvent.click(screen.getByTestId('btn-preview'));
    fireEvent.click(await screen.findByTestId('btn-go-to-schedule'));
    fireEvent.click(await screen.findByTestId('btn-rules-next'));

    expect(await screen.findByTestId('d09-explainer')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-version-publish'));

    await waitFor(() => expect(dynamicReportsApi.createReportVersion).toHaveBeenCalledTimes(1));
    const [reportId, file, payload] = vi.mocked(dynamicReportsApi.createReportVersion).mock.calls[0];
    expect(reportId).toBe('r1');
    expect((file as File).name).toBe('mau-moi.xlsx');
    expect(payload.publish).toBe(true);
    expect(payload.fields).toEqual([expect.objectContaining({ fieldKey: 'Đội 3!C6', label: 'Số vụ cũ', required: true })]);
    expect(payload.rules).toEqual([expect.objectContaining({ name: 'Quy tắc cũ' })]);

    const done = await screen.findByTestId('version-applied');
    expect(done).toHaveTextContent('2026-10');
    expect(done).toHaveTextContent('2026-09');
  });

  it('a server refusal is shown and nothing is reported as published', async () => {
    vi.mocked(dynamicReportsApi.createReportVersion).mockRejectedValue(new Error('Mẫu không hợp lệ'));
    renderVersionPage();
    await chooseFile();
    fireEvent.click(screen.getByTestId('btn-preview'));
    fireEvent.click(await screen.findByTestId('btn-go-to-schedule'));
    fireEvent.click(await screen.findByTestId('btn-rules-next'));
    fireEvent.click(await screen.findByTestId('btn-version-publish'));

    expect(await screen.findByTestId('version-save-error')).toBeInTheDocument();
    expect(screen.queryByTestId('version-result')).not.toBeInTheDocument();
  });

  it('a retry of the same attempt reuses the idempotency key, so a double click cannot create two versions', async () => {
    vi.mocked(dynamicReportsApi.createReportVersion).mockRejectedValueOnce(new Error('mạng')).mockResolvedValueOnce({
      reportId: 'r1', versionId: 'v2', version: 2, status: 'PUBLISHED', appliedToPeriods: [], keptOnOldVersionPeriods: [],
    });
    renderVersionPage();
    await chooseFile();
    fireEvent.click(screen.getByTestId('btn-preview'));
    fireEvent.click(await screen.findByTestId('btn-go-to-schedule'));
    fireEvent.click(await screen.findByTestId('btn-rules-next'));
    fireEvent.click(await screen.findByTestId('btn-version-publish'));
    await screen.findByTestId('version-save-error');
    fireEvent.click(screen.getByTestId('btn-version-publish'));
    await screen.findByTestId('version-result');

    const keys = vi.mocked(dynamicReportsApi.createReportVersion).mock.calls.map((c) => c[2].idempotencyKey);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
  });
});
