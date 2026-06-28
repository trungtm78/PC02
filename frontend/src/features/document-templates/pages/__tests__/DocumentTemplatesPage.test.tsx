import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import * as api from '../../api';
import DocumentTemplatesPage from '../DocumentTemplatesPage';

vi.mock('../../api');
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
  mApi.replaceTemplateFile.mockResolvedValue({ id: 'd1' } as never);
  // jsdom: stub object URL
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

describe('DocumentTemplatesPage', () => {
  it('DON_THU: nút "Cấu hình bắt buộc" hiện (đã bỏ ẩn) + Tải/Thay file', async () => {
    render(<DocumentTemplatesPage />);
    await waitFor(() => expect(screen.getByTestId('btn-required-d1')).toBeInTheDocument());
    expect(screen.getByTestId('btn-download-d1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-replace-d1')).toBeInTheDocument();
  });

  it('Tải file → gọi downloadTemplateFile', async () => {
    render(<DocumentTemplatesPage />);
    await waitFor(() => screen.getByTestId('btn-download-d1'));
    fireEvent.click(screen.getByTestId('btn-download-d1'));
    await waitFor(() => expect(mApi.downloadTemplateFile).toHaveBeenCalledWith('d1'));
  });

  it('Thay file: chọn file → gọi replaceTemplateFile + reload', async () => {
    render(<DocumentTemplatesPage />);
    await waitFor(() => screen.getByTestId('btn-replace-d1'));
    fireEvent.click(screen.getByTestId('btn-replace-d1'));
    const input = screen.getByTestId('replace-file-input');
    const file = new File(['x'], 'new.docx');
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(mApi.replaceTemplateFile).toHaveBeenCalledWith('d1', file));
    expect(mApi.listTemplates).toHaveBeenCalledTimes(2); // initial + reload
  });
});
