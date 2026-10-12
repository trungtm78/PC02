import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SubmissionInputPage from '../SubmissionInputPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { SubmissionView } from '@/features/dynamic-reports/types';
import { makeGrid } from '@/features/dynamic-reports/grid/__tests__/fixtures';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    getSubmission: vi.fn(),
    getVersionGrid: vi.fn(),
    saveSubmissionValues: vi.fn(),
    submitSubmission: vi.fn(),
    validateForSubmit: vi.fn(),
    requestUnlock: vi.fn(),
    previewExcelImport: vi.fn(),
    applyExcelImport: vi.fn(),
    exportOwnSubmission: vi.fn(),
    listComments: vi.fn(),
    addComment: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/bao-cao-dong/nhap/assign1']}>
        <Routes>
          <Route path="/bao-cao-dong/nhap/:assignmentId" element={<SubmissionInputPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const field = (address: string, label: string, over: Record<string, unknown> = {}) => ({
  fieldKey: `Đội 3!${address}`,
  sheetKey: 'Đội 3',
  address,
  label,
  type: 'NUM' as const,
  format: null,
  aggregate: 'SUM' as const,
  required: false,
  min: null,
  max: null,
  scale: null,
  maxLength: null,
  ...over,
});

const VIEW: SubmissionView = {
  assignmentId: 'assign1',
  versionId: 'version1',
  reportName: 'HSLN',
  periodKey: '2026-10',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  opensAt: '2026-10-01T00:00:00.000Z',
  dueAt: '2026-11-05T17:00:00.000Z',
  state: 'DRAFT',
  revision: '1',
  values: { 'Đội 3!C1': { t: 'NUM', v: '5' } },
  fields: [field('C1', 'Số vụ mới'), field('C2', 'Đã giải quyết', { min: '0' })],
  editable: true,
  effectiveLockAt: '2026-11-05T17:00:00.000Z',
  serverTime: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-09T08:30:00.000Z',
};

/** Two input rows, C1 and C2, under a label column. */
const GRID = makeGrid({}, {
  rows: 2,
  cols: 3,
  colWidthsPx: [40, 60, 80],
  rowHeightsPx: [20, 20],
  hiddenRows: [],
  hiddenCols: [],
  merges: [],
  freeze: { rows: 0, cols: 0 },
  cells: {
    A1: { k: 'text', v: 'Vụ mới', s: 0 },
    A2: { k: 'text', v: 'Đã giải quyết', s: 0 },
    C1: { k: 'empty', s: 3 },
    C2: { k: 'empty', s: 3 },
  },
});

const saved = (revision: string) => ({
  revision,
  state: 'DRAFT' as const,
  savedAt: '2026-10-12T10:00:00.000Z',
  serverTime: '2026-10-12T10:00:00.000Z',
  effectiveLockAt: null,
});

async function openGrid() {
  await waitFor(() => screen.getByTestId('layout-grid'));
  fireEvent.click(screen.getByTestId('layout-grid'));
  await waitFor(() => screen.getByTestId('grid-editor'));
}

const editor = () => screen.getByTestId('grid-editor') as HTMLTextAreaElement;

function typeText(text: string) {
  for (const ch of text) {
    fireEvent.keyDown(editor(), { key: ch });
    fireEvent.change(editor(), { target: { value: editor().value + ch } });
  }
}

describe('SubmissionInputPage — entry grid (G3c)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(dynamicReportsApi.validateForSubmit).mockResolvedValue({ errors: [], warnings: [] });
    vi.mocked(dynamicReportsApi.listComments).mockResolvedValue([]);
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue(VIEW);
    vi.mocked(dynamicReportsApi.getVersionGrid).mockResolvedValue(GRID);
  });

  it('opens on the list; the grid is one click away and replaces the list', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('input-Đội 3!C1'));
    expect(screen.getByTestId('layout-list')).toHaveAttribute('aria-pressed', 'true');
    expect(dynamicReportsApi.getVersionGrid).not.toHaveBeenCalled();

    await openGrid();
    expect(dynamicReportsApi.getVersionGrid).toHaveBeenCalledWith('version1');
    expect(screen.getByTestId('cell-C1')).toHaveTextContent('5'); // the saved value, formatted by the cell
    expect(screen.getByTestId('input-Đội 3!C1').closest('form')).toHaveAttribute('hidden');
  });

  it('typing a value and leaving the grid saves it, as the canonical number', async () => {
    vi.mocked(dynamicReportsApi.saveSubmissionValues).mockResolvedValue(saved('2'));
    renderPage();
    await openGrid();

    fireEvent.mouseDown(screen.getByTestId('cell-C2'), { button: 0 });
    typeText('1.234,5');
    fireEvent.keyDown(editor(), { key: 'Enter' });
    fireEvent.blur(editor());

    await waitFor(() => expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledTimes(1));
    expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledWith(
      'assign1',
      { 'Đội 3!C2': '1234.5' },
      '1',
      expect.any(String),
    );
    expect(screen.getByTestId('cell-C2')).toHaveTextContent('1.235');
  });

  it('a pasted block is saved at once, in one request', async () => {
    vi.mocked(dynamicReportsApi.saveSubmissionValues).mockResolvedValue(saved('2'));
    renderPage();
    await openGrid();

    fireEvent.mouseDown(screen.getByTestId('cell-C1'), { button: 0 });
    fireEvent.paste(editor(), { clipboardData: { getData: () => '10\n20' } });

    await waitFor(() => expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledTimes(1));
    expect(vi.mocked(dynamicReportsApi.saveSubmissionValues).mock.calls[0][1]).toEqual({
      'Đội 3!C1': '10',
      'Đội 3!C2': '20',
    });
  });

  it('a value the server rejects flags the cell and keeps what was typed', async () => {
    vi.mocked(dynamicReportsApi.saveSubmissionValues).mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { error: { code: 'CELL_VALIDATION', message: 'Ô "Đội 3!C2": không hợp lệ' } } },
    });
    renderPage();
    await openGrid();

    fireEvent.mouseDown(screen.getByTestId('cell-C2'), { button: 0 });
    typeText('7');
    fireEvent.keyDown(editor(), { key: 'Enter' });
    fireEvent.blur(editor());

    await waitFor(() => expect(screen.getByTestId('cell-C2')).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByTestId('cell-C2')).toHaveTextContent('7');
  });

  it('a locked submission can be read in the grid but not typed into', async () => {
    vi.mocked(dynamicReportsApi.getSubmission).mockResolvedValue({ ...VIEW, editable: false, state: 'SUBMITTED' });
    renderPage();
    await openGrid();

    fireEvent.mouseDown(screen.getByTestId('cell-C2'), { button: 0 });
    fireEvent.keyDown(editor(), { key: '5' });
    expect(screen.getByTestId('grid-notice')).toHaveTextContent('đã khoá');
    expect(dynamicReportsApi.saveSubmissionValues).not.toHaveBeenCalled();
  });

  it('falls back to the list, with a note, when the grid cannot be built', async () => {
    vi.mocked(dynamicReportsApi.getVersionGrid).mockRejectedValue(new Error('GRID_UNAVAILABLE'));
    renderPage();
    await waitFor(() => screen.getByTestId('layout-grid'));
    fireEvent.click(screen.getByTestId('layout-grid'));

    await waitFor(() => screen.getByTestId('grid-fallback-note'));
    expect(screen.getByTestId('layout-grid')).toBeDisabled();
    expect(screen.getByTestId('layout-list')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('input-Đội 3!C1')).toBeInTheDocument();
  });

  it('does not submit while the grid is holding a value it refused', async () => {
    vi.mocked(dynamicReportsApi.saveSubmissionValues).mockResolvedValue(saved('2'));
    vi.mocked(dynamicReportsApi.submitSubmission).mockResolvedValue({ ...saved('3'), state: 'SUBMITTED' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await openGrid();

    fireEvent.mouseDown(screen.getByTestId('cell-C2'), { button: 0 });
    typeText('abc'); // not a number
    fireEvent.blur(editor()); // clicking "Nộp" takes the focus away first
    fireEvent.click(screen.getByTestId('btn-submit'));

    await waitFor(() => expect(screen.getByTestId('save-error')).toHaveTextContent('C2'));
    expect(dynamicReportsApi.submitSubmission).not.toHaveBeenCalled();

    // Once the officer fixes it, submitting works again.
    fireEvent.change(editor(), { target: { value: '4' } });
    fireEvent.keyDown(editor(), { key: 'Enter' });
    fireEvent.click(screen.getByTestId('btn-submit'));
    await waitFor(() => expect(dynamicReportsApi.submitSubmission).toHaveBeenCalledTimes(1));
  });

  it('submitting from grid mode saves what is still being typed first', async () => {
    vi.mocked(dynamicReportsApi.saveSubmissionValues).mockResolvedValue(saved('2'));
    vi.mocked(dynamicReportsApi.submitSubmission).mockResolvedValue({ ...saved('3'), state: 'SUBMITTED' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderPage();
    await openGrid();

    fireEvent.mouseDown(screen.getByTestId('cell-C2'), { button: 0 });
    typeText('9');
    fireEvent.keyDown(editor(), { key: 'Enter' });
    fireEvent.click(screen.getByTestId('btn-submit'));

    await waitFor(() => expect(dynamicReportsApi.submitSubmission).toHaveBeenCalledTimes(1));
    const order = [
      vi.mocked(dynamicReportsApi.saveSubmissionValues).mock.invocationCallOrder[0],
      vi.mocked(dynamicReportsApi.submitSubmission).mock.invocationCallOrder[0],
    ];
    expect(order[0]).toBeLessThan(order[1]);
    expect(vi.mocked(dynamicReportsApi.saveSubmissionValues).mock.calls[0][1]).toEqual({ 'Đội 3!C2': '9' });
  });
});
