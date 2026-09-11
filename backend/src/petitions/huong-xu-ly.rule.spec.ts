import { suyThuocThamQuyen, trangThaiTheoHuong, canDoiTrangThai, huongTheoTrangThai } from './huong-xu-ly.rule';

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

/**
 * Chiều NGƯỢC: suy hướng từ trạng thái — cho hồ sơ vào hệ mới bằng đường KHÔNG qua form (bộ
 * nạp hệ cũ). Trước khi có hàm này, luật chỉ nằm trong tệp migration SQL nên bộ nạp không đọc
 * được: đợt nạp 11/09/2026 đưa vào 434 đơn thư mang hướng TRỐNG.
 */
describe('huongTheoTrangThai — cùng luật với migration backfill 20260909150000', () => {
  it('đã chuyển đơn vị → Chuyển đơn', () => {
    expect(huongTheoTrangThai('DA_CHUYEN_DON_VI')).toBe('CHUYEN_DON');
  });

  it('đã trả đơn hoặc đã lưu đơn → Trả đơn/Lưu đơn', () => {
    expect(huongTheoTrangThai('DA_TRA_DON')).toBe('TRA_LUU_DON');
    expect(huongTheoTrangThai('DA_LUU_DON')).toBe('TRA_LUU_DON');
  });

  it('mọi trạng thái khác, kể cả thiếu → Giao đơn', () => {
    expect(huongTheoTrangThai('MOI_TIEP_NHAN')).toBe('GIAO_DON');
    expect(huongTheoTrangThai('DANG_XU_LY')).toBe('GIAO_DON');
    expect(huongTheoTrangThai(undefined)).toBe('GIAO_DON');
  });

  /** Khứ hồi: hướng → trạng thái → hướng phải ra đúng hướng ban đầu. */
  it('khứ hồi với trangThaiTheoHuong', () => {
    for (const h of ['GIAO_DON', 'CHUYEN_DON', 'TRA_LUU_DON'] as const) {
      expect(huongTheoTrangThai(trangThaiTheoHuong(h))).toBe(h);
    }
  });
});
