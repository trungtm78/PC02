import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BatchExportDocumentsModal } from '../BatchExportDocumentsModal';
import { listExportTemplates } from '../../export.api';
import type { DocumentTemplate } from '../../types';

vi.mock('../../export.api', async () => {
  const actual = await vi.importActual<typeof import('../../export.api')>('../../export.api');
  return { ...actual, listExportTemplates: vi.fn() };
});

const mList = vi.mocked(listExportTemplates);

function tpl(over: Partial<DocumentTemplate>): DocumentTemplate {
  return {
    id: 't1', code: 'BIEN_NHAN', name: 'Giấy biên nhận', entityType: 'DON_THU',
    category: 'Biên nhận', fileName: 'bn.docx', fileSha: 'sha', variables: [],
    needsNumber: true, numberSeriesId: 'BIEN_NHAN', status: 'active', sortOrder: 0,
    selectedByDefault: false, ...over,
  };
}

const TWO = [tpl({}), tpl({ id: 't2', code: 'PHIEU_DE_XUAT', name: 'Phiếu đề xuất' })];

beforeEach(() => mList.mockReset());

describe('BatchExportDocumentsModal', () => {
  it('nạp mẫu theo entity, KHÔNG tick sẵn (khác modal 1 hồ sơ)', async () => {
    mList.mockResolvedValue(TWO);
    render(
      <BatchExportDocumentsModal entity="petitions" entityIds={['p1']} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    await waitFor(() => expect(mList).toHaveBeenCalledWith('petitions'));
    const cb = (await screen.findByTestId('batch-export-checkbox-t1')) as HTMLInputElement;
    expect(cb.checked).toBe(false);
    expect(screen.getByText('Phiếu đề xuất')).toBeInTheDocument();
  });

  it('chưa chọn mẫu nào → nút Xuất bị khoá', async () => {
    mList.mockResolvedValue(TWO);
    render(
      <BatchExportDocumentsModal entity="petitions" entityIds={['p1']} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(await screen.findByTestId('batch-export-confirm')).toBeDisabled();
  });

  it('chọn 2 mẫu × 3 hồ sơ → gọi onConfirm ĐÚNG 1 LẦN với mảng code', async () => {
    mList.mockResolvedValue(TWO);
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <BatchExportDocumentsModal
        entity="petitions" entityIds={['p1', 'p2', 'p3']} onClose={onClose} onConfirm={onConfirm}
      />,
    );
    fireEvent.click(await screen.findByTestId('batch-export-checkbox-t1'));
    fireEvent.click(screen.getByTestId('batch-export-checkbox-t2'));
    expect(screen.getByTestId('batch-export-summary')).toHaveTextContent('6 file');
    fireEvent.click(screen.getByTestId('batch-export-confirm'));
    await waitFor(() =>
      expect(onConfirm).toHaveBeenCalledWith(['p1', 'p2', 'p3'], ['BIEN_NHAN', 'PHIEU_DE_XUAT']),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  /**
   * Chặn theo SỐ LƯỢNG, không theo mode: `toggleOne` đặt lại mode='page' nhưng giữ nguyên
   * selectedIds, nên "chọn tất cả khớp lọc rồi bỏ tick 1 dòng" vẫn lọt qua lớp chắn kia.
   */
  it('vượt trần 100 file → chặn TRƯỚC khi gọi API, báo rõ lý do', async () => {
    mList.mockResolvedValue(TWO);
    const onConfirm = vi.fn();
    const ids = Array.from({ length: 60 }, (_, i) => `p${i}`);
    render(
      <BatchExportDocumentsModal entity="petitions" entityIds={ids} onClose={vi.fn()} onConfirm={onConfirm} />,
    );
    fireEvent.click(await screen.findByTestId('batch-export-checkbox-t1'));
    fireEvent.click(screen.getByTestId('batch-export-checkbox-t2'));
    const summary = screen.getByTestId('batch-export-summary');
    expect(summary).toHaveTextContent('120 file');
    expect(summary).toHaveTextContent('tối đa 100');
    expect(screen.getByTestId('batch-export-confirm')).toBeDisabled();
    fireEvent.click(screen.getByTestId('batch-export-confirm'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('60 hồ sơ × 1 mẫu = 60 file → vẫn cho xuất (trần tính theo TÍCH, không theo số hồ sơ)', async () => {
    mList.mockResolvedValue(TWO);
    const ids = Array.from({ length: 60 }, (_, i) => `p${i}`);
    render(
      <BatchExportDocumentsModal entity="petitions" entityIds={ids} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    fireEvent.click(await screen.findByTestId('batch-export-checkbox-t1'));
    expect(screen.getByTestId('batch-export-confirm')).toBeEnabled();
  });

  it('onConfirm lỗi → báo lỗi, KHÔNG đóng modal (để thử lại)', async () => {
    mList.mockResolvedValue(TWO);
    const onClose = vi.fn();
    render(
      <BatchExportDocumentsModal
        entity="petitions" entityIds={['p1']} onClose={onClose}
        onConfirm={vi.fn().mockRejectedValue(new Error('boom'))}
      />,
    );
    fireEvent.click(await screen.findByTestId('batch-export-checkbox-t1'));
    fireEvent.click(screen.getByTestId('batch-export-confirm'));
    expect(await screen.findByTestId('batch-export-error')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('[P2] hiện MESSAGE THẬT từ backend, không nuốt thành "kiểm tra kết nối"', async () => {
    mList.mockResolvedValue(TWO);
    render(
      <BatchExportDocumentsModal
        entity="petitions" entityIds={['p1']} onClose={vi.fn()}
        onConfirm={vi.fn().mockRejectedValue(new Error('Mẫu "BIEN_NHAN" chưa cấu hình series số văn bản'))}
      />,
    );
    fireEvent.click(await screen.findByTestId('batch-export-checkbox-t1'));
    fireEvent.click(screen.getByTestId('batch-export-confirm'));
    expect(await screen.findByTestId('batch-export-error')).toHaveTextContent('chưa cấu hình series');
  });

  /**
   * Bấm 2 lần trong CÙNG một tick: state `submitting` chưa flush nên cả hai handler đều
   * thấy false. Khoá phải là ref (đồng bộ), nếu không sẽ gửi 2 request → CẤP SỐ 2 LẦN
   * cho cùng bộ hồ sơ, mà số đã vào sổ thì không rút lại được.
   */
  it('[P1] bấm 2 lần liên tiếp chỉ gửi ĐÚNG 1 request (khoá đồng bộ)', async () => {
    mList.mockResolvedValue(TWO);
    let resolveIt: () => void = () => {};
    const onConfirm = vi.fn(() => new Promise<void>((r) => { resolveIt = r; }));
    render(
      <BatchExportDocumentsModal
        entity="petitions" entityIds={['p1']} onClose={vi.fn()} onConfirm={onConfirm}
      />,
    );
    fireEvent.click(await screen.findByTestId('batch-export-checkbox-t1'));
    const btn = screen.getByTestId('batch-export-confirm');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    resolveIt();
  });

  it('không có mẫu nào → thông báo trống', async () => {
    mList.mockResolvedValue([]);
    render(
      <BatchExportDocumentsModal entity="petitions" entityIds={['p1']} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(await screen.findByText(/Chưa có mẫu chứng từ/i)).toBeInTheDocument();
  });
});
