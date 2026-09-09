import { suyThuocThamQuyen, trangThaiTheoHuong, canDoiTrangThai } from './huong-xu-ly.rule';

describe('suyThuocThamQuyen — cột cũ suy từ hướng, để mọi chỗ đang đọc nó không vỡ', () => {
  it('Giao đơn và Trả/Lưu đơn là xử lý nội bộ → true', () => {
    expect(suyThuocThamQuyen('GIAO_DON')).toBe(true);
    expect(suyThuocThamQuyen('TRA_LUU_DON')).toBe(true);
  });

  it('Chuyển đơn ra ngoài → false', () => {
    expect(suyThuocThamQuyen('CHUYEN_DON')).toBe(false);
  });

  /** Không chọn hướng thì KHÔNG được suy bừa — trả undefined để service khỏi ghi đè cột. */
  it('chưa chọn hướng → undefined, không ghi đè cột đang có', () => {
    expect(suyThuocThamQuyen(undefined)).toBeUndefined();
  });
});

describe('trangThaiTheoHuong', () => {
  it('ba hướng ra ba trạng thái', () => {
    expect(trangThaiTheoHuong('GIAO_DON')).toBe('DANG_XU_LY');
    expect(trangThaiTheoHuong('CHUYEN_DON')).toBe('DA_CHUYEN_DON_VI');
    // Trả đơn và Lưu đơn là MỘT về nghiệp vụ; DA_LUU_DON không dùng cho hướng này.
    expect(trangThaiTheoHuong('TRA_LUU_DON')).toBe('DA_TRA_DON');
  });
});

describe('canDoiTrangThai — chỉ đổi khi hướng THỰC SỰ thay đổi', () => {
  /**
   * Đây là ca quan trọng nhất của mô-đun. Nếu áp trạng thái mọi lần lưu thì cán bộ sửa một ô
   * không liên quan rồi bấm Lưu sẽ đẩy hồ sơ nhảy ngược về trạng thái của hướng — xoá mất thay
   * đổi trạng thái người khác vừa làm bằng đường khác, và không báo gì.
   */
  it('lưu lại mà không đổi hướng → KHÔNG đụng trạng thái', () => {
    expect(canDoiTrangThai('GIAO_DON', 'GIAO_DON')).toBe(false);
  });

  it('đổi hướng → đổi trạng thái', () => {
    expect(canDoiTrangThai('GIAO_DON', 'CHUYEN_DON')).toBe(true);
  });

  it('hồ sơ chưa có hướng, nay chọn → đổi', () => {
    expect(canDoiTrangThai(null, 'GIAO_DON')).toBe(true);
  });

  it('lần lưu này không gửi hướng → KHÔNG đụng trạng thái', () => {
    expect(canDoiTrangThai('GIAO_DON', undefined)).toBe(false);
  });
});
