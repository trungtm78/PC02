import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NutXuatTheoBoLoc } from '../NutXuatTheoBoLoc';
import { AxiosError, AxiosHeaders } from 'axios';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
const taiVe = vi.fn();
vi.mock('@/features/document-templates/export.api', async (thuc) => ({
  ...(await thuc<typeof import('@/features/document-templates/export.api')>()),
  triggerDownload: (...a: unknown[]) => taiVe(...a),
}));
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>;

/**
 * Nút "Xuất N dòng Excel" trong khung Bộ lọc (anh yêu cầu 18/09/2026): xuất ĐÚNG bộ lọc + các cột đang
 * hiện; bộ lọc còn thay đổi chưa áp dụng thì áp dụng trước rồi mới xuất, để tệp khớp màn hình.
 */
describe('NutXuatTheoBoLoc', () => {
  beforeEach(() => {
    apiGet.mockReset();
    taiVe.mockReset();
  });

  const coBan = {
    duongDan: '/petitions/export/danh-sach',
    thamSo: { enteredById: 'u1', tk: ['nguoiGui~Thanh'] },
    cot: ['stt', 'senderName'],
    tong: 1284,
    hasUnappliedChanges: false,
    onApply: vi.fn(),
    tenDuPhong: 'danh-sach-don-thu.xlsx',
  };

  it('nhãn nói số dòng sẽ xuất', () => {
    render(<NutXuatTheoBoLoc {...coBan} />);
    expect(screen.getByTestId('btn-xuat-excel-theo-bo-loc').textContent).toMatch(/Xuất 1\.284 dòng Excel/);
  });

  it('bấm → gọi đúng điểm cuối với bộ lọc + cột đang hiện, rồi tải tệp', async () => {
    apiGet.mockResolvedValue({ data: new Blob(['x']), headers: {} });
    render(<NutXuatTheoBoLoc {...coBan} />);
    fireEvent.click(screen.getByTestId('btn-xuat-excel-theo-bo-loc'));
    await waitFor(() => expect(taiVe).toHaveBeenCalled());
    expect(apiGet).toHaveBeenCalledWith('/petitions/export/danh-sach', {
      params: { enteredById: 'u1', tk: ['nguoiGui~Thanh'], cot: 'stt,senderName' },
      responseType: 'blob',
    });
  });

  it('còn thay đổi chưa áp dụng → áp dụng TRƯỚC, xuất khi tham số mới về', async () => {
    apiGet.mockResolvedValue({ data: new Blob(['x']), headers: {} });
    const onApply = vi.fn();
    const { rerender } = render(<NutXuatTheoBoLoc {...coBan} hasUnappliedChanges onApply={onApply} />);
    fireEvent.click(screen.getByTestId('btn-xuat-excel-theo-bo-loc'));
    expect(onApply).toHaveBeenCalled();
    expect(apiGet).not.toHaveBeenCalled();
    rerender(<NutXuatTheoBoLoc {...coBan} thamSo={{ enteredById: 'u2' }} hasUnappliedChanges={false} onApply={onApply} />);
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        '/petitions/export/danh-sach',
        expect.objectContaining({ params: { enteredById: 'u2', cot: 'stt,senderName' } }),
      ),
    );
  });

  it('máy chủ từ chối (vượt trần) → hiện đúng câu máy chủ trả', async () => {
    const loi = new Blob([JSON.stringify({ message: 'Kết quả 60.000 dòng, vượt 50.000 dòng mỗi lần xuất — thu hẹp bộ lọc rồi xuất lại.' })], { type: 'application/json' });
    apiGet.mockRejectedValue(
      new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        data: loi,
        headers: {},
        config: { headers: new AxiosHeaders() },
      }),
    );
    render(<NutXuatTheoBoLoc {...coBan} />);
    fireEvent.click(screen.getByTestId('btn-xuat-excel-theo-bo-loc'));
    expect((await screen.findByTestId('loi-xuat-excel')).textContent).toMatch(/60\.000 dòng/);
  });

  it('không có dòng nào → nút khoá', () => {
    render(<NutXuatTheoBoLoc {...coBan} tong={0} />);
    expect((screen.getByTestId('btn-xuat-excel-theo-bo-loc') as HTMLButtonElement).disabled).toBe(true);
  });

  it('đang 0 dòng nhưng vừa nới bộ lọc (chưa áp dụng) → nút MỞ, bấm thì áp dụng rồi xuất', () => {
    const onApply = vi.fn();
    render(<NutXuatTheoBoLoc {...coBan} tong={0} hasUnappliedChanges onApply={onApply} />);
    const nut = screen.getByTestId('btn-xuat-excel-theo-bo-loc') as HTMLButtonElement;
    expect(nut.disabled).toBe(false);
    fireEvent.click(nut);
    expect(onApply).toHaveBeenCalled();
  });

  it('còn thay đổi chưa áp dụng → nhãn KHÔNG nói số dòng của bộ lọc cũ', () => {
    render(<NutXuatTheoBoLoc {...coBan} hasUnappliedChanges />);
    const nhan = screen.getByTestId('btn-xuat-excel-theo-bo-loc').textContent ?? '';
    expect(nhan).not.toMatch(/1\.284/);
    expect(nhan).toMatch(/Áp dụng & xuất Excel/);
  });
});
