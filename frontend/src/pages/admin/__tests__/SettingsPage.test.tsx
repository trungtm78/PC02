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
  {
    key: 'THONG_KE_KY',
    label: 'Kỳ thống kê mặc định',
    value: 'QUY_HIEN_TAI',
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
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { data: [{ ...CAI_DAT[0], value: 'THANG_HIEN_TAI' }] },
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
