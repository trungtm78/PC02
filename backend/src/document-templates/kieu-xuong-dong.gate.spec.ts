import { laMauHeCu } from './document-template.constants';

/**
 * CHỖ QUYẾT ĐỊNH kiểu xuống dòng nằm ở `dynamic-export.service.ts`, không phải ở bộ dựng.
 *
 * Bộ tách đoạn có ca kiểm riêng và xanh, nhưng bộ dựng chỉ tách khi được BẢO tách. Nếu chỗ
 * quyết định bỏ sót thì mọi tầng dưới vẫn xanh còn bản in vẫn ra ngắt dòng mềm — đúng khuôn
 * "khe hở giữa bộ nạp và bộ đọc" đã cắn ở sự cố bộ đếm số.
 */
describe('laMauHeCu — chọn kiểu xuống dòng theo MÃ mẫu', () => {
  it('bộ mẫu chép từ hệ cũ → nhận diện được', () => {
    for (const ma of [
      'HE_CU_DON_THU',
      'HE_CU_VU_AN',
      'HE_CU_UY_THAC',
      'HE_CU_BIEN_NHAN',
      'HE_CU_TRA_HO_SO',
    ]) {
      expect(laMauHeCu(ma)).toBe(true);
    }
  });

  it('mẫu tố tụng của hệ mới → KHÔNG áp quy ước của hệ khác', () => {
    for (const ma of ['PHIEU_DE_XUAT', 'QD_PHAN_CONG', 'THONG_BAO_TIEP_NHAN']) {
      expect(laMauHeCu(ma)).toBe(false);
    }
  });

  /** Mã có chữ `HE_CU` ở GIỮA không phải mẫu hệ cũ — tiền tố, không phải chứa. */
  it('chỉ tính TIỀN TỐ, không phải chứa chuỗi', () => {
    expect(laMauHeCu('MAU_HE_CU_GI_DO')).toBe(false);
  });
});
