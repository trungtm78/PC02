import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DynamicExportDocumentsModal } from '../DynamicExportDocumentsModal';
import { listExportTemplates, exportEntityDocuments, triggerDownload } from '../../export.api';
import { api } from '@/lib/api';
import type { DocumentTemplate } from '../../types';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }));
vi.mock('../../export.api', async () => {
  const actual = await vi.importActual<typeof import('../../export.api')>('../../export.api');
  return { ...actual, listExportTemplates: vi.fn(), exportEntityDocuments: vi.fn(), triggerDownload: vi.fn() };
});

const mGet = vi.mocked(api.get);
const mList = vi.mocked(listExportTemplates);
const mExport = vi.mocked(exportEntityDocuments);
const mDownload = vi.mocked(triggerDownload);

function tpl(over: Partial<DocumentTemplate>): DocumentTemplate {
  return { id: 't1', code: 'QD01', name: 'Quyết định khởi tố', entityType: 'VU_AN', category: 'Quyết định', fileName: 'qd.docx', fileSha: 'sha', variables: [], needsNumber: false, numberSeriesId: null, status: 'active', sortOrder: 0, ...over };
}
// readiness GET → mặc định mọi mẫu đủ; override missing per templateId.
function readiness(list: DocumentTemplate[], missingById: Record<string, Array<{ field: string; label: string; type: 'text' | 'textarea'; savable: boolean }>> = {}) {
  return { data: { data: { updatedAt: '2026-06-28T00:00:00Z', items: list.map((t) => ({ templateId: t.id, ready: !(missingById[t.id]?.length), missing: missingById[t.id] ?? [] })) } } };
}

beforeEach(() => { mGet.mockReset(); mList.mockReset(); mExport.mockReset(); mDownload.mockReset(); });

describe('DynamicExportDocumentsModal', () => {
  it('mọi mẫu đủ → load + tick sẵn tất cả', async () => {
    const list = [tpl({ id: 't1', name: 'QĐ khởi tố' }), tpl({ id: 't2', name: 'Biên bản A', category: 'Biên bản' })];
    mList.mockResolvedValue(list);
    mGet.mockResolvedValue(readiness(list) as never);
    render(<DynamicExportDocumentsModal entity="cases" entityId="c1" onClose={vi.fn()} />);
    await waitFor(() => expect(mList).toHaveBeenCalledWith('cases'));
    const cb1 = await screen.findByTestId('dyn-export-checkbox-t1') as HTMLInputElement;
    const cb2 = screen.getByTestId('dyn-export-checkbox-t2') as HTMLInputElement;
    await waitFor(() => expect(cb1.checked).toBe(true));
    expect(cb2.checked).toBe(true);
    expect(screen.getByText('QĐ khởi tố')).toBeInTheDocument();
  });

  it('mẫu thiếu biến required → disabled + "Thiếu" + hiện ô nhập (manualValues)', async () => {
    const list = [tpl({ id: 't1' })];
    mList.mockResolvedValue(list);
    mGet.mockResolvedValue(readiness(list, { t1: [{ field: 'soVanBan', label: 'Số văn bản', type: 'text', savable: false }] }) as never);
    render(<DynamicExportDocumentsModal entity="cases" entityId="c1" onClose={vi.fn()} />);
    const cb = await screen.findByTestId('dyn-export-checkbox-t1') as HTMLInputElement;
    expect(cb).toBeDisabled();
    expect(screen.getByTestId('dyn-export-missing-t1')).toHaveTextContent('Thiếu: Số văn bản');
    expect(screen.getByTestId('dyn-export-fill-soVanBan')).toBeInTheDocument();
    // dynamic non-savable → KHÔNG có nút "Lưu bổ sung"
    expect(screen.queryByTestId('dyn-export-save-fill')).toBeNull();
  });

  it('nhập biến thiếu → mẫu mở lại → tick → Xuất file gửi manualValues', async () => {
    const list = [tpl({ id: 't1' })];
    mList.mockResolvedValue(list);
    mGet.mockResolvedValue(readiness(list, { t1: [{ field: 'soVanBan', label: 'Số văn bản', type: 'text', savable: false }] }) as never);
    mExport.mockResolvedValue({ data: new Blob(), headers: {} } as never);
    const onClose = vi.fn();
    render(<DynamicExportDocumentsModal entity="cases" entityId="c1" onClose={onClose} />);
    const input = await screen.findByTestId('dyn-export-fill-soVanBan');
    fireEvent.change(input, { target: { value: '42/QD' } });
    // nhập xong → mẫu effective-ready → enabled → tích
    const cb = screen.getByTestId('dyn-export-checkbox-t1') as HTMLInputElement;
    await waitFor(() => expect(cb).toBeEnabled());
    fireEvent.click(cb);
    fireEvent.click(screen.getByTestId('dyn-export-confirm'));
    await waitFor(() => expect(mExport).toHaveBeenCalledWith('cases', 'c1', expect.objectContaining({ templateIds: ['t1'], mode: 'merged', manualValues: expect.objectContaining({ soVanBan: '42/QD' }) })));
    await waitFor(() => expect(mDownload).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  // Anh yêu cầu: mặc định TÁCH thành nhiều file Word rời (không phải .zip, không
  // phải gộp) — mỗi mẫu 1 request → 1 file .docx tải về.
  describe('chế độ xuất', () => {
    async function renderVoi2Mau(onClose = vi.fn()) {
      const list = [tpl({ id: 't1', name: 'QĐ khởi tố' }), tpl({ id: 't2', name: 'Biên bản A' })];
      mList.mockResolvedValue(list);
      mGet.mockResolvedValue(readiness(list) as never);
      render(<DynamicExportDocumentsModal entity="cases" entityId="c1" onClose={onClose} />);
      await screen.findByTestId('dyn-export-checkbox-t1');
      return onClose;
    }

    it('MẶC ĐỊNH chọn "Tách từng file Word rời"', async () => {
      await renderVoi2Mau();
      expect((screen.getByTestId('dyn-export-mode-separate') as HTMLInputElement).checked).toBe(true);
      expect((screen.getByTestId('dyn-export-mode-merged') as HTMLInputElement).checked).toBe(false);
      expect((screen.getByTestId('dyn-export-mode-zip') as HTMLInputElement).checked).toBe(false);
    });

    it('tách: 2 mẫu → gọi API 2 LẦN (mỗi lần 1 mẫu) và tải 2 file', async () => {
      mExport.mockResolvedValue({ data: new Blob(), headers: {} } as never);
      const onClose = await renderVoi2Mau();
      fireEvent.click(screen.getByTestId('dyn-export-confirm'));
      await waitFor(() => expect(mExport).toHaveBeenCalledTimes(2));
      expect(mExport.mock.calls[0][2]).toEqual(expect.objectContaining({ templateIds: ['t1'], mode: 'merged' }));
      expect(mExport.mock.calls[1][2]).toEqual(expect.objectContaining({ templateIds: ['t2'], mode: 'merged' }));
      await waitFor(() => expect(mDownload).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    });

    it('tách: 1 mẫu lỗi → vẫn tải mẫu còn lại + báo rõ mẫu hỏng, KHÔNG đóng modal', async () => {
      mExport
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ data: new Blob(), headers: {} } as never);
      const onClose = await renderVoi2Mau();
      fireEvent.click(screen.getByTestId('dyn-export-confirm'));
      await waitFor(() => expect(mDownload).toHaveBeenCalledTimes(1)); // mẫu t2 vẫn tải
      const err = await screen.findByTestId('dyn-export-error');
      expect(err.textContent).toContain('QĐ khởi tố');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('chọn "Gộp 1 file Word" → chỉ 1 request kèm cả 2 mẫu', async () => {
      mExport.mockResolvedValue({ data: new Blob(), headers: {} } as never);
      await renderVoi2Mau();
      fireEvent.click(screen.getByTestId('dyn-export-mode-merged'));
      fireEvent.click(screen.getByTestId('dyn-export-confirm'));
      await waitFor(() => expect(mExport).toHaveBeenCalledTimes(1));
      expect(mExport.mock.calls[0][2]).toEqual(expect.objectContaining({ templateIds: ['t1', 't2'], mode: 'merged' }));
    });

    it('chọn ".zip" → 1 request mode=zip', async () => {
      mExport.mockResolvedValue({ data: new Blob(), headers: {} } as never);
      await renderVoi2Mau();
      fireEvent.click(screen.getByTestId('dyn-export-mode-zip'));
      fireEvent.click(screen.getByTestId('dyn-export-confirm'));
      await waitFor(() => expect(mExport).toHaveBeenCalledTimes(1));
      expect(mExport.mock.calls[0][2]).toEqual(expect.objectContaining({ mode: 'zip' }));
    });
  });

  it('không có mẫu → thông báo trống', async () => {
    mList.mockResolvedValue([]);
    mGet.mockResolvedValue(readiness([]) as never);
    render(<DynamicExportDocumentsModal entity="incidents" entityId="i1" onClose={vi.fn()} />);
    expect(await screen.findByText(/Chưa có mẫu chứng từ/i)).toBeInTheDocument();
  });
});
