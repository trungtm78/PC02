import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { NutXuatTheoBoLoc } from '@/features/_shared/list-filters/NutXuatTheoBoLoc';

const apiGet = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (d: string, o: unknown) => apiGet(d, o) } }));
vi.mock('@/features/document-templates/export.api', () => ({
  parseBlobError: vi.fn(async () => 'lỗi'),
  triggerDownload: vi.fn(),
}));

/**
 * Anh chốt 22/09/2026: THÊM nút "Xuất đầy đủ", giữ nguyên nút cũ. Hai nút, hai đường, hai bộ
 * cột — và hai `data-testid` khác nhau, vì cùng một id thì ca kiểm mù và cán bộ cũng không
 * phân biệt được hai nút cạnh nhau.
 */
describe('Nút "Xuất đầy đủ"', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: new Blob(['x']), headers: {} });
  });

  const dung = (p: Record<string, unknown> = {}) =>
    render(
      <NutXuatTheoBoLoc
        duongDan="/petitions/export/day-du"
        thamSo={{ status: 'PENDING' }}
        cot={[]}
        boQuaCot
        tong={1200}
        hasUnappliedChanges={false}
        onApply={vi.fn()}
        tenDuPhong="don-thu-day-du.xlsx"
        nhanRieng="Xuất đầy đủ"
        testId="btn-xuat-day-du"
        {...p}
      />,
    );

  it('có testid riêng, không trùng nút xuất thường', () => {
    dung();
    expect(screen.getByTestId('btn-xuat-day-du')).toBeInTheDocument();
    expect(screen.queryByTestId('btn-xuat-excel-theo-bo-loc')).not.toBeInTheDocument();
  });

  /**
   * Anh báo 23/09/2026: hai nút "rất khó hiểu". Chúng khác nhau ở SỐ CỘT, mà nhãn lại nói SỐ
   * DÒNG — thứ cả hai giống hệt nhau. Số dòng nay hiện MỘT lần phía trên cả hai nút.
   */
  it('nhãn nói PHẠM VI CỘT, không nói số dòng', () => {
    dung({ nhanRieng: 'Xuất Excel (mọi trường)' });
    const nut = screen.getByTestId('btn-xuat-day-du');
    expect(nut).toHaveTextContent('Xuất Excel (mọi trường)');
    expect(nut, 'số dòng nằm trong tên nút là nói sai thứ hai nút khác nhau').not.toHaveTextContent('1.200');
  });

  /** `toLowerCase()` cả chuỗi biến "Excel" thành "excel". Chỉ hạ chữ cái ĐẦU. */
  it('nhánh "chưa áp dụng" giữ nguyên chữ hoa "Excel"', () => {
    dung({ nhanRieng: 'Xuất Excel (mọi trường)', hasUnappliedChanges: true });
    expect(screen.getByTestId('btn-xuat-day-du')).toHaveTextContent(
      'Áp dụng & xuất Excel (mọi trường)',
    );
  });

  /**
   * `CotXuatDto.cot` khai `@MaxLength(1000)`. Gửi ~130 khoá cột lên đường xuất đầy đủ — thứ nó
   * không dùng tới — là một lượt 400 vô cớ ngay khi bộ cột dài ra.
   */
  it('KHÔNG gửi danh sách cột lên đường xuất đầy đủ', async () => {
    dung();
    fireEvent.click(screen.getByTestId('btn-xuat-day-du'));
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    const params = (apiGet.mock.calls[0][1] as { params: Record<string, unknown> }).params;
    expect('cot' in params).toBe(false);
    expect(params.status).toBe('PENDING');
  });

  it('gọi ĐÚNG đường xuất đầy đủ, không gọi đường xuất thường', async () => {
    dung();
    fireEvent.click(screen.getByTestId('btn-xuat-day-du'));
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(apiGet.mock.calls[0][0]).toBe('/petitions/export/day-du');
  });

  it('nút xuất THƯỜNG vẫn gửi danh sách cột như cũ', async () => {
    render(
      <NutXuatTheoBoLoc
        duongDan="/petitions/export/danh-sach"
        thamSo={{ status: 'PENDING' }}
        cot={['stt', 'senderName']}
        tong={5}
        hasUnappliedChanges={false}
        onApply={vi.fn()}
        tenDuPhong="danh-sach-don-thu.xlsx"
      />,
    );
    fireEvent.click(screen.getByTestId('btn-xuat-excel-theo-bo-loc'));
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    const params = (apiGet.mock.calls[0][1] as { params: Record<string, unknown> }).params;
    expect(params.cot).toBe('stt,senderName');
  });
});
