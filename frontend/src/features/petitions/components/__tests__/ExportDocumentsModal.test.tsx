import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '@/lib/api';
import { DOC_TYPES } from '@/features/petitions/docTypes';
import { ExportDocumentsModal } from '../ExportDocumentsModal';

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }));
const mockPost = vi.mocked(api.post);

function okBlob() {
  return Promise.resolve({
    data: new Blob(['docx-bytes'], { type: 'application/octet-stream' }),
    headers: { 'content-disposition': 'attachment; filename="ChungTu.docx"' },
  });
}

beforeEach(() => {
  mockPost.mockReset();
  (global.URL.createObjectURL as unknown) = vi.fn(() => 'blob:x');
  (global.URL.revokeObjectURL as unknown) = vi.fn();
});

describe('ExportDocumentsModal', () => {
  it('mặc định: tick hết 7 mẫu + mode "merged"', () => {
    render(<ExportDocumentsModal petitionId="p1" onClose={vi.fn()} />);
    DOC_TYPES.forEach((d) =>
      expect(screen.getByTestId(`export-doc-checkbox-${d.value}`)).toBeChecked(),
    );
    expect(screen.getByTestId('export-mode-merged')).toBeChecked();
  });

  it('Bỏ chọn tất cả → [Xuất file] disabled', () => {
    render(<ExportDocumentsModal petitionId="p1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('btn-toggle-all')); // full → bỏ hết
    expect(screen.getByTestId('btn-export-confirm')).toBeDisabled();
  });

  it('[Xuất file] → POST đúng payload (7 mẫu, merged) + responseType blob → onClose', async () => {
    mockPost.mockReturnValue(okBlob() as never);
    const onClose = vi.fn();
    render(<ExportDocumentsModal petitionId="p1" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('btn-export-confirm'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith(
      '/petitions/p1/export-documents',
      { docTypes: DOC_TYPES.map((d) => d.value), mode: 'merged' },
      { responseType: 'blob' },
    );
  });

  it('chọn mode "zip" → payload mode zip', async () => {
    mockPost.mockReturnValue(okBlob() as never);
    render(<ExportDocumentsModal petitionId="p1" onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('export-mode-zip'));
    fireEvent.click(screen.getByTestId('btn-export-confirm'));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost.mock.calls[0][1]).toMatchObject({ mode: 'zip' });
  });

  it('lỗi → hiện message, KHÔNG onClose (popup vẫn mở)', async () => {
    mockPost.mockRejectedValue({
      response: {
        status: 400,
        data: { success: false, error: { code: 'BAD_REQUEST', message: 'Thiếu trường X' } },
      },
    });
    const onClose = vi.fn();
    render(<ExportDocumentsModal petitionId="p1" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('btn-export-confirm'));
    await waitFor(() => expect(screen.getByTestId('export-error')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('[Đóng] → onClose', () => {
    const onClose = vi.fn();
    render(<ExportDocumentsModal petitionId="p1" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('btn-export-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
