import { decomposeLegacyRecord } from './legacy-mapper';

/**
 * Ngày tiếp nhận của vụ việc TẠM ĐÌNH CHỈ (collection `TamDinhChi_vu_viec_21` hệ cũ).
 *
 * Đo prod 19/09/2026: CẢ 118 hồ sơ lưu NGƯỢC ngày và năm — `tiep_nhan_ngay` chứa năm (2020, 2024…), `tiep_nhan_nam`
 * chứa ngày (1…31). Bộ nạp ghép `Date.UTC(2000 + nam, thang - 1, ngay)` không kiểm → `Date.UTC(2030, 10, 2020)` TRÀN
 * thành 12/05/2036. 37 hồ sơ ra ngày tương lai (2027–2036, chiếm đầu danh sách khi sắp Ngày đề xuất giảm dần), 81 hồ
 * sơ ra ngày quá khứ trông hợp lý nhưng SAI (vd 13/01/2009 thay vì 03/07/2024) — lệch cả thống kê theo kỳ.
 *
 * Ca dùng đúng bản thô prod (đã bỏ trường thừa); ca cũ (17/2/21 đúng thứ tự) là dữ liệu tự dựng — vẫn phải đọc được.
 */
const tdc = (
  ngay: number,
  thang: number,
  nam: number,
  them: Record<string, unknown> = {},
) =>
  decomposeLegacyRecord({
    id: 11,
    __sourceCollection: 'TamDinhChi_vu_viec_21',
    noi_dung:
      'Hủy hoại tài sản ngày 18/11/20 tại nhà số 42/2 Liên Khu 8-9, Khu phố 8, phường Bình Hưng Hòa A',
    tiep_nhan_so: 1193,
    tiep_nhan_ngay: ngay,
    tiep_nhan_thang: thang,
    tiep_nhan_nam: nam,
    tam_dinh_chi_time: '2021-03-30',
    ...them,
  }).incident!;

const ngayVN = (d: unknown) =>
  d instanceof Date ? d.toISOString().slice(0, 10) : d;

describe('buildTamDinhChiIncident — ngày tiếp nhận', () => {
  it('hệ cũ đảo ngày/năm (ngay=2020, thang=11, nam=30) → 30/11/2020, không tràn thành 2036', () => {
    expect(ngayVN(tdc(2020, 11, 30).ngayDeXuat)).toBe('2020-11-30');
  });

  it('hồ sơ 108 thật (ngay=2024, thang=7, nam=3) → 03/07/2024, không phải 13/01/2009', () => {
    expect(ngayVN(tdc(2024, 7, 3).ngayDeXuat)).toBe('2024-07-03');
  });

  it('đúng thứ tự (17/2/21) vẫn đọc được như cũ', () => {
    expect(ngayVN(tdc(17, 2, 21).ngayDeXuat)).toBe('2021-02-17');
  });

  it('ngày không có thật (31/2) hoặc tháng lạ → để TRỐNG, không tràn sang tháng/năm khác', () => {
    expect(tdc(2021, 2, 31).ngayDeXuat).toBeUndefined();
    expect(tdc(2021, 13, 5).ngayDeXuat).toBeUndefined();
  });

  it('"Số tiếp nhận" trong mô tả ghi NĂM thật, không ghi ngày (1193/2020, không phải 1193/30)', () => {
    const moTa = String(tdc(2020, 11, 30).description);
    expect(moTa).toContain('Số tiếp nhận: 1193/2020');
    expect(moTa).not.toContain('1193/30');
  });
});
