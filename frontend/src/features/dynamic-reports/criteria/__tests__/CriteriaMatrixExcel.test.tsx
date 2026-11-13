import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CriteriaMatrixExcel from '../CriteriaMatrixExcel';
import { dynamicReportsApi } from '../../api';
import { reportCriteria } from '@/locales/reportCriteria.vi';
import type { CriteriaMatrixImportResult } from '../../types';

vi.mock('../../api', () => ({
  dynamicReportsApi: { downloadCriteriaMatrix: vi.fn(), uploadCriteriaMatrix: vi.fn() },
}));

const t = reportCriteria.matrix;
const refused = (status: number, code: string, details: unknown[] = [], message = '') => ({
  isAxiosError: true,
  response: { status, data: { success: false, error: { code, message, details } } },
});
const PREVIEW: CriteriaMatrixImportResult = {
  applied: false,
  configVersion: 7,
  teams: [
    { teamId: 'a', name: 'Tổ A', itemKeys: ['tin-moi'], added: [], removed: ['tin-cu'] },
    { teamId: 'b', name: 'Tổ B', itemKeys: null, added: [], removed: [] },
  ],
};
const FILE = new File(['x'], 'ma-tran.xlsx');

function renderIt(over: Partial<Parameters<typeof CriteriaMatrixExcel>[0]> = {}) {
  const onApplied = vi.fn();
  const onReload = vi.fn();
  render(
    <CriteriaMatrixExcel
      reportId="r1"
      reportCode="BC01"
      configVersion={6}
      criterionName={(k) => (k === 'tin-moi' ? '1.1 Tin mới' : k)}
      onApplied={onApplied}
      onReload={onReload}
      {...over}
    />,
  );
  return { onApplied, onReload };
}
const pick = (file: File = FILE) => fireEvent.change(screen.getByTestId('matrix-file-input'), { target: { files: [file] } });

describe('CriteriaMatrixExcel', () => {
  beforeEach(() => {
    vi.mocked(dynamicReportsApi.downloadCriteriaMatrix).mockReset().mockResolvedValue(undefined);
    vi.mocked(dynamicReportsApi.uploadCriteriaMatrix).mockReset();
  });

  it('downloads the matrix of this report under a name made from its code', async () => {
    renderIt();
    fireEvent.click(screen.getByTestId('btn-matrix-download'));
    await waitFor(() => expect(dynamicReportsApi.downloadCriteriaMatrix).toHaveBeenCalledWith('r1', 'ma-tran-tieu-chi-BC01.xlsx'));
  });

  it('a download that fails says so', async () => {
    vi.mocked(dynamicReportsApi.downloadCriteriaMatrix).mockRejectedValue(refused(500, 'INTERNAL', [], 'Máy chủ lỗi'));
    renderIt();
    fireEvent.click(screen.getByTestId('btn-matrix-download'));
    expect(await screen.findByTestId('matrix-error')).toHaveTextContent('Máy chủ lỗi');
  });

  it('a picked file is only read first: the preview says what each team gains and loses, nothing is applied', async () => {
    vi.mocked(dynamicReportsApi.uploadCriteriaMatrix).mockResolvedValue(PREVIEW);
    const { onApplied } = renderIt();
    pick();

    expect(await screen.findByTestId('matrix-preview')).toHaveTextContent('ma-tran.xlsx');
    expect(dynamicReportsApi.uploadCriteriaMatrix).toHaveBeenCalledTimes(1);
    expect(dynamicReportsApi.uploadCriteriaMatrix).toHaveBeenCalledWith('r1', FILE, { apply: false, expectedConfigVersion: 6 });
    expect(screen.getByTestId('matrix-preview-summary')).toHaveTextContent(t.summary(1, 2));
    expect(screen.getByTestId('matrix-preview-team-a')).toHaveTextContent(t.teamChange(0, 1));
    expect(screen.getByTestId('matrix-preview-team-a')).toHaveAttribute('data-changed', 'true');
    expect(screen.getByTestId('matrix-preview-team-b')).toHaveTextContent(t.teamUnchanged);
    expect(onApplied).not.toHaveBeenCalled();
  });

  it('"Áp dụng" sends the same file at the revision the preview was shown at, then asks the page to read the report again', async () => {
    vi.mocked(dynamicReportsApi.uploadCriteriaMatrix)
      .mockResolvedValueOnce(PREVIEW)
      .mockResolvedValueOnce({ ...PREVIEW, applied: true, configVersion: 8 });
    const { onApplied } = renderIt();
    pick();
    fireEvent.click(await screen.findByTestId('btn-matrix-apply'));

    expect(await screen.findByTestId('matrix-applied')).toHaveTextContent(t.applied(1));
    expect(dynamicReportsApi.uploadCriteriaMatrix).toHaveBeenLastCalledWith('r1', FILE, { apply: true, expectedConfigVersion: 7 });
    expect(onApplied).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('matrix-preview')).not.toBeInTheDocument();
  });

  it('a file that changes nothing cannot be applied, and says why', async () => {
    vi.mocked(dynamicReportsApi.uploadCriteriaMatrix).mockResolvedValue({
      ...PREVIEW,
      teams: [{ teamId: 'b', name: 'Tổ B', itemKeys: null, added: [], removed: [] }],
    });
    renderIt();
    pick();
    expect(await screen.findByTestId('matrix-preview-note')).toHaveTextContent(t.nothingToApply);
    expect(screen.getByTestId('btn-matrix-apply')).toBeDisabled();
  });

  it('"Huỷ" drops the preview without applying', async () => {
    vi.mocked(dynamicReportsApi.uploadCriteriaMatrix).mockResolvedValue(PREVIEW);
    renderIt();
    pick();
    fireEvent.click(await screen.findByTestId('btn-matrix-cancel'));
    expect(screen.queryByTestId('matrix-preview')).not.toBeInTheDocument();
    expect(dynamicReportsApi.uploadCriteriaMatrix).toHaveBeenCalledTimes(1);
  });

  it('a refused file lists each reason in plain words, naming the criterion by its name', async () => {
    vi.mocked(dynamicReportsApi.uploadCriteriaMatrix).mockRejectedValue(
      refused(400, 'CRITERIA_MATRIX_INVALID', [
        { code: 'MATRIX_CRITERION_MISSING', itemKey: 'tin-moi' },
        { code: 'MATRIX_TEAM_EMPTY', teamId: 'b', name: 'Tổ B' },
      ]),
    );
    renderIt();
    pick();
    const list = await screen.findByTestId('matrix-error-list');
    expect(list).toHaveTextContent(t.errors.MATRIX_CRITERION_MISSING('1.1 Tin mới'));
    expect(list).toHaveTextContent(t.errors.MATRIX_TEAM_EMPTY('Tổ B'));
    expect(screen.queryByTestId('matrix-preview')).not.toBeInTheDocument();
  });

  it('a refusal whose reasons this screen does not know is still told as "not a matrix file"', async () => {
    vi.mocked(dynamicReportsApi.uploadCriteriaMatrix).mockRejectedValue(refused(400, 'CRITERIA_MATRIX_INVALID', [{ code: 'NEW_REASON' }]));
    renderIt();
    pick();
    expect(await screen.findByTestId('matrix-error-list')).toHaveTextContent(t.errors.MATRIX_NOT_RECOGNISED);
  });

  it('no file reaching the server is said in its own words', async () => {
    vi.mocked(dynamicReportsApi.uploadCriteriaMatrix).mockRejectedValue(refused(400, 'MATRIX_FILE_MISSING'));
    renderIt();
    pick();
    expect(await screen.findByTestId('matrix-error')).toHaveTextContent(t.fileMissing);
  });

  it('somebody else changed the report between preview and apply: the preview is dropped and the report can be read again', async () => {
    vi.mocked(dynamicReportsApi.uploadCriteriaMatrix)
      .mockResolvedValueOnce(PREVIEW)
      .mockRejectedValueOnce(refused(409, 'REVISION_CONFLICT'));
    const { onApplied, onReload } = renderIt();
    pick();
    fireEvent.click(await screen.findByTestId('btn-matrix-apply'));

    expect(await screen.findByTestId('matrix-error')).toHaveTextContent(t.conflict);
    expect(screen.queryByTestId('matrix-preview')).not.toBeInTheDocument();
    expect(onApplied).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('btn-matrix-reload'));
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('matrix-error')).not.toBeInTheDocument();
  });

  it('is locked while another part of the screen is saving', () => {
    renderIt({ disabled: true });
    expect(screen.getByTestId('btn-matrix-download')).toBeDisabled();
    expect(screen.getByTestId('btn-matrix-upload')).toBeDisabled();
  });
});
