import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CriteriaPicker from '../CriteriaPicker';
import { dynamicReportsApi } from '../../api';
import type { CriteriaExtractResult, TemplatePreviewResult } from '../../types';
import { makeGrid } from '../../grid/__tests__/fixtures';

vi.mock('../../api', () => ({
  dynamicReportsApi: {
    listTemplateSheets: vi.fn(),
    previewTemplate: vi.fn(),
    extractCriteria: vi.fn(),
    getVersionGrid: vi.fn(),
  },
}));

/**
 * The author points at one column of any workbook: the whole column (its letter) or some of its cells. In the
 * fixture sheet "Đội 3", column B holds the names (B2…B5, B7), column A the numbering, C4 a stray number.
 */
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
    { itemKey: 'vu-moi', code: null, name: 'Vụ mới', unit: null, parentItemKey: null, origin: 'FILE', sourceRow: 3 },
  ],
  warnings: [],
};

function axiosRefusal(code: string) {
  return Object.assign(new Error(code), {
    isAxiosError: true,
    response: { status: 400, data: { error: { code, message: code, details: [] } } },
  });
}

function renderPicker(onExtracted = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CriteriaPicker onExtracted={onExtracted} />
    </QueryClientProvider>,
  );
  return onExtracted;
}

const FILE = new File(['x'], 'so-lieu.xlsx');

async function uploadAndChooseSheet() {
  fireEvent.change(screen.getByTestId('criteria-file-input'), { target: { files: [FILE] } });
  fireEvent.change(await screen.findByTestId('criteria-sheet'), { target: { value: 'Đội 3' } });
}

function click(cell: string, init: MouseEventInit = {}) {
  fireEvent.mouseDown(screen.getByTestId(cell), { button: 0, ...init });
  fireEvent.mouseUp(document, init);
}

function drag(from: string, to: string) {
  fireEvent.mouseDown(screen.getByTestId(from), { button: 0 });
  fireEvent.mouseEnter(screen.getByTestId(to), { buttons: 1 });
  fireEvent.mouseUp(document);
}

describe('CriteriaPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dynamicReportsApi.listTemplateSheets).mockResolvedValue([
      { name: 'Đội 3', state: 'visible' },
      { name: 'Phụ lục', state: 'hidden' },
    ]);
    vi.mocked(dynamicReportsApi.previewTemplate).mockResolvedValue(PREVIEW);
    vi.mocked(dynamicReportsApi.extractCriteria).mockResolvedValue(EXTRACTED);
  });

  it('lists the sheets of the uploaded file and draws the ONE sheet that is chosen', async () => {
    renderPicker();
    await uploadAndChooseSheet();

    expect(dynamicReportsApi.listTemplateSheets).toHaveBeenCalledWith(FILE);
    await screen.findByTestId('criteria-grid-section');
    expect(dynamicReportsApi.previewTemplate).toHaveBeenCalledWith(FILE, ['Đội 3']);
    expect(screen.getByTestId('grid-viewer')).toBeInTheDocument();
    expect(screen.getByTestId('criteria-selected-count')).toHaveTextContent('Chưa chọn ô nào');
    expect(screen.getByTestId('btn-extract-criteria')).toBeDisabled();
  });

  it('cells with text or a number can be picked; blanks and formulas cannot', async () => {
    renderPicker();
    await uploadAndChooseSheet();
    await screen.findByTestId('criteria-grid-section');

    expect(screen.getByTestId('cell-B3')).toHaveAttribute('data-mark', 'candidate');
    expect(screen.getByTestId('cell-C4')).toHaveAttribute('data-mark', 'candidate');
    expect(screen.getByTestId('cell-C3')).not.toHaveAttribute('data-mark');
    expect(screen.getByTestId('cell-C5')).not.toHaveAttribute('data-mark');
  });

  it('a click on a column letter picks the whole column, and the extract request names no rows', async () => {
    const onExtracted = renderPicker();
    await uploadAndChooseSheet();
    fireEvent.click(await screen.findByTestId('col-header-B'));

    expect(screen.getByTestId('col-header-B')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('criteria-selected-count')).toHaveTextContent('Đã chọn 5 ô ở cột B');
    expect(screen.getByTestId('cell-B7')).toHaveAttribute('data-mark', 'chosen');
    expect(screen.getByTestId('cell-A3')).toHaveAttribute('data-mark', 'candidate');

    fireEvent.click(screen.getByTestId('btn-extract-criteria'));
    await waitFor(() => expect(onExtracted).toHaveBeenCalledWith(EXTRACTED, FILE));
    expect(dynamicReportsApi.extractCriteria).toHaveBeenCalledWith(FILE, {
      sheet: 'Đội 3',
      column: 'B',
      hierarchy: 'NONE',
    });
  });

  it('dragging over cells of one column picks those rows; Ctrl adds one more', async () => {
    renderPicker();
    await uploadAndChooseSheet();
    await screen.findByTestId('criteria-grid-section');

    drag('cell-B3', 'cell-B4');
    expect(screen.getByTestId('criteria-selected-count')).toHaveTextContent('Đã chọn 2 ô ở cột B');
    click('cell-B7', { ctrlKey: true });
    expect(screen.getByTestId('criteria-selected-count')).toHaveTextContent('Đã chọn 3 ô ở cột B');
    expect(screen.queryByTestId('criteria-switched-note')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('btn-extract-criteria'));
    await waitFor(() => expect(dynamicReportsApi.extractCriteria).toHaveBeenCalledTimes(1));
    expect(vi.mocked(dynamicReportsApi.extractCriteria).mock.calls[0][1]).toEqual({
      sheet: 'Đội 3',
      column: 'B',
      rows: [3, 4, 7],
      hierarchy: 'NONE',
    });
  });

  it('picking a cell in another column switches the column, clears the earlier cells and says so', async () => {
    renderPicker();
    await uploadAndChooseSheet();
    await screen.findByTestId('criteria-grid-section');

    drag('cell-B3', 'cell-B4');
    click('cell-A5', { ctrlKey: true });

    expect(screen.getByTestId('criteria-selected-count')).toHaveTextContent('Đã chọn 1 ô ở cột A');
    expect(screen.getByTestId('criteria-switched-note')).toHaveTextContent('cột A');
    expect(screen.getByTestId('cell-B3')).toHaveAttribute('data-mark', 'candidate');
    expect(screen.getByTestId('cell-A5')).toHaveAttribute('data-mark', 'chosen');
  });

  it('the pick can be cleared, and then nothing can be read', async () => {
    renderPicker();
    await uploadAndChooseSheet();
    fireEvent.click(await screen.findByTestId('col-header-B'));
    fireEvent.click(screen.getByTestId('btn-criteria-clear'));

    expect(screen.getByTestId('criteria-selected-count')).toHaveTextContent('Chưa chọn ô nào');
    expect(screen.getByTestId('btn-extract-criteria')).toBeDisabled();
  });

  it('sends the code column, the unit column and the parent–child rule when they are set', async () => {
    renderPicker();
    await uploadAndChooseSheet();
    fireEvent.click(await screen.findByTestId('col-header-B'));

    expect(screen.getByTestId('criteria-code-column')).toHaveValue('');
    fireEvent.change(screen.getByTestId('criteria-code-column'), { target: { value: 'A' } });
    fireEvent.change(screen.getByTestId('criteria-unit-column'), { target: { value: 'E' } });
    fireEvent.click(screen.getByTestId('criteria-hierarchy-NUMBERING'));
    fireEvent.click(screen.getByTestId('btn-extract-criteria'));

    await waitFor(() => expect(dynamicReportsApi.extractCriteria).toHaveBeenCalledTimes(1));
    expect(vi.mocked(dynamicReportsApi.extractCriteria).mock.calls[0][1]).toEqual({
      sheet: 'Đội 3',
      column: 'B',
      codeColumn: 'A',
      unitColumn: 'E',
      hierarchy: 'NUMBERING',
    });
  });

  it('a refusal is said in the screen\'s own words, by its code', async () => {
    vi.mocked(dynamicReportsApi.extractCriteria).mockRejectedValue(axiosRefusal('CRITERIA_EMPTY'));
    const onExtracted = renderPicker();
    await uploadAndChooseSheet();
    fireEvent.click(await screen.findByTestId('col-header-D'));
    fireEvent.click(screen.getByTestId('btn-extract-criteria'));

    expect(await screen.findByTestId('criteria-picker-error')).toHaveTextContent('Không có tiêu chí nào');
    expect(onExtracted).not.toHaveBeenCalled();
  });

  it('a code the screen does not know shows what the server said', async () => {
    vi.mocked(dynamicReportsApi.extractCriteria).mockRejectedValue(axiosRefusal('SOMETHING_NEW'));
    renderPicker();
    await uploadAndChooseSheet();
    fireEvent.click(await screen.findByTestId('col-header-B'));
    fireEvent.click(screen.getByTestId('btn-extract-criteria'));

    expect(await screen.findByTestId('criteria-picker-error')).toHaveTextContent('SOMETHING_NEW');
  });

  describe('when the sheet cannot be drawn', () => {
    beforeEach(() => {
      vi.mocked(dynamicReportsApi.previewTemplate).mockResolvedValue({ ...PREVIEW, grid: null });
    });

    it('asks for the column letter and a row range instead of leaving a dead end', async () => {
      renderPicker();
      await uploadAndChooseSheet();

      expect(await screen.findByTestId('criteria-manual-range')).toBeInTheDocument();
      expect(screen.queryByTestId('criteria-grid-section')).not.toBeInTheDocument();
      expect(screen.getByTestId('btn-extract-criteria')).toBeDisabled();

      fireEvent.change(screen.getByTestId('criteria-manual-column'), { target: { value: 'b' } });
      fireEvent.change(screen.getByTestId('criteria-manual-from'), { target: { value: '3' } });
      fireEvent.change(screen.getByTestId('criteria-manual-to'), { target: { value: '5' } });
      fireEvent.click(screen.getByTestId('btn-extract-criteria'));

      await waitFor(() => expect(dynamicReportsApi.extractCriteria).toHaveBeenCalledTimes(1));
      expect(vi.mocked(dynamicReportsApi.extractCriteria).mock.calls[0][1]).toEqual({
        sheet: 'Đội 3',
        column: 'B',
        rows: [3, 4, 5],
        hierarchy: 'NONE',
      });
    });

    it('a column alone means the whole column; a bad range is refused before anything is sent', async () => {
      renderPicker();
      await uploadAndChooseSheet();
      await screen.findByTestId('criteria-manual-range');

      fireEvent.change(screen.getByTestId('criteria-manual-column'), { target: { value: 'B' } });
      fireEvent.change(screen.getByTestId('criteria-manual-from'), { target: { value: '9' } });
      fireEvent.change(screen.getByTestId('criteria-manual-to'), { target: { value: '2' } });
      expect(screen.getByTestId('criteria-manual-invalid')).toBeInTheDocument();
      expect(screen.getByTestId('btn-extract-criteria')).toBeDisabled();

      fireEvent.change(screen.getByTestId('criteria-manual-from'), { target: { value: '' } });
      fireEvent.change(screen.getByTestId('criteria-manual-to'), { target: { value: '' } });
      fireEvent.click(screen.getByTestId('btn-extract-criteria'));
      await waitFor(() => expect(dynamicReportsApi.extractCriteria).toHaveBeenCalledTimes(1));
      expect(vi.mocked(dynamicReportsApi.extractCriteria).mock.calls[0][1]).toEqual({
        sheet: 'Đội 3',
        column: 'B',
        hierarchy: 'NONE',
      });
    });

    it('a file the template reader refuses outright still gets the typed route', async () => {
      vi.mocked(dynamicReportsApi.previewTemplate).mockRejectedValue(axiosRefusal('TEMPLATE_GUARD'));
      renderPicker();
      await uploadAndChooseSheet();
      expect(await screen.findByTestId('criteria-manual-range')).toBeInTheDocument();
    });
  });
});
