import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ReportTemplateUploadPage from '../ReportTemplateUploadPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import { api } from '@/lib/api';
import type {
  CriteriaExtractResult,
  CriteriaWorkbookResult,
  ReportDetailView,
  TemplatePreviewResult,
} from '@/features/dynamic-reports/types';
import { makeGrid } from '@/features/dynamic-reports/grid/__tests__/fixtures';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    listTemplateSheets: vi.fn(),
    previewTemplate: vi.fn(),
    extractCriteria: vi.fn(),
    buildCriteriaWorkbook: vi.fn(),
    getNonWorkingDates: vi.fn(),
    saveReportConfig: vi.fn(),
    createReportVersion: vi.fn(),
    downloadVersionFile: vi.fn(),
    getVersionGrid: vi.fn(),
  },
}));
vi.mock('@/hooks/useOfficerOptions', () => ({ useOfficerOptions: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

/**
 * "Chọn tiêu chí từ file Excel": the second way to start the wizard. The picked criteria become a generated workbook,
 * and from there on the wizard runs exactly as if the author had uploaded that workbook as a template.
 */
const BASE_PREVIEW = {
  dateSystem: '1900' as const,
  formulas: [],
  issues: [],
  markableCells: [],
  totalCells: 20,
  sha256: 'x',
  suggestedRules: [],
  layout: {},
};
/** The author's own file, drawn so a column can be picked. */
const SOURCE_PREVIEW = { ...BASE_PREVIEW, fields: [], inputCellCount: 0, grid: makeGrid() } as TemplatePreviewResult;
/** The generated workbook, read by the ordinary template reader: one token cell per criterion that is typed. */
const GENERATED_PREVIEW = {
  ...BASE_PREVIEW,
  inputCellCount: 2,
  layout: { sheetOrder: ['Chỉ tiêu'] },
  fields: [
    { sheetKey: 'Chỉ tiêu', address: 'C3', fieldKey: 'Chỉ tiêu!C3', label: 'Trộm cắp', type: 'NUM', format: '#,##0.##', aggregate: 'SUM', source: 'TOKEN' },
    { sheetKey: 'Chỉ tiêu', address: 'C4', fieldKey: 'Chỉ tiêu!C4', label: 'Cướp', type: 'NUM', format: '#,##0.##', aggregate: 'SUM', source: 'TOKEN' },
  ],
  grid: null,
} as TemplatePreviewResult;

const EXTRACTED: CriteriaExtractResult = {
  criteria: [
    { itemKey: 'toi-pham', code: null, name: 'Tội phạm', unit: null, parentItemKey: null, origin: 'FILE', sourceRow: 3 },
    { itemKey: 'trom-cap', code: null, name: 'Trộm cắp', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE', sourceRow: 4 },
  ],
  warnings: [],
};

const BUILT: CriteriaWorkbookResult = {
  fileName: 'tieu-chi.xlsx',
  fileBase64: btoa('PK-fake'),
  sheetName: 'Chỉ tiêu',
  criteria: [
    ...EXTRACTED.criteria,
    { itemKey: 'cuop', code: null, name: 'Cướp', unit: null, parentItemKey: 'toi-pham', origin: 'MANUAL', sourceRow: null },
  ],
  fields: [
    { address: 'C3', fieldKey: 'Chỉ tiêu!C3', itemKey: 'trom-cap', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE' },
    { address: 'C4', fieldKey: 'Chỉ tiêu!C4', itemKey: 'cuop', unit: null, parentItemKey: 'toi-pham', origin: 'MANUAL' },
  ],
};

const REPORT: ReportDetailView = {
  id: 'r1',
  code: 'HSLN',
  name: 'Thống kê hình sự',
  description: null,
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
    selectedSheets: ['Chỉ tiêu'],
    dateSystem: '1900',
    publishedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    fields: [
      // Same cell as a criterion of the new list, but another thing altogether: its settings must not travel.
      { sheetKey: 'Chỉ tiêu', address: 'C3', fieldKey: 'Chỉ tiêu!C3', label: 'Ô cũ', type: 'NUM', format: null, aggregate: 'SUM', blankPolicy: 'ZERO', required: true, min: null, max: null, scale: null, maxLength: null, helpText: 'Ghi chú cũ', source: 'WEB' },
    ],
    rules: [],
  },
  versionCount: 1,
  periods: [],
  periodTotal: 0,
};

function renderPage(report?: ReportDetailView) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ReportTemplateUploadPage report={report} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function fillCodeAndName() {
  fireEvent.change(screen.getByTestId('input-report-code'), { target: { value: 'TC' } });
  fireEvent.change(screen.getByTestId('input-report-name'), { target: { value: 'Báo cáo tiêu chí' } });
}

/** Criteria mode, a file, a sheet, the whole of column B, read. */
async function readCriteria() {
  fireEvent.click(screen.getByTestId('start-mode-criteria'));
  fireEvent.change(screen.getByTestId('criteria-file-input'), { target: { files: [new File(['x'], 'so-lieu.xlsx')] } });
  fireEvent.change(await screen.findByTestId('criteria-sheet'), { target: { value: 'Đội 3' } });
  fireEvent.click(await screen.findByTestId('col-header-B'));
  fireEvent.click(screen.getByTestId('btn-extract-criteria'));
  await screen.findByTestId('criteria-review');
}

async function useList() {
  fireEvent.change(screen.getByTestId('criteria-add-name'), { target: { value: 'Cướp' } });
  fireEvent.change(screen.getByTestId('criteria-add-parent'), { target: { value: 'toi-pham' } });
  fireEvent.click(screen.getByTestId('btn-add-criterion'));
  fireEvent.click(screen.getByTestId('btn-use-criteria'));
  await screen.findByTestId('preview-summary');
}

function openAndSelect(testId: string, optionValue: string) {
  fireEvent.click(screen.getByTestId(`${testId}-trigger`));
  fireEvent.click(screen.getByTestId(`${testId}-option-${optionValue}`));
}

describe('ReportTemplateUploadPage — "Chọn tiêu chí từ file Excel"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dynamicReportsApi.listTemplateSheets).mockResolvedValue([{ name: 'Đội 3', state: 'visible' }]);
    vi.mocked(dynamicReportsApi.previewTemplate).mockImplementation(async (_file, sheets) =>
      sheets[0] === 'Chỉ tiêu' ? GENERATED_PREVIEW : SOURCE_PREVIEW,
    );
    vi.mocked(dynamicReportsApi.extractCriteria).mockResolvedValue(EXTRACTED);
    vi.mocked(dynamicReportsApi.buildCriteriaWorkbook).mockResolvedValue(BUILT);
    vi.mocked(dynamicReportsApi.getNonWorkingDates).mockResolvedValue([]);
    vi.mocked(dynamicReportsApi.saveReportConfig).mockResolvedValue({ reportId: 'r9', versionId: 'v9', status: 'PUBLISHED' });
    vi.mocked(useOfficerOptions).mockReturnValue({
      data: [{ value: 'u1', label: 'Nguyễn An', teams: [] }],
      isLoading: false,
    } as never);
    vi.mocked(api.get).mockResolvedValue({
      data: [
        { id: 't1', name: 'Tổ 1', wardId: null },
        { id: 't2', name: 'Tổ 2', wardId: null },
      ],
    });
  });

  it('the template way is the default and is untouched; the criteria way is offered next to it', () => {
    renderPage();
    expect(screen.getByTestId('start-mode-template')).toBeChecked();
    expect(screen.getByTestId('file-input')).toBeInTheDocument();
    expect(screen.queryByTestId('criteria-picker')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('start-mode-criteria'));
    expect(screen.getByTestId('criteria-picker')).toBeInTheDocument();
    expect(screen.queryByTestId('file-input')).not.toBeInTheDocument();
  });

  it('"Dùng danh sách này" reads the generated workbook like an uploaded template with its sheet chosen', async () => {
    renderPage();
    fillCodeAndName();
    await readCriteria();
    await useList();

    const calls = vi.mocked(dynamicReportsApi.previewTemplate).mock.calls;
    const [file, sheets] = calls[calls.length - 1];
    expect(file.name).toBe('tieu-chi.xlsx');
    expect(sheets).toEqual(['Chỉ tiêu']);
    // Every typed criterion is already an input cell: nothing is left to mark.
    expect(screen.getByTestId('field-list')).toHaveTextContent('Trộm cắp');
    expect(screen.getByTestId('field-list')).toHaveTextContent('Cướp');
    expect(screen.queryByTestId('markable-cells-section')).not.toBeInTheDocument();
    expect(screen.getByTestId('btn-go-to-schedule')).toBeInTheDocument();
  });

  it('needs the report code and name first, like the template way', async () => {
    renderPage();
    await readCriteria();
    expect(screen.getByTestId('btn-use-criteria')).toBeDisabled();
    fillCodeAndName();
    expect(screen.getByTestId('btn-use-criteria')).not.toBeDisabled();
  });

  it('is not a one-way step: the author can go back, change the list and use it again', async () => {
    renderPage();
    fillCodeAndName();
    await readCriteria();
    await useList();

    expect(screen.getByTestId('criteria-used-note')).toHaveTextContent('3 tiêu chí');
    expect(screen.getByTestId('criteria-review')).not.toBeVisible();

    fireEvent.click(screen.getByTestId('btn-edit-criteria'));
    expect(screen.getByTestId('criteria-review')).toBeVisible();
    expect(screen.queryByTestId('preview-summary')).not.toBeInTheDocument();
    // The list is the one that was built (the hand-typed criterion is still there), and the pick is still on the sheet.
    expect(screen.getByTestId('criterion-manual-cuop')).toBeInTheDocument();
    expect(screen.getByTestId('col-header-B')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByTestId('criterion-name-trom-cap'), { target: { value: 'Trộm cắp tài sản' } });
    fireEvent.click(screen.getByTestId('btn-use-criteria'));
    await screen.findByTestId('preview-summary');
    expect(dynamicReportsApi.buildCriteriaWorkbook).toHaveBeenCalledTimes(2);
    expect(vi.mocked(dynamicReportsApi.buildCriteriaWorkbook).mock.calls[1][0][1]).toMatchObject({
      itemKey: 'trom-cap',
      name: 'Trộm cắp tài sản',
    });
  });

  it('when the generated workbook cannot be read the author stays on the list and sees why', async () => {
    renderPage();
    fillCodeAndName();
    await readCriteria();
    vi.mocked(dynamicReportsApi.previewTemplate).mockRejectedValueOnce(new Error('Mẫu không đọc được'));
    fireEvent.click(screen.getByTestId('btn-use-criteria'));

    expect(await screen.findByTestId('criteria-build-error')).toHaveTextContent('Mẫu không đọc được');
    expect(screen.queryByTestId('preview-summary')).not.toBeInTheDocument();
    expect(screen.getByTestId('criteria-review')).toBeVisible();
  });

  it('switching back to the template way starts that way from its top', async () => {
    renderPage();
    fillCodeAndName();
    await readCriteria();
    await useList();

    fireEvent.click(screen.getByTestId('start-mode-template'));
    expect(screen.queryByTestId('preview-summary')).not.toBeInTheDocument();
    expect(screen.getByTestId('file-input')).toBeInTheDocument();
    expect(screen.queryByTestId('sheet-checkbox-Chỉ tiêu')).not.toBeInTheDocument();
  });

  it('through to saving: each field carries its criterion, the payload says CRITERIA, a team sends its subset', async () => {
    renderPage();
    fillCodeAndName();
    await readCriteria();
    await useList();

    fireEvent.click(screen.getByTestId('btn-go-to-schedule'));
    fireEvent.click(await screen.findByTestId('btn-schedule-next'));

    await screen.findByTestId('teams-step');
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    openAndSelect('select-add-manager', 'u1');
    fireEvent.click(screen.getByTestId('btn-add-manager'));
    for (const team of ['t1', 't2']) {
      openAndSelect('select-add-team', team);
      fireEvent.click(screen.getByTestId('btn-add-team'));
      openAndSelect(`select-add-editor-${team}`, 'u1');
      fireEvent.click(screen.getByTestId(`btn-add-editor-${team}`));
    }
    // The checklist is the criteria the report has: the two that are typed, under their parent.
    expect(screen.getByTestId('team-criteria-count-t1')).toHaveTextContent('Tổ 1: 2/2 tiêu chí');
    fireEvent.click(screen.getByTestId('btn-team-criteria-toggle-t1'));
    expect(screen.getByTestId('team-criteria-group-t1-toi-pham')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('team-criteria-item-t1-cuop'));
    fireEvent.click(screen.getByTestId('btn-teams-next'));

    fireEvent.click(await screen.findByTestId('btn-rules-next'));

    await screen.findByTestId('summary-step');
    expect(screen.getByTestId('summary-source')).toHaveTextContent('Sinh từ danh sách tiêu chí');
    expect(screen.getByTestId('summary-team-criteria-t1')).toHaveTextContent('Tổ 1: 1/2 tiêu chí');
    expect(screen.getByTestId('summary-team-criteria-t2')).toHaveTextContent('Tổ 2: 2/2 tiêu chí');

    fireEvent.click(screen.getByTestId('btn-publish'));
    await waitFor(() => expect(dynamicReportsApi.saveReportConfig).toHaveBeenCalledTimes(1));
    const [file, config] = vi.mocked(dynamicReportsApi.saveReportConfig).mock.calls[0];
    expect(file.name).toBe('tieu-chi.xlsx');
    expect(config.sourceKind).toBe('CRITERIA');
    expect(config.selectedSheets).toEqual(['Chỉ tiêu']);
    expect(config.layout).toEqual({ sheetOrder: ['Chỉ tiêu'] });
    expect(config.fields).toEqual([
      { ...GENERATED_PREVIEW.fields[0], itemKey: 'trom-cap', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE' },
      { ...GENERATED_PREVIEW.fields[1], itemKey: 'cuop', parentItemKey: 'toi-pham', origin: 'MANUAL' },
    ]);
    expect(config.targets).toEqual([
      { teamId: 't1', editorUserIds: ['u1'], itemKeys: ['trom-cap'] },
      { teamId: 't2', editorUserIds: ['u1'] },
    ]);
  });

  it('an ordinary template report saves as before: no sourceKind, no criterion on any field', async () => {
    vi.mocked(dynamicReportsApi.previewTemplate).mockResolvedValue({
      ...GENERATED_PREVIEW,
      fields: [{ ...GENERATED_PREVIEW.fields[0], sheetKey: 'Đội 3', fieldKey: 'Đội 3!C3' }],
    });
    renderPage();
    fillCodeAndName();
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [new File(['x'], 'mau.xlsx')] } });
    fireEvent.click(await screen.findByTestId('sheet-checkbox-Đội 3'));
    fireEvent.click(screen.getByTestId('btn-preview'));
    fireEvent.click(await screen.findByTestId('btn-go-to-schedule'));
    fireEvent.click(await screen.findByTestId('btn-schedule-next'));
    await screen.findByTestId('teams-step');
    await waitFor(() => expect(api.get).toHaveBeenCalled());
    openAndSelect('select-add-manager', 'u1');
    fireEvent.click(screen.getByTestId('btn-add-manager'));
    openAndSelect('select-add-team', 't1');
    fireEvent.click(screen.getByTestId('btn-add-team'));
    openAndSelect('select-add-editor-t1', 'u1');
    fireEvent.click(screen.getByTestId('btn-add-editor-t1'));
    fireEvent.click(screen.getByTestId('btn-teams-next'));
    fireEvent.click(await screen.findByTestId('btn-rules-next'));
    fireEvent.click(await screen.findByTestId('btn-publish'));

    await waitFor(() => expect(dynamicReportsApi.saveReportConfig).toHaveBeenCalledTimes(1));
    const config = vi.mocked(dynamicReportsApi.saveReportConfig).mock.calls[0][1];
    expect(config).not.toHaveProperty('sourceKind');
    expect(config.fields[0]).not.toHaveProperty('itemKey');
    expect(config.targets).toEqual([{ teamId: 't1', editorUserIds: ['u1'] }]);
  });

  describe('in "Cập nhật mẫu" (new version of an existing report)', () => {
    it('the same start works: the new version is saved as CRITERIA with each field\'s criterion', async () => {
      vi.mocked(dynamicReportsApi.createReportVersion).mockResolvedValue({
        reportId: 'r1',
        versionId: 'v2',
        version: 2,
        status: 'PUBLISHED',
        appliedToPeriods: [],
        keptOnOldVersionPeriods: [],
      });
      renderPage(REPORT);
      // No code or name to type here: they belong to the report.
      await readCriteria();
      await useList();
      expect(screen.queryByTestId('carry-over-note')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('btn-go-to-schedule'));
      fireEvent.click(await screen.findByTestId('btn-rules-next'));
      expect(await screen.findByTestId('version-summary-source')).toHaveTextContent('Sinh từ danh sách tiêu chí');
      fireEvent.click(screen.getByTestId('btn-version-publish'));

      await waitFor(() => expect(dynamicReportsApi.createReportVersion).toHaveBeenCalledTimes(1));
      const [reportId, file, payload] = vi.mocked(dynamicReportsApi.createReportVersion).mock.calls[0];
      expect(reportId).toBe('r1');
      expect(file.name).toBe('tieu-chi.xlsx');
      expect(payload.sourceKind).toBe('CRITERIA');
      expect(payload.fields).toEqual([
        { ...GENERATED_PREVIEW.fields[0], itemKey: 'trom-cap', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE' },
        { ...GENERATED_PREVIEW.fields[1], itemKey: 'cuop', parentItemKey: 'toi-pham', origin: 'MANUAL' },
      ]);
    });
  });
});
