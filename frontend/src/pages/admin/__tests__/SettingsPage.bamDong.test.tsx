/**
 * Trang Cài đặt — nhóm "Hành vi danh sách" (bấm vào dòng), 08/10/2026.
 * Hỏng lặng lẽ cần chốt: ô gõ chữ thay vì ô chọn (gõ sai = cấu hình không có tác dụng), nhóm không liền nhau,
 * lưu xong màn danh sách vẫn dùng giá trị cũ cả 5 phút.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsPage } from '../SettingsPage';
import { api } from '@/lib/api';
import { KHOA_BAM_DONG, BAM_DONG_OPTIONS } from '@/constants/giaoDienSettings';
import { datLaiCauHinhGiaoDienChoCaKiem } from '@/hooks/useCauHinhGiaoDien';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn() } }));
const get = api.get as ReturnType<typeof vi.fn>;
const put = api.put as ReturnType<typeof vi.fn>;

// Máy chủ trả sắp theo TÊN KHOÁ: BAM_DONG_* đứng trước THONG_KE_* và lẫn với khoá khác.
const CAI_DAT = [
  { key: 'BAM_DONG_DON_THU', label: 'Bấm vào dòng — danh sách Đơn thư', value: 'KHONG', unit: null, legalBasis: null },
  { key: 'BAM_DONG_DON_THU_PHUONG', label: 'Bấm vào dòng — Đơn thư phường/xã', value: 'KHONG', unit: null, legalBasis: null },
  { key: 'BAM_DONG_DON_TRUNG', label: 'Bấm vào dòng — Đơn trùng', value: 'KHONG', unit: null, legalBasis: null },
  { key: 'BAM_DONG_TONG_HOP', label: 'Bấm vào dòng — danh sách Tổng hợp', value: 'XEM', unit: null, legalBasis: null },
  { key: 'BAM_DONG_UY_THAC', label: 'Bấm vào dòng — Uỷ thác điều tra', value: 'XEM', unit: null, legalBasis: null },
  { key: 'BAM_DONG_VU_AN', label: 'Bấm vào dòng — danh sách Vụ án', value: 'XEM', unit: null, legalBasis: null },
  { key: 'BAM_DONG_VU_VIEC', label: 'Bấm vào dòng — danh sách Vụ việc', value: 'XEM', unit: null, legalBasis: null },
  { key: 'CANH_BAO_SAP_HAN', label: 'Ngưỡng cảnh báo', value: '7', unit: 'ngày', legalBasis: null },
  { key: 'THONG_KE_KY', label: 'Kỳ thống kê mặc định', value: 'THANG_HIEN_TAI', unit: null, legalBasis: null },
];

function dung() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  datLaiCauHinhGiaoDienChoCaKiem();
  get.mockImplementation((url: string) =>
    url === '/settings' ? Promise.resolve({ data: { data: CAI_DAT } }) : Promise.resolve({ data: { data: {} } }),
  );
  put.mockResolvedValue({ data: { success: true } });
});

describe('Cài đặt hệ thống — hành vi danh sách', () => {
  it('có đúng MỘT tiêu đề nhóm, đứng ngay trên 7 dòng bấm-vào-dòng liền nhau', async () => {
    dung();
    await screen.findByTestId('setting-row-BAM_DONG_VU_AN');
    expect(screen.getAllByTestId('nhom-hanh-vi-danh-sach')).toHaveLength(1);
    const hang = Array.from(document.querySelectorAll('tbody tr')).map(
      (tr) => tr.getAttribute('data-testid') ?? '',
    );
    const dau = hang.indexOf('nhom-hanh-vi-danh-sach');
    expect(hang.slice(dau + 1, dau + 8)).toEqual(KHOA_BAM_DONG.map((k) => `setting-row-${k}`));
  });

  it('giá trị hiện bằng NHÃN tiếng Việt, không phải mã KHONG/XEM', async () => {
    dung();
    const dong = await screen.findByTestId('setting-row-BAM_DONG_DON_THU');
    expect(within(dong).getByText(/Không làm gì/)).toBeInTheDocument();
    expect(within(dong).queryByText('KHONG')).not.toBeInTheDocument();
  });

  it('sửa = Ô CHỌN đủ 5 lựa chọn đúng thứ tự (không phải ô gõ chữ)', async () => {
    dung();
    fireEvent.click(await screen.findByTestId('btn-edit-BAM_DONG_VU_AN'));
    const chon = screen.getByTestId('edit-select-BAM_DONG_VU_AN') as HTMLSelectElement;
    expect(Array.from(chon.options).map((o) => o.value)).toEqual(BAM_DONG_OPTIONS.map((o) => o.value));
    expect(screen.queryByTestId('edit-input-BAM_DONG_VU_AN')).not.toBeInTheDocument();
  });

  it('lưu → PUT đúng khoá/giá trị, rồi tải lại cấu hình giao diện cho màn đang mở', async () => {
    dung();
    fireEvent.click(await screen.findByTestId('btn-edit-BAM_DONG_DON_THU'));
    fireEvent.change(screen.getByTestId('edit-select-BAM_DONG_DON_THU'), { target: { value: 'SUA_HAI_CHAM' } });
    fireEvent.click(screen.getByTestId('btn-save-BAM_DONG_DON_THU'));
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/settings/BAM_DONG_DON_THU', { value: 'SUA_HAI_CHAM' }),
    );
    await waitFor(() => expect(get).toHaveBeenCalledWith('/settings/giao-dien'));
  });

  it('"Về mặc định" chỉ hiện khi khác mặc định, và trả đúng giá trị mặc định của màn', async () => {
    dung();
    await screen.findByTestId('setting-row-BAM_DONG_DON_THU');
    // Đơn thư đang KHONG = mặc định → không có nút; Vụ án đang XEM = mặc định → không có nút.
    expect(screen.queryByTestId('btn-reset-BAM_DONG_DON_THU')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-edit-BAM_DONG_DON_THU'));
    fireEvent.change(screen.getByTestId('edit-select-BAM_DONG_DON_THU'), { target: { value: 'SUA' } });
    fireEvent.click(screen.getByTestId('btn-save-BAM_DONG_DON_THU'));
    const nutVe = await screen.findByTestId('btn-reset-BAM_DONG_DON_THU');
    fireEvent.click(nutVe);
    await waitFor(() =>
      expect(put).toHaveBeenLastCalledWith('/settings/BAM_DONG_DON_THU', { value: 'KHONG' }),
    );
  });

  it('khoá không thuộc nhóm (CANH_BAO_SAP_HAN) KHÔNG làm tải lại cấu hình giao diện', async () => {
    dung();
    fireEvent.click(await screen.findByTestId('btn-edit-CANH_BAO_SAP_HAN'));
    fireEvent.change(screen.getByTestId('edit-input-CANH_BAO_SAP_HAN'), { target: { value: '9' } });
    fireEvent.click(screen.getByTestId('btn-save-CANH_BAO_SAP_HAN'));
    await waitFor(() => expect(put).toHaveBeenCalled());
    expect(get).not.toHaveBeenCalledWith('/settings/giao-dien');
  });
});
