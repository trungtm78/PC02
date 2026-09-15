import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DanhSachThe, OTimKiemThe } from '../OTimKiemThe';
import type { TruongTimKiem } from '@/shared/tim-kiem/the';

const KHAI: TruongTimKiem[] = [
  { key: 'nguoiGui', nhan: 'Người gửi', kieu: 'chu' },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon' },
];
const GIA_TRI_CHON = { trangThai: [{ value: 'A', label: 'Mã A' }] };

/**
 * Thẻ ĐỎ phải nói ĐÚNG lý do. "Cột không còn tìm được" chỉ đúng khi khoá lạ; ở Tổng hợp thẻ Trạng
 * thái đỏ vì chế độ "Tất cả" không nhận — cột vẫn đó. Người dùng trình đọc màn hình cũng phải nghe
 * được trạng thái ấy, không chỉ nhìn màu.
 */
describe('DanhSachThe — thẻ không hợp lệ', () => {
  it('thẻ chọn mang mã không có trong danh sách → đỏ', () => {
    render(
      <DanhSachThe
        the={[{ khoa: 'trangThai', giaTri: ['ZZ'] }]}
        khai={KHAI}
        giaTriChon={GIA_TRI_CHON}
        onBoThe={vi.fn()}
      />,
    );
    expect(screen.getByTestId('the-tim-kiem')).toHaveAttribute('data-hop-le', 'false');
  });

  it('lý do do màn truyền vào; nhãn nút sửa kèm lý do cho trình đọc màn hình', () => {
    render(
      <OTimKiemThe
        the={[{ khoa: 'khongCo', giaTri: ['x'] }]}
        truong={[]}
        khai={KHAI}
        onThem={vi.fn(() => true)}
        onBoThe={vi.fn()}
        onBoGiaTri={vi.fn()}
        lyDoKhongHopLe="Chỉ áp dụng khi chọn đúng loại hồ sơ"
      />,
    );
    const the = screen.getByTestId('the-tim-kiem');
    expect(the).toHaveTextContent('Chỉ áp dụng khi chọn đúng loại hồ sơ');
    expect(the).not.toHaveTextContent('Cột không còn tìm được');
    expect(
      screen.getByRole('button', {
        name: 'Sửa thẻ khongCo (Chỉ áp dụng khi chọn đúng loại hồ sơ)',
      }),
    ).toBeInTheDocument();
  });

  it('thẻ hợp lệ: nhãn nút sửa giữ nguyên', () => {
    render(
      <DanhSachThe
        the={[{ khoa: 'nguoiGui', giaTri: ['An'] }]}
        khai={KHAI}
        onBoThe={vi.fn()}
        onSua={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Sửa thẻ Người gửi' })).toBeInTheDocument();
  });
});
