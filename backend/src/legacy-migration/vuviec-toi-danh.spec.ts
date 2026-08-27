import { decomposeLegacyRecord } from './legacy-mapper';
import { PARITY, PARITY_HOAN_THEO_THUC_THE } from './field-parity.def';

/**
 * Vụ việc phải nhận được tội danh chính từ hệ cũ.
 *
 * Đơn thư và Vụ án đều có cột `crimeChinhId` từ lâu, riêng Vụ việc thì chưa — nên 1.114 hồ sơ
 * mang mã tội danh cũ không có chỗ ở, và tra cứu theo tội danh sót hẳn một giai đoạn tố tụng.
 * Đo trên máy chạy 27/08/2026.
 *
 * Bộ nạp phân giải mã cũ thành khoá ngoại (`resolveCrime`), nên builder chỉ cần phát ra khoá
 * trung gian `crimeChinhLegacyValue`. Trước 27/08 nhánh Vụ việc không phát khoá ấy.
 */
describe('Vụ việc nhận tội danh chính từ hệ cũ', () => {
  const vuViec = (r: Record<string, unknown>) =>
    (decomposeLegacyRecord({ ...r, phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau' } as never)
      .incident ?? {}) as Record<string, unknown>;

  it('phát khoá trung gian cho bộ nạp phân giải', () => {
    const v = vuViec({ id: '1', _id: '1', toi_danh_chinh_blhs2015: '173' });
    expect(v.crimeChinhLegacyValue).toBe(173);
  });

  it('hệ cũ không ghi tội danh thì không bịa khoá', () => {
    const v = vuViec({ id: '2', _id: '2' });
    expect(v.crimeChinhLegacyValue).toBeUndefined();
  });

  it('bảng khai field-parity phủ hai ô chữ vừa dựng cột', () => {
    const cot = PARITY.incident.map((c) => c.col);
    expect(cot).toContain('phanLoaiNguonTinBanDau');
    expect(cot).toContain('baoCaoBanGiamDocText');
  });

  /**
   * Hai khoá này từng nằm ở bảng hoãn. Dựng cột xong mà quên gỡ khai hoãn thì cổng "không sót
   * dữ liệu" vẫn miễn cho chúng, và một lần bù thiếu sau này sẽ không ai phát hiện.
   */
  it.each(['incident/phan_loai_nguon_tin_ban_dau', 'incident/toi_danh_chinh_blhs2015'])(
    'khoá "%s" đã gỡ khỏi bảng hoãn',
    (khoa) => {
      expect(PARITY_HOAN_THEO_THUC_THE.has(khoa)).toBe(false);
    },
  );
});
