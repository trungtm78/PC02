import { chieuTotCua, CHIEU_TOT_CHI_TIEU } from './chi-tieu';

describe('Sổ đăng ký chiều tốt của chỉ tiêu', () => {
  it('đã giải quyết: càng nhiều càng tốt', () => expect(chieuTotCua('daGiaiQuyet')).toBe(true));
  it('quá hạn: càng nhiều càng xấu', () => expect(chieuTotCua('quaHan')).toBe(false));

  it('khối lượng việc đến là TRUNG TÍNH — không phán tốt/xấu', () => {
    for (const k of ['donThu', 'vuViec', 'vuAn']) expect(chieuTotCua(k)).toBeNull();
  });

  /**
   * Chỉ tiêu lạ phải rơi về trung tính. Đoán bừa một chiều cho chỉ tiêu chưa khai là cách
   * một màn hình mới tô xanh nhầm ngay hôm nó ra đời.
   */
  it('chỉ tiêu chưa khai thì trung tính, không đoán', () => {
    expect(chieuTotCua('mot_chi_tieu_chua_ton_tai')).toBeNull();
  });

  it('không chỉ tiêu nào khai chiều mà thiếu ý nghĩa rõ ràng', () => {
    const la = Object.entries(CHIEU_TOT_CHI_TIEU)
      .filter(([, v]) => v !== true && v !== false && v !== null)
      .map(([k]) => k);
    expect(la).toEqual([]);
  });
});
