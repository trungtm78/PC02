import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WardChargeImportDialog } from '../WardChargeImportDialog';
import { api } from '@/lib/api';
import { teams as t } from '@/locales/vi';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

const I = t.wardCharges.import;

const PREVIEW_WITH_ERRORS = {
  previewToken: 'tok-1',
  canConfirm: false,
  totals: { rows: 2, wards: 3, errors: 1, warnings: 1 },
  rows: [
    {
      rowNumber: 2,
      teamName: 'Tổ công tác Số 4',
      teamId: 't4',
      wards: [{ name: 'Vườn Lài', wardId: 'd-vl', wardName: 'Phường Vườn Lài' }],
      count: 2,
      errors: [],
      warnings: [{ code: 'COUNT_MISMATCH', expected: 2, listed: 1 }],
    },
    {
      rowNumber: 3,
      teamName: 'Tổ công tác Số 77',
      teamId: null,
      wards: [{ name: 'Khánh Hội', wardId: 'd-kh', wardName: 'Phường Khánh Hội' }, { name: 'Phố Lạ', wardId: null, wardName: null }],
      count: 2,
      errors: [{ code: 'TEAM_NOT_FOUND', teamName: 'Tổ công tác Số 77' }],
      warnings: [],
    },
  ],
};
const CLEAN = {
  previewToken: 'tok-2',
  canConfirm: true,
  totals: { rows: 1, wards: 1, errors: 0, warnings: 0 },
  rows: [{ ...PREVIEW_WITH_ERRORS.rows[0], warnings: [], count: 1 }],
};

function renderDialog(onDone = vi.fn(), onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <WardChargeImportDialog onClose={onClose} onDone={onDone} />
    </QueryClientProvider>,
  );
  return { onDone, onClose };
}

const xlsx = (size = 100) => new File([new Uint8Array(size)], 'phuong-xa.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

describe('WardChargeImportDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('step 1: needs a file; a file over 1 MB is refused before any upload', () => {
    renderDialog();
    expect(screen.getByTestId('ward-charge-import-upload')).toBeDisabled();
    fireEvent.change(screen.getByTestId('ward-charge-import-file'), { target: { files: [xlsx(2 * 1024 * 1024)] } });
    expect(screen.getByTestId('ward-charge-import-failed')).toHaveTextContent(I.tooLarge);
    expect(screen.getByTestId('ward-charge-import-upload')).toBeDisabled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('step 2: every row with its errors and warnings; a preview with errors cannot be confirmed', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: PREVIEW_WITH_ERRORS });
    renderDialog();
    fireEvent.change(screen.getByTestId('ward-charge-import-file'), { target: { files: [xlsx()] } });
    fireEvent.click(screen.getByTestId('ward-charge-import-upload'));

    await screen.findByTestId('ward-charge-import-step2');
    expect(api.post).toHaveBeenCalledWith('/teams/ward-charges/import/preview', expect.any(FormData), expect.anything());
    expect(screen.getByTestId('ward-charge-import-summary')).toHaveTextContent(I.summary(2, 3, 1, 1));
    const row2 = screen.getByTestId('ward-charge-import-row-2');
    expect(within(row2).getByTestId('ward-charge-import-warning')).toHaveTextContent('Cột số lượng ghi 2 nhưng liệt kê 1 phường/xã');
    const row3 = screen.getByTestId('ward-charge-import-row-3');
    expect(within(row3).getByTestId('ward-charge-import-error')).toHaveTextContent('Không tìm thấy tổ "Tổ công tác Số 77"');
    expect(row3).toHaveTextContent('Phường Khánh Hội, Phố Lạ');
    expect(screen.getByTestId('ward-charge-import-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('ward-charge-import-confirm')).toBeDisabled();

    // Back to step 1 to choose another file.
    fireEvent.click(screen.getByTestId('ward-charge-import-back'));
    expect(screen.getByTestId('ward-charge-import-step1')).toBeInTheDocument();
  });

  it('confirm sends the token and the replace choice, then reports what was done', async () => {
    vi.mocked(api.post).mockImplementation(async (url: string) =>
      url.endsWith('/preview') ? { data: CLEAN } : { data: { added: 1, moved: 0, removed: 2 } },
    );
    const { onDone } = renderDialog();
    fireEvent.change(screen.getByTestId('ward-charge-import-file'), { target: { files: [xlsx()] } });
    fireEvent.click(screen.getByTestId('ward-charge-import-upload'));
    await screen.findByTestId('ward-charge-import-step2');

    expect(screen.getByTestId('ward-charge-import-replace')).toBeChecked();
    fireEvent.click(screen.getByTestId('ward-charge-import-replace'));
    fireEvent.click(screen.getByTestId('ward-charge-import-confirm'));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/teams/ward-charges/import/confirm', { previewToken: 'tok-2', replaceTeamsInFile: false }),
    );
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(I.done(1, 0, 2)));
  });

  it('a server refusal is translated from its code', async () => {
    vi.mocked(api.post).mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { error: { code: 'TEAM_WARD_IMPORT_FILE_INVALID', message: 'x', details: [{ reason: 'HEADER' }] } } },
    });
    renderDialog();
    fireEvent.change(screen.getByTestId('ward-charge-import-file'), { target: { files: [xlsx()] } });
    fireEvent.click(screen.getByTestId('ward-charge-import-upload'));
    expect(await screen.findByTestId('ward-charge-import-failed')).toHaveTextContent(t.wardCharges.errors.TEAM_WARD_IMPORT_FILE_INVALID);
  });
});
