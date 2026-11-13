import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CriteriaSetup from '../CriteriaSetup';
import type { CriteriaBuilt } from '../CriteriaSetup';
import { dynamicReportsApi } from '../../api';
import type { CriteriaExtractResult, CriteriaWorkbookResult, TemplatePreviewResult } from '../../types';
import { makeGrid } from '../../grid/__tests__/fixtures';

vi.mock('../../api', () => ({
  dynamicReportsApi: {
    listTemplateSheets: vi.fn(),
    previewTemplate: vi.fn(),
    extractCriteria: vi.fn(),
    buildCriteriaWorkbook: vi.fn(),
    getVersionGrid: vi.fn(),
  },
}));

/** Read the criteria, correct the list, then hand the generated workbook to the wizard. */
const PREVIEW = {
  dateSystem: '1900',
  fields: [],
  formulas: [],
  issues: [],
  markableCells: [],
  totalCells: 20,
  inputCellCount: 0,
  sha256: 'x',
  suggestedRules: [],
  layout: {},
  grid: makeGrid(),
} as TemplatePreviewResult;

const EXTRACTED: CriteriaExtractResult = {
  criteria: [
    { itemKey: 'chi-tieu', code: null, name: 'Chỉ tiêu', unit: null, parentItemKey: null, origin: 'FILE', sourceRow: 2 },
    { itemKey: 'toi-pham', code: 'I', name: 'Tội phạm', unit: null, parentItemKey: null, origin: 'FILE', sourceRow: 3 },
    { itemKey: 'trom-cap', code: '1', name: 'Trộm cắp', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE', sourceRow: 4 },
    { itemKey: 'trom-cap-2', code: '2', name: 'Trộm cắp', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE', sourceRow: 5 },
  ],
  warnings: [
    { code: 'DUPLICATE_NAME', row: 5 },
    { code: 'BLANK_SKIPPED', row: 6 },
  ],
};

const BUILT: CriteriaWorkbookResult = {
  fileName: 'tieu-chi.xlsx',
  fileBase64: btoa('PK-fake'),
  sheetName: 'Chỉ tiêu',
  criteria: [
    { itemKey: 'toi-pham', code: 'I', name: 'Tội phạm', unit: null, parentItemKey: null, origin: 'FILE', sourceRow: 3 },
    { itemKey: 'trom-cap', code: '1', name: 'Trộm cắp tài sản', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE', sourceRow: 4 },
    { itemKey: 'cuop', code: null, name: 'Cướp', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'MANUAL', sourceRow: null },
  ],
  fields: [
    { address: 'C3', fieldKey: 'Chỉ tiêu!C3', itemKey: 'trom-cap', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE' },
    { address: 'C4', fieldKey: 'Chỉ tiêu!C4', itemKey: 'cuop', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'MANUAL' },
  ],
};

function axiosRefusal(code: string) {
  return Object.assign(new Error(code), {
    isAxiosError: true,
    response: { status: 400, data: { error: { code, message: code, details: [] } } },
  });
}

function renderSetup(props: Partial<Parameters<typeof CriteriaSetup>[0]> = {}) {
  const onUse = vi.fn<(built: CriteriaBuilt) => Promise<void>>().mockResolvedValue(undefined);
  const onEdit = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <CriteriaSetup canUse collapsed={false} onUse={onUse} onEdit={onEdit} {...props} />
    </QueryClientProvider>,
  );
  return { onUse, onEdit, view, client };
}

async function readCriteria() {
  fireEvent.change(screen.getByTestId('criteria-file-input'), { target: { files: [new File(['x'], 'so-lieu.xlsx')] } });
  fireEvent.change(await screen.findByTestId('criteria-sheet'), { target: { value: 'Đội 3' } });
  fireEvent.click(await screen.findByTestId('col-header-B'));
  fireEvent.click(screen.getByTestId('btn-extract-criteria'));
  await screen.findByTestId('criteria-review');
}

describe('CriteriaSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dynamicReportsApi.listTemplateSheets).mockResolvedValue([{ name: 'Đội 3', state: 'visible' }]);
    vi.mocked(dynamicReportsApi.previewTemplate).mockResolvedValue(PREVIEW);
    vi.mocked(dynamicReportsApi.extractCriteria).mockResolvedValue(EXTRACTED);
    vi.mocked(dynamicReportsApi.buildCriteriaWorkbook).mockResolvedValue(BUILT);
  });

  it('shows one row per criterion, the parent by indentation, the count, and how many are parents', async () => {
    renderSetup();
    await readCriteria();

    expect(screen.getByTestId('criteria-total')).toHaveTextContent('4 tiêu chí');
    expect(screen.getByTestId('criteria-total')).toHaveTextContent('1 tiêu chí cha');
    expect(screen.getByTestId('criterion-toi-pham')).toHaveAttribute('data-depth', '0');
    expect(screen.getByTestId('criterion-trom-cap')).toHaveAttribute('data-depth', '1');
    expect(screen.getByTestId('criterion-parent-toi-pham')).toBeInTheDocument();
    expect(screen.getByTestId('criterion-name-trom-cap')).toHaveValue('Trộm cắp');
    expect(screen.getByTestId('criterion-unit-trom-cap')).toHaveValue('vụ');
  });

  it('shows each warning on its row, in words, and the skipped blanks above the list', async () => {
    renderSetup();
    await readCriteria();

    expect(screen.getByTestId('criterion-warning-trom-cap-2-DUPLICATE_NAME')).toHaveTextContent('Trùng tên');
    expect(screen.queryByTestId('criterion-warning-trom-cap-DUPLICATE_NAME')).not.toBeInTheDocument();
    expect(screen.getByTestId('criteria-blank-skipped')).toHaveTextContent('6');
  });

  it('edit, remove and add by hand, then "Dùng danh sách này" sends that list and hands the workbook over', async () => {
    const { onUse } = renderSetup();
    await readCriteria();

    // The header cell came along with the whole column, and one row is a duplicate: remove both.
    fireEvent.click(screen.getByTestId('btn-remove-criterion-chi-tieu'));
    fireEvent.click(screen.getByTestId('btn-remove-criterion-trom-cap-2'));
    fireEvent.change(screen.getByTestId('criterion-name-trom-cap'), { target: { value: 'Trộm cắp tài sản' } });

    fireEvent.change(screen.getByTestId('criteria-add-name'), { target: { value: 'Cướp' } });
    fireEvent.change(screen.getByTestId('criteria-add-unit'), { target: { value: 'vụ' } });
    fireEvent.change(screen.getByTestId('criteria-add-parent'), { target: { value: 'toi-pham' } });
    fireEvent.click(screen.getByTestId('btn-add-criterion'));

    expect(screen.getByTestId('criterion-manual-cuop')).toHaveTextContent('Thêm tay');
    expect(screen.getByTestId('criterion-cuop')).toHaveAttribute('data-depth', '1');
    expect(screen.getByTestId('criteria-total')).toHaveTextContent('3 tiêu chí');
    expect(screen.getByTestId('criteria-add-name')).toHaveValue('');

    fireEvent.click(screen.getByTestId('btn-use-criteria'));
    await waitFor(() => expect(onUse).toHaveBeenCalledTimes(1));

    expect(dynamicReportsApi.buildCriteriaWorkbook).toHaveBeenCalledWith([
      { itemKey: 'toi-pham', code: 'I', name: 'Tội phạm', origin: 'FILE', sourceRow: 3 },
      { itemKey: 'trom-cap', code: '1', name: 'Trộm cắp tài sản', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'FILE', sourceRow: 4 },
      { itemKey: 'cuop', name: 'Cướp', unit: 'vụ', parentItemKey: 'toi-pham', origin: 'MANUAL' },
    ]);
    const built = onUse.mock.calls[0][0];
    expect(built.file).toBeInstanceOf(File);
    expect(built.file.name).toBe('tieu-chi.xlsx');
    expect(built.file.size).toBe(7);
    expect(built.sheetName).toBe('Chỉ tiêu');
    expect(built.meta).toEqual({ criteria: BUILT.criteria, fields: BUILT.fields });
  });

  it('a hand-typed criterion needs a name', async () => {
    renderSetup();
    await readCriteria();
    expect(screen.getByTestId('btn-add-criterion')).toBeDisabled();
    fireEvent.change(screen.getByTestId('criteria-add-unit'), { target: { value: 'vụ' } });
    expect(screen.getByTestId('btn-add-criterion')).toBeDisabled();
  });

  it('a criterion left without a name blocks "Dùng danh sách này"', async () => {
    renderSetup();
    await readCriteria();
    fireEvent.change(screen.getByTestId('criterion-name-trom-cap'), { target: { value: '  ' } });
    expect(screen.getByTestId('btn-use-criteria')).toBeDisabled();
  });

  it('an emptied list cannot be used, and a new criterion can still be typed', async () => {
    renderSetup();
    await readCriteria();
    for (const key of ['chi-tieu', 'trom-cap', 'trom-cap-2', 'toi-pham']) {
      fireEvent.click(screen.getByTestId(`btn-remove-criterion-${key}`));
    }
    expect(screen.getByTestId('criteria-empty')).toBeInTheDocument();
    expect(screen.getByTestId('btn-use-criteria')).toBeDisabled();

    fireEvent.change(screen.getByTestId('criteria-add-name'), { target: { value: 'Ma tuý' } });
    fireEvent.click(screen.getByTestId('btn-add-criterion'));
    expect(screen.getByTestId('btn-use-criteria')).not.toBeDisabled();
  });

  it('without a report code and name the list cannot be used yet, and the screen says why', async () => {
    renderSetup({ canUse: false });
    await readCriteria();
    expect(screen.getByTestId('btn-use-criteria')).toBeDisabled();
    expect(screen.getByTestId('criteria-need-code-name')).toBeInTheDocument();
  });

  it('a refusal while building is translated by its code and the list stays for correcting', async () => {
    vi.mocked(dynamicReportsApi.buildCriteriaWorkbook).mockRejectedValue(axiosRefusal('CRITERIA_PARENT_CYCLE'));
    const { onUse } = renderSetup();
    await readCriteria();
    fireEvent.click(screen.getByTestId('btn-use-criteria'));

    expect(await screen.findByTestId('criteria-build-error')).toHaveTextContent('vòng lặp');
    expect(onUse).not.toHaveBeenCalled();
    expect(screen.getByTestId('criteria-list')).toBeInTheDocument();
  });

  it('when the wizard cannot read the generated workbook the reason is shown here', async () => {
    const { onUse } = renderSetup();
    onUse.mockRejectedValue(new Error('Mẫu không đọc được'));
    await readCriteria();
    fireEvent.click(screen.getByTestId('btn-use-criteria'));
    expect(await screen.findByTestId('criteria-build-error')).toHaveTextContent('Mẫu không đọc được');
  });

  it('collapsed, it is one line with a way back, and the list is still there when it is opened again', async () => {
    const { onEdit, view, client, onUse } = renderSetup();
    await readCriteria();
    fireEvent.change(screen.getByTestId('criterion-name-trom-cap'), { target: { value: 'Đã sửa' } });

    const rerender = (collapsed: boolean) =>
      view.rerender(
        <QueryClientProvider client={client}>
          <CriteriaSetup canUse collapsed={collapsed} onUse={onUse} onEdit={onEdit} />
        </QueryClientProvider>,
      );
    rerender(true);
    expect(screen.getByTestId('criteria-used-note')).toHaveTextContent('4 tiêu chí');
    expect(screen.getByTestId('criteria-used-note')).toHaveTextContent('so-lieu.xlsx');
    expect(screen.getByTestId('criteria-review')).not.toBeVisible();

    fireEvent.click(within(screen.getByTestId('criteria-used-note')).getByTestId('btn-edit-criteria'));
    expect(onEdit).toHaveBeenCalled();

    rerender(false);
    expect(screen.getByTestId('criteria-review')).toBeVisible();
    expect(screen.getByTestId('criterion-name-trom-cap')).toHaveValue('Đã sửa');
  });
});
