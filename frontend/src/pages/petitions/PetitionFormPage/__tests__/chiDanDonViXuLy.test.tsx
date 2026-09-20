import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChiDanDonViXuLy, CHI_DAN_NOI_BO } from '../ChiDanDonViXuLy';
import { HuongXuLyDon } from '@/shared/enums/generated';

/*
  Ô "Đơn vị xử lý" đổi hẳn nguồn theo Hướng xử lý, nhưng NHÃN Ô GIỐNG HỆT NHAU:

  · Giao đơn / Trả đơn-Lưu đơn → 26 Tổ/Nhóm NỘI BỘ, KHÔNG tạo mới được.
  · Chuyển đơn                 → danh mục đơn vị (~1.433 mục), CÓ tạo mới.

  Từ chỗ cán bộ ngồi, hai ô ấy trông y hệt — nên "lúc tạo được lúc không" đọc ra như một lỗi.
  Anh chốt 20/09: KHÔNG cho tạo Tổ nội bộ từ form đơn thư (Tổ gắn với thành viên, quyền và
  phạm vi dữ liệu — tạo từ đây sẽ đẻ ra tổ rỗng không ai thuộc về), mà chỉ đường sang Chuyển đơn.
*/
describe('ChiDanDonViXuLy', () => {
  it('hướng NỘI BỘ: nói rõ danh sách là Tổ/Nhóm, và gõ tên mới thì vào DANH MỤC đơn vị', () => {
    render(<ChiDanDonViXuLy huong={HuongXuLyDon.GIAO_DON} />);
    const chu = screen.getByTestId('chi-dan-don-vi-xu-ly').textContent ?? '';
    expect(chu).toContain('Tổ/Nhóm');
    // Anh chốt 20/09 (lần hai): PHẢI tạo mới được ngay ở đây. Câu chữ phải nói đúng thứ xảy ra
    // — mục mới vào danh mục đơn vị, KHÔNG đẻ ra một Tổ thật.
    expect(chu).toContain('danh mục');
  });

  it('hướng Trả đơn/Lưu đơn cũng là nội bộ nên cũng có chỉ dẫn', () => {
    render(<ChiDanDonViXuLy huong={HuongXuLyDon.TRA_LUU_DON} />);
    expect(screen.getByTestId('chi-dan-don-vi-xu-ly').textContent).toContain('danh mục');
  });

  it('CHƯA chọn hướng cũng là nội bộ — giữ đúng hành vi mặc định của ô', () => {
    render(<ChiDanDonViXuLy huong="" />);
    expect(screen.getByTestId('chi-dan-don-vi-xu-ly')).toBeInTheDocument();
  });

  it('hướng Chuyển đơn: KHÔNG hiện chỉ dẫn — ô ấy tạo mới được rồi', () => {
    render(<ChiDanDonViXuLy huong={HuongXuLyDon.CHUYEN_DON} />);
    expect(screen.queryByTestId('chi-dan-don-vi-xu-ly')).toBeNull();
  });

  it('câu chỉ dẫn KHÔNG hứa tạo ra một Tổ — mục mới chỉ vào danh mục', () => {
    const c = CHI_DAN_NOI_BO.toLowerCase();
    expect(c).toContain('danh mục');
    expect(c, 'nói "tạo Tổ" là hứa sai — Tổ gắn với thành viên và quyền').not.toContain('tạo tổ');
  });
});
