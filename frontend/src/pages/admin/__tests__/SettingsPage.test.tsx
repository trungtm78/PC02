import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '../SettingsPage';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), put: vi.fn() },
}));

/**
 * Trang Cài đặt hệ thống — phần kỳ thống kê (anh yêu cầu 25/08/2026).
 *
 * Hai điều quan trọng ở đây, và cả hai đều thuộc loại HỎNG LẶNG LẼ:
 *  - khoá có danh sách giá trị phải là Ô CHỌN, không phải ô gõ chữ
 *  - nút "Về mặc định" phải trả đúng giá trị máy chủ dùng khi cài mới
 */
const CAI_DAT = [
  // Đúng thứ tự máy chủ trả về: sắp theo TÊN KHOÁ. Chính là thứ tự sai mà anh chỉ ra.
  {
    key: 'THONG_KE_DEN_NGAY',
    label: 'Kỳ thống kê — đến ngày',
    value: '',
    unit: null,
    legalBasis: null,
  },
  {
    key: 'THONG_KE_KY',
    label: 'Kỳ thống kê mặc định',
    value: 'QUY_HIEN_TAI',
    unit: null,
    legalBasis: null,
  },
  {
    key: 'THONG_KE_TU_NGAY',
    label: 'Kỳ thống kê — từ ngày',
    value: '',
    unit: null,
    legalBasis: null,
  },
  {
    key: 'CANH_BAO_SAP_HAN',
    label: 'Ngưỡng cảnh báo sắp đến hạn',
    value: '7',
    unit: 'ngày',
    legalBasis: null,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { data: CAI_DAT } });
  (api.put as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });
});

describe('SettingsPage — kỳ thống kê', () => {
  it('khoá có danh sách giá trị render Ô CHỌN, không phải ô gõ chữ', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-edit-THONG_KE_KY')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('btn-edit-THONG_KE_KY'));

    // Gõ chữ thì sai một ký tự là máy chủ coi giá trị lạ và lặng lẽ rơi về mặc định: lưu
    // vẫn báo thành công, cấu hình vẫn không có tác dụng, không ai thấy lỗi ở đâu.
    expect(screen.getByTestId('edit-select-THONG_KE_KY')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-input-THONG_KE_KY')).not.toBeInTheDocument();
  });

  it('khoá số vẫn là ô gõ chữ — không ép mọi khoá thành ô chọn', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-edit-CANH_BAO_SAP_HAN')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('btn-edit-CANH_BAO_SAP_HAN'));

    expect(screen.getByTestId('edit-input-CANH_BAO_SAP_HAN')).toBeInTheDocument();
  });

  it('ô chọn liệt kê đủ năm loại kỳ anh yêu cầu', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-edit-THONG_KE_KY')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-edit-THONG_KE_KY'));

    for (const nhan of ['Tháng hiện tại', 'Quý hiện tại', 'Năm hiện tại']) {
      expect(screen.getByRole('option', { name: nhan })).toBeInTheDocument();
    }
  });

  it('hiện NHÃN tiếng Việt chứ không phải mã máy — "Quý hiện tại", không phải QUY_HIEN_TAI', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-edit-THONG_KE_KY')).toBeInTheDocument());

    expect(screen.getByText('Quý hiện tại')).toBeInTheDocument();
  });

  it('nút "Về mặc định" gửi ĐÚNG giá trị mặc định', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-reset-THONG_KE_KY')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('btn-reset-THONG_KE_KY'));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/settings/THONG_KE_KY', {
        value: 'THANG_HIEN_TAI',
      }),
    );
  });

  it('đang ở đúng mặc định thì KHÔNG hiện nút "Về mặc định"', async () => {
    // Nút luôn hiện là nút vô nghĩa: bấm vào không có gì đổi, và người dùng mất niềm tin vào
    // các nút khác trên cùng hàng.
    // Bám theo KHOÁ, không theo chỉ số mảng: thêm một dòng vào đầu CAI_DAT là ca kiểm này
    // lặng lẽ đi kiểm nhầm khoá khác.
    const khoaKy = CAI_DAT.find((x) => x.key === 'THONG_KE_KY')!;
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: [{ ...khoaKy, value: 'THANG_HIEN_TAI' }] },
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-edit-THONG_KE_KY')).toBeInTheDocument());

    expect(screen.queryByTestId('btn-reset-THONG_KE_KY')).not.toBeInTheDocument();
  });

  it('khoá không có mặc định khai sẵn thì không có nút "Về mặc định"', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('btn-edit-CANH_BAO_SAP_HAN')).toBeInTheDocument());

    expect(screen.queryByTestId('btn-reset-CANH_BAO_SAP_HAN')).not.toBeInTheDocument();
  });
});

/**
 * Thứ tự và kiểu ô nhập — anh chỉ ra 25/08/2026.
 *
 * Máy chủ trả danh sách sắp theo tên khoá, nên "đến ngày" xuất hiện TRƯỚC "kỳ thống kê" còn
 * "từ ngày" rơi xuống cuối. Người đọc gặp mốc kết thúc trước cả khi biết đang cấu hình kỳ gì,
 * và quan hệ giữa ba khoá biến mất khỏi màn hình.
 */
describe('SettingsPage — thứ tự và ô chọn ngày', () => {
  it('hai mốc ngày nằm KỀ NHAU và NGAY DƯỚI khoá kỳ', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('setting-row-THONG_KE_KY')).toBeInTheDocument());

    const thuTu = screen
      .getAllByTestId(/^setting-row-/)
      .map((r) => r.getAttribute('data-testid')!.replace('setting-row-', ''));

    expect(thuTu.slice(0, 3)).toEqual(['THONG_KE_KY', 'THONG_KE_TU_NGAY', 'THONG_KE_DEN_NGAY']);
  });

  it('sửa mốc ngày thì ra Ô CHỌN NGÀY, không phải ô gõ chữ', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('btn-edit-THONG_KE_TU_NGAY')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByTestId('btn-edit-THONG_KE_TU_NGAY'));

    // Gõ tay dễ sai định dạng, mà máy chủ chỉ nhận YYYY-MM-DD — sai thì lặng lẽ rơi về mặc
    // định, lưu vẫn báo thành công.
    expect(screen.getByTestId('edit-date-THONG_KE_TU_NGAY')).toHaveAttribute('type', 'date');
    expect(screen.queryByTestId('edit-input-THONG_KE_TU_NGAY')).not.toBeInTheDocument();
  });

  it('kỳ KHÔNG phải "khoảng tuỳ chọn" → hai mốc ngày báo rõ là chưa có tác dụng', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('inactive-THONG_KE_TU_NGAY')).toBeInTheDocument(),
    );

    expect(screen.getByTestId('inactive-THONG_KE_DEN_NGAY')).toBeInTheDocument();
  });

  it('kỳ LÀ "khoảng tuỳ chọn" → không còn báo vô hiệu', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        data: CAI_DAT.map((x) =>
          x.key === 'THONG_KE_KY' ? { ...x, value: 'KHOANG_TUY_CHON' } : x,
        ),
      },
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('setting-row-THONG_KE_TU_NGAY')).toBeInTheDocument(),
    );

    expect(screen.queryByTestId('inactive-THONG_KE_TU_NGAY')).not.toBeInTheDocument();
  });
});
