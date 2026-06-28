import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import * as api from '../../api';
import { api as libApi } from '@/lib/api';
import { DeleteResourceModalProvider } from '@/features/_shared/modals/DeleteResourceModalProvider';
import DocumentTemplatesPage from '../DocumentTemplatesPage';

vi.mock('../../api');
vi.mock('@/lib/api', () => ({ api: { delete: vi.fn() } }));
vi.mock('@/features/document-numbers/api', () => ({
  documentNumbersApi: { listTemplates: vi.fn().mockResolvedValue([]) },
}));
const mApi = vi.mocked(api);
const mDelete = vi.mocked(libApi.delete);

const DON_THU_TPL = {
  id: 'd1', code: 'BIEN_NHAN', name: 'Biên nhận', entityType: 'DON_THU',
  category: 'Biên bản', fileName: 'bien_nhan.docx', fileSha: 'x',
  variables: [], needsNumber: false, numberSeriesId: null, status: 'active', sortOrder: 0,
};

/** Page dùng useDeleteResourceModal → phải bọc provider. */
function renderPage(ui: ReactElement = <DocumentTemplatesPage />) {
  return render(<DeleteResourceModalProvider>{ui}</DeleteResourceModalProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mApi.listTemplates.mockResolvedValue([DON_THU_TPL as never]);
  mApi.downloadTemplateFile.mockResolvedValue(new Blob(['docx']) as never);
  mApi.getFieldCatalog.mockResolvedValue([] as never);
  mDelete.mockResolvedValue({} as never);
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

describe('DocumentTemplatesPage', () => {
  it('actions: Tải file + Sửa inline + kebab; mở kebab → Xoá', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-download-d1')).toBeInTheDocument());
    expect(screen.getByTestId('btn-edit-d1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-more-d1')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-delete-d1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-more-d1'));
    expect(screen.getByTestId('btn-delete-d1')).toBeInTheDocument();
  });

  it('Tải file → gọi downloadTemplateFile', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('btn-download-d1'));
    fireEvent.click(screen.getByTestId('btn-download-d1'));
    await waitFor(() => expect(mApi.downloadTemplateFile).toHaveBeenCalledWith('d1'));
  });

  it('Sửa → mở modal chế độ Sửa (pre-fill, mã read-only)', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('btn-edit-d1'));
    fireEvent.click(screen.getByTestId('btn-edit-d1'));
    expect(await screen.findByTestId('template-form-modal')).toBeInTheDocument();
    expect(screen.getByText('Sửa mẫu chứng từ')).toBeInTheDocument();
    expect(screen.getByTestId('template-code-input')).toBeDisabled();
    expect(screen.getByTestId('template-name-input')).toHaveValue('Biên nhận');
  });

  it('Xoá: bấm kebab → Xoá HIỆN MODAL XÁC NHẬN (chưa xóa); confirm mới DELETE + reload', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('btn-more-d1'));
    fireEvent.click(screen.getByTestId('btn-more-d1'));
    fireEvent.click(screen.getByTestId('btn-delete-d1'));
    // Modal xác nhận hiện, CHƯA gọi delete
    expect(screen.getByTestId('delete-confirm-modal')).toBeInTheDocument();
    expect(mDelete).not.toHaveBeenCalled();
    // Bấm xác nhận → DELETE đúng endpoint + reload
    fireEvent.click(screen.getByTestId('btn-confirm-delete'));
    await waitFor(() => expect(mDelete).toHaveBeenCalledWith('/document-templates/d1'));
    await waitFor(() => expect(mApi.listTemplates).toHaveBeenCalledTimes(2));
  });

  it('Xoá: bấm Hủy → đóng modal, KHÔNG delete', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('btn-more-d1'));
    fireEvent.click(screen.getByTestId('btn-more-d1'));
    fireEvent.click(screen.getByTestId('btn-delete-d1'));
    fireEvent.click(screen.getByTestId('btn-cancel-delete'));
    expect(screen.queryByTestId('delete-confirm-modal')).not.toBeInTheDocument();
    expect(mDelete).not.toHaveBeenCalled();
  });
});
