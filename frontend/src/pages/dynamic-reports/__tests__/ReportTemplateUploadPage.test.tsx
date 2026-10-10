import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportTemplateUploadPage from '../ReportTemplateUploadPage';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { SheetInfo, TemplatePreviewResult } from '@/features/dynamic-reports/types';

vi.mock('@/features/dynamic-reports/api', () => ({
  dynamicReportsApi: {
    listTemplateSheets: vi.fn(),
    previewTemplate: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ReportTemplateUploadPage />
    </MemoryRouter>,
  );
}

function fakeFile(name = 'mau.xlsx'): File {
  return new File(['fake'], name, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

const SHEETS: SheetInfo[] = [
  { name: 'TỔNG', state: 'visible' },
  { name: 'Đội 3', state: 'visible' },
  { name: 'Đội 4', state: 'hidden' },
];

const PREVIEW: TemplatePreviewResult = {
  dateSystem: '1900',
  fields: [
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
  ],
  formulas: [],
  issues: [
    { sheetKey: 'Đội 3', address: 'C7', code: 'UNLOCKED_NO_TOKEN', severity: 'WARNING', message: 'Gợi ý đặt làm ô nhập.' },
  ],
  totalCells: 100,
  inputCellCount: 1,
  sha256: 'abc123',
  suggestedRules: [],
};

async function selectFileAndWaitForSheets() {
  const input = screen.getByTestId('file-input') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [fakeFile()] } });
  await waitFor(() => screen.getByTestId('sheet-checkbox-TỔNG'));
}

describe('ReportTemplateUploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads a file and lists its sheets as checkboxes', async () => {
    vi.mocked(dynamicReportsApi.listTemplateSheets).mockResolvedValue(SHEETS);
    renderPage();

    await selectFileAndWaitForSheets();

    expect(dynamicReportsApi.listTemplateSheets).toHaveBeenCalledWith(expect.any(File));
    expect(screen.getByTestId('sheet-checkbox-Đội 3')).toBeInTheDocument();
    expect(screen.getByTestId('sheet-checkbox-Đội 4')).toBeInTheDocument();
    expect(screen.getByText('(ẩn)')).toBeInTheDocument();
  });

  it('shows an error and stays on the upload step when listing sheets fails', async () => {
    vi.mocked(dynamicReportsApi.listTemplateSheets).mockRejectedValue(
      Object.assign(new Error('fail'), { isAxiosError: false }),
    );
    renderPage();

    const input = screen.getByTestId('file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fakeFile()] } });

    await waitFor(() => {
      expect(screen.getByText('fail')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('sheet-checkbox-TỔNG')).not.toBeInTheDocument();
  });

  it('caps sheet selection at 5 — a 6th checkbox is disabled', async () => {
    const eightSheets: SheetInfo[] = Array.from({ length: 8 }, (_, i) => ({
      name: `Sheet${i + 1}`,
      state: 'visible' as const,
    }));
    vi.mocked(dynamicReportsApi.listTemplateSheets).mockResolvedValue(eightSheets);
    renderPage();

    const input = screen.getByTestId('file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [fakeFile()] } });
    await waitFor(() => screen.getByTestId('sheet-checkbox-Sheet1'));

    for (let i = 1; i <= 5; i++) {
      fireEvent.click(screen.getByTestId(`sheet-checkbox-Sheet${i}`));
    }
    expect(screen.getByTestId('sheet-count')).toHaveTextContent('5/5');
    expect(screen.getByTestId('sheet-checkbox-Sheet6')).toBeDisabled();
  });

  it('previews the template after selecting sheets and renders field/issue counts', async () => {
    vi.mocked(dynamicReportsApi.listTemplateSheets).mockResolvedValue(SHEETS);
    vi.mocked(dynamicReportsApi.previewTemplate).mockResolvedValue(PREVIEW);
    renderPage();

    await selectFileAndWaitForSheets();
    fireEvent.click(screen.getByTestId('sheet-checkbox-Đội 3'));
    fireEvent.click(screen.getByTestId('btn-preview'));

    await waitFor(() => screen.getByTestId('preview-summary'));
    expect(dynamicReportsApi.previewTemplate).toHaveBeenCalledWith(expect.any(File), ['Đội 3']);
    expect(screen.getByTestId('issue-list')).toHaveTextContent('Gợi ý đặt làm ô nhập.');
  });

  it('shows a success message when preview finds zero issues', async () => {
    vi.mocked(dynamicReportsApi.listTemplateSheets).mockResolvedValue(SHEETS);
    vi.mocked(dynamicReportsApi.previewTemplate).mockResolvedValue({ ...PREVIEW, issues: [] });
    renderPage();

    await selectFileAndWaitForSheets();
    fireEvent.click(screen.getByTestId('sheet-checkbox-Đội 3'));
    fireEvent.click(screen.getByTestId('btn-preview'));

    await waitFor(() => screen.getByTestId('preview-summary'));
    expect(screen.getByText('Không có cảnh báo nào.')).toBeInTheDocument();
  });

  it('the preview button is disabled until at least one sheet is selected', async () => {
    vi.mocked(dynamicReportsApi.listTemplateSheets).mockResolvedValue(SHEETS);
    renderPage();

    await selectFileAndWaitForSheets();
    expect(screen.getByTestId('btn-preview')).toBeDisabled();

    fireEvent.click(screen.getByTestId('sheet-checkbox-Đội 3'));
    expect(screen.getByTestId('btn-preview')).not.toBeDisabled();
  });
});
