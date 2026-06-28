import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '@/lib/api';
import { DOC_TYPES } from '@/features/petitions/docTypes';
import { ExportDocumentsModal } from '../ExportDocumentsModal';

vi.mock('@/lib/api', () => ({ api: { post: vi.fn(), get: vi.fn(), put: vi.fn() } }));
const mockPost = vi.mocked(api.post);
const mockGet = vi.mocked(api.get);
const mockPut = vi.mocked(api.put);

// readiness: mặc định 7 mẫu ĐỦ; cho phép override missing per docType.
function readiness(missingByDocType: Record<string, { field: string; label: string; type: 'text' | 'textarea'; savable: boolean }[]> = {}) {
  return Promise.resolve({
    data: {
      data: {
        updatedAt: '2026-06-28T00:00:00Z',
        items: DOC_TYPES.map((d) => ({
          docType: d.value,
          ready: !(missingByDocType[d.value]?.length),
          missing: missingByDocType[d.value] ?? [],
        })),
      },
    },
  });
}
function okBlob() {
  return Promise.resolve({
    data: new Blob(['docx-bytes'], { type: 'application/octet-stream' }),
    headers: { 'content-disposition': 'attachment; filename="ChungTu.docx"' },
  });
}

beforeEach(() => {
  mockPost.mockReset(); mockGet.mockReset(); mockPut.mockReset();
  mockGet.mockReturnValue(readiness() as never);
  (globalThis.URL.createObjectURL as unknown) = vi.fn(() => 'blob:x');
  (globalThis.URL.revokeObjectURL as unknown) = vi.fn();
});

describe('ExportDocumentsModal', () => {
  it('mọi mẫu đủ → tick hết 7 + mode "merged"', async () => {
    render(<ExportDocumentsModal petitionId="p1" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId(`export-doc-checkbox-${DOC_TYPES[0].value}`)).toBeChecked());
    DOC_TYPES.forEach((d) => expect(screen.getByTestId(`export-doc-checkbox-${d.value}`)).toBeChecked());
    expect(screen.getByTestId('export-mode-merged')).toBeChecked();
  });

  it('bỏ chọn hết → [Xuất file] disabled', async () => {
    render(<ExportDocumentsModal petitionId="p1" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId(`export-doc-checkbox-${DOC_TYPES[0].value}`)).toBeChecked());
    DOC_TYPES.forEach((d) => fireEvent.click(screen.getByTestId(`export-doc-checkbox-${d.value}`)));
    expect(screen.getByTestId('btn-export-confirm')).toBeDisabled();
  });

  it('[Xuất file] → POST đúng payload (7 mẫu, merged) + responseType blob → onClose', async () => {
    mockPost.mockReturnValue(okBlob() as never);
    const onClose = vi.fn();
    render(<ExportDocumentsModal petitionId="p1" onClose={onClose} />);
    await waitFor(() => expect(screen.getByTestId(`export-doc-checkbox-${DOC_TYPES[0].value}`)).toBeChecked());
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
    await waitFor(() => expect(screen.getByTestId(`export-doc-checkbox-${DOC_TYPES[0].value}`)).toBeChecked());
    fireEvent.click(screen.getByTestId('export-mode-zip'));
    fireEvent.click(screen.getByTestId('btn-export-confirm'));
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost.mock.calls[0][1]).toMatchObject({ mode: 'zip' });
  });

  it('lỗi xuất → hiện message, KHÔNG onClose', async () => {
    mockPost.mockRejectedValue({ response: { status: 400, data: { success: false, error: { code: 'BAD_REQUEST', message: 'Thiếu trường X' } } } });
    const onClose = vi.fn();
    render(<ExportDocumentsModal petitionId="p1" onClose={onClose} />);
    await waitFor(() => expect(screen.getByTestId(`export-doc-checkbox-${DOC_TYPES[0].value}`)).toBeChecked());
    fireEvent.click(screen.getByTestId('btn-export-confirm'));
    await waitFor(() => expect(screen.getByTestId('export-error')).toBeInTheDocument());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('[Đóng] → onClose', async () => {
    const onClose = vi.fn();
    render(<ExportDocumentsModal petitionId="p1" onClose={onClose} />);
    fireEvent.click(screen.getByTestId('btn-export-close'));
    expect(onClose).toHaveBeenCalled();
  });

  // ── readiness: mẫu thiếu thông tin ─────────────────────────────────────────
  it('mẫu THIẾU → checkbox disabled + KHÔNG tick + hiện "Thiếu: …"', async () => {
    mockGet.mockReturnValue(readiness({ PHIEU_DE_XUAT: [
      { field: 'nhanThay', label: 'Nhận thấy', type: 'textarea', savable: true },
      { field: 'deXuat', label: 'Đề xuất', type: 'textarea', savable: true },
    ] }) as never);
    render(<ExportDocumentsModal petitionId="p1" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('export-doc-checkbox-BIEN_NHAN')).toBeChecked());
    const cb = screen.getByTestId('export-doc-checkbox-PHIEU_DE_XUAT');
    expect(cb).toBeDisabled();
    expect(cb).not.toBeChecked();
    expect(screen.getByTestId('export-doc-missing-PHIEU_DE_XUAT')).toHaveTextContent('Thiếu: Nhận thấy, Đề xuất');
  });

  it('nhập bổ sung → "Lưu bổ sung" PUT đúng field + callback + re-fetch → mẫu mở lại', async () => {
    mockGet.mockReturnValueOnce(readiness({ PHIEU_DE_XUAT: [
      { field: 'nhanThay', label: 'Nhận thấy', type: 'textarea', savable: true },
      { field: 'deXuat', label: 'Đề xuất', type: 'textarea', savable: true },
    ] }) as never);
    mockGet.mockReturnValue(readiness() as never); // lần re-fetch sau khi lưu → đủ hết
    mockPut.mockResolvedValue({ data: { data: { updatedAt: '2026-06-28T01:00:00Z' } } } as never);
    const onPatched = vi.fn();
    render(<ExportDocumentsModal petitionId="p1" onClose={vi.fn()} onPetitionPatched={onPatched} />);
    await waitFor(() => expect(screen.getByTestId('export-doc-fill-nhanThay')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('export-doc-fill-nhanThay'), { target: { value: 'Nhận thấy A' } });
    fireEvent.change(screen.getByTestId('export-doc-fill-deXuat'), { target: { value: 'Đề xuất B' } });
    fireEvent.click(screen.getByTestId('export-doc-save-fill'));
    await waitFor(() => expect(mockPut).toHaveBeenCalled());
    expect(mockPut).toHaveBeenCalledWith('/petitions/p1', expect.objectContaining({ nhanThay: 'Nhận thấy A', deXuat: 'Đề xuất B', expectedUpdatedAt: '2026-06-28T00:00:00Z' }));
    expect(onPatched).toHaveBeenCalledWith('2026-06-28T01:00:00Z', expect.objectContaining({ nhanThay: 'Nhận thấy A' }));
    // re-fetch → PHIEU_DE_XUAT giờ đủ → enable + tick
    await waitFor(() => expect(screen.getByTestId('export-doc-checkbox-PHIEU_DE_XUAT')).toBeEnabled());
    expect(screen.getByTestId('export-doc-checkbox-PHIEU_DE_XUAT')).toBeChecked();
  });
});
