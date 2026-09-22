import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { EntityDocumentsTab } from '../EntityDocumentsTab';

const apiGet = vi.fn();
const apiPost = vi.fn(
  (_duong: string, _than: FormData, _tuyChon?: unknown) =>
    Promise.resolve({ data: { success: true, data: { id: 'd9' } } }),
);
vi.mock('@/lib/api', () => ({
  api: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (d: string, t: FormData, o?: unknown) => apiPost(d, t, o),
  },
}));
vi.mock('@/hooks/useCatalog', () => ({
  useCatalog: () => ({
    options: [
      { code: 'VAN_BAN', label: 'Văn bản' },
      { code: 'HINH_ANH', label: 'Hình ảnh' },
      { code: 'KET_QUA_DON_VI_XU_LY', label: 'Kết quả từ đơn vị xử lý' },
    ],
  }),
}));

const LOAI = 'KET_QUA_DON_VI_XU_LY';

/**
 * Khu tệp chuyên đề phải NHẤT QUÁN ở cả ba chỗ, thiếu một là hỏng theo kiểu khó thấy.
 *
 * Chỗ hay sót nhất là giá trị khởi tạo của ô chọn loại: kho mã có TỚI BA lần đặt lại về
 * "VAN_BAN" (khởi tạo state, lúc mở biểu mẫu, và sau mỗi lần tải lên thành công). Sót bất kỳ
 * lần nào thì tệp rơi sai loại rồi BIẾN MẤT khỏi chính khu vừa tải nó lên — cán bộ tải xong,
 * nhìn lại thấy trống, và tải lại lần nữa.
 */
describe('EntityDocumentsTab — khu tệp theo loại', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: { data: [] } });
  });

  it('hỏi máy chủ KÈM lọc loại', async () => {
    render(<EntityDocumentsTab entityKind="petition" entityId="p1" chiLoai={[LOAI]} loaiMacDinh={LOAI} />);
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith(
        expect.stringContaining(`documentType=${LOAI}`),
      ),
    );
  });

  it('ô chọn loại CHỈ bày loại của khu này', async () => {
    render(<EntityDocumentsTab entityKind="petition" entityId="p1" chiLoai={[LOAI]} loaiMacDinh={LOAI} />);
    fireEvent.click(await screen.findByTestId('btn-mo-tai-len'));
    const o = (await screen.findByTestId('doc-type-select')) as HTMLSelectElement;
    expect(Array.from(o.options).map((x) => x.value)).toEqual([LOAI]);
  });

  it('MỞ biểu mẫu: loại chọn sẵn là loại của khu, không phải "Văn bản"', async () => {
    render(<EntityDocumentsTab entityKind="petition" entityId="p1" chiLoai={[LOAI]} loaiMacDinh={LOAI} />);
    fireEvent.click(await screen.findByTestId('btn-mo-tai-len'));
    expect(((await screen.findByTestId('doc-type-select')) as HTMLSelectElement).value).toBe(LOAI);
  });

  it('đóng rồi MỞ LẠI biểu mẫu: vẫn là loại của khu', async () => {
    render(<EntityDocumentsTab entityKind="petition" entityId="p1" chiLoai={[LOAI]} loaiMacDinh={LOAI} />);
    const nut = await screen.findByTestId('btn-mo-tai-len');
    fireEvent.click(nut);
    fireEvent.click(nut);
    fireEvent.click(nut);
    expect(((await screen.findByTestId('doc-type-select')) as HTMLSelectElement).value).toBe(LOAI);
  });

  /**
   * MỆNH ĐỀ THẬT SỰ QUAN TRỌNG — và là mệnh đề duy nhất bắt được lỗi này.
   *
   * Đọc `value` của ô `<select>` KHÔNG đủ: khi `docType` giữ một mã không có trong danh sách
   * option (vd "VAN_BAN" trong khu chỉ bày một loại), trình duyệt và jsdom đều TỰ nhảy về
   * option đầu tiên. Ô hiện đúng, mà `docType` trong bộ nhớ vẫn sai, và chính giá trị sai ấy
   * mới là thứ đi lên máy chủ. Gieo lỗi chứng minh: đặt `loaiBanDau = "VAN_BAN"` thì mọi mệnh
   * đề đọc `value` vẫn xanh.
   *
   * Nên phải đo thứ THẬT SỰ GỬI ĐI.
   */
  it('tải lên: `documentType` GỬI ĐI đúng loại của khu, không phải "Văn bản"', async () => {
    apiPost.mockClear();
    render(<EntityDocumentsTab entityKind="petition" entityId="p1" chiLoai={[LOAI]} loaiMacDinh={LOAI} />);
    fireEvent.click(await screen.findByTestId('btn-mo-tai-len'));

    const tieuDe = screen.getByPlaceholderText(/Biên bản khám nghiệm/);
    fireEvent.change(tieuDe, { target: { value: 'Công văn trả lời' } });

    const tep = new File(['x'], 'tra-loi.pdf', { type: 'application/pdf' });
    const oTep = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(oTep, 'files', { value: [tep], configurable: true });
    fireEvent.change(oTep);

    fireEvent.click(screen.getByTestId('btn-tai-len'));
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    const fd = apiPost.mock.calls[0][1];
    expect(fd.get('documentType')).toBe(LOAI);
  });

  /**
   * Tệp THỨ HAI mới là chỗ lỗi sống: sau mỗi lần tải lên thành công, biểu mẫu tự đặt lại. Đặt
   * lại về "VAN_BAN" thì tệp thứ hai rơi sai loại và BIẾN MẤT khỏi chính khu vừa tải nó lên —
   * cán bộ nhìn lại thấy thiếu, tải lại lần nữa, và lần nào cũng thiếu.
   *
   * Một lượt tải không bắt được: lượt đầu vẫn đúng loại.
   */
  it('tải lên TỆP THỨ HAI: `documentType` vẫn đúng loại của khu', async () => {
    apiPost.mockClear();
    render(<EntityDocumentsTab entityKind="petition" entityId="p1" chiLoai={[LOAI]} loaiMacDinh={LOAI} />);

    for (const ten of ['cong-van-1.pdf', 'cong-van-2.pdf']) {
      fireEvent.click(await screen.findByTestId('btn-mo-tai-len'));
      fireEvent.change(screen.getByPlaceholderText(/Biên bản khám nghiệm/), {
        target: { value: ten },
      });
      const oTep = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(oTep, 'files', {
        value: [new File(['x'], ten, { type: 'application/pdf' })],
        configurable: true,
      });
      fireEvent.change(oTep);
      fireEvent.click(screen.getByTestId('btn-tai-len'));
      await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(ten.endsWith('1.pdf') ? 1 : 2));
    }

    expect(apiPost.mock.calls[1][1].get('documentType')).toBe(LOAI);
  });

  it('KHÔNG truyền `chiLoai`: giữ nguyên hành vi cũ — mọi loại, mặc định Văn bản', async () => {
    render(<EntityDocumentsTab entityKind="petition" entityId="p1" />);
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(String(apiGet.mock.calls[0][0])).not.toContain('documentType=');
    fireEvent.click(await screen.findByTestId('btn-mo-tai-len'));
    const o = (await screen.findByTestId('doc-type-select')) as HTMLSelectElement;
    expect(o.value).toBe('VAN_BAN');
    expect(Array.from(o.options).length).toBe(3);
  });
});
