import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import * as api from '../../api';
import DocumentTemplatesPage from '../DocumentTemplatesPage';

vi.mock('../../api');
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { listTemplates: vi.fn().mockResolvedValue([]) },
}));
const mApi = vi.mocked(api);

const DON_THU_TPL = {
  id: 'd1', code: 'BIEN_NHAN', name: 'Biên nhận', entityType: 'DON_THU',
  category: 'Biên bản', fileName: 'bien_nhan.docx', fileSha: 'x',
  variables: [], needsNumber: false, numberSeriesId: null, status: 'active', sortOrder: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mApi.listTemplates.mockResolvedValue([DON_THU_TPL as never]);
  mApi.downloadTemplateFile.mockResolvedValue(new Blob(['docx']) as never);
  mApi.deleteTemplate.mockResolvedValue(undefined as never);
  mApi.getFieldCatalog.mockResolvedValue([] as never);
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

describe('DocumentTemplatesPage', () => {
  it('actions: Tải file + Sửa inline + kebab; mở kebab → Xoá', async () => {
    render(<DocumentTemplatesPage />);
    await waitFor(() => expect(screen.getByTestId('btn-download-d1')).toBeInTheDocument());
    expect(screen.getByTestId('btn-edit-d1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-more-d1')).toBeInTheDocument();
    // Xoá nằm trong kebab (ẩn cho tới khi mở)
    expect(screen.queryByTestId('btn-delete-d1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-more-d1'));
    expect(screen.getByTestId('btn-delete-d1')).toBeInTheDocument();
  });

  it('Tải file → gọi downloadTemplateFile', async () => {
    render(<DocumentTemplatesPage />);
    await waitFor(() => screen.getByTestId('btn-download-d1'));
    fireEvent.click(screen.getByTestId('btn-download-d1'));
    await waitFor(() => expect(mApi.downloadTemplateFile).toHaveBeenCalledWith('d1'));
  });

  it('Sửa → mở modal chế độ Sửa (pre-fill, mã read-only)', async () => {
    render(<DocumentTemplatesPage />);
    await waitFor(() => screen.getByTestId('btn-edit-d1'));
    fireEvent.click(screen.getByTestId('btn-edit-d1'));
    expect(await screen.findByTestId('template-form-modal')).toBeInTheDocument();
    expect(screen.getByText('Sửa mẫu chứng từ')).toBeInTheDocument();
    expect(screen.getByTestId('template-code-input')).toBeDisabled();
    expect(screen.getByTestId('template-name-input')).toHaveValue('Biên nhận');
  });

  it('Xoá qua kebab → gọi deleteTemplate + reload', async () => {
    render(<DocumentTemplatesPage />);
    await waitFor(() => screen.getByTestId('btn-more-d1'));
    fireEvent.click(screen.getByTestId('btn-more-d1'));
    fireEvent.click(screen.getByTestId('btn-delete-d1'));
    await waitFor(() => expect(mApi.deleteTemplate).toHaveBeenCalledWith('d1'));
    await waitFor(() => expect(mApi.listTemplates).toHaveBeenCalledTimes(2));
  });
});
