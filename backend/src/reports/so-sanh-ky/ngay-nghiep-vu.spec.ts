import { COT_NGAY_TIEP_NHAN, NAM_HOP_LE, ngayHopLe } from './ngay-nghiep-vu';

describe('Cột ngày nghiệp vụ', () => {
  /**
   * Ghim tên cột. Đổi cột là đổi ý nghĩa của MỌI báo cáo kỳ — phải là một quyết định có ý thức,
   * kèm số đo phủ mới, chứ không phải một lần đổi tên biến cho gọn.
   */
  it('mỗi thực thể khai đúng một cột, và là cột đã đo phủ', () => {
    expect(COT_NGAY_TIEP_NHAN).toEqual({
      petition: 'receivedDate',
      incident: 'ngayDeXuat',
      case: 'receiveDate',
    });
  });

  it('KHÔNG thực thể nào dùng createdAt — đó là ngày nhập máy, không phải ngày tiếp nhận', () => {
    expect(Object.values(COT_NGAY_TIEP_NHAN)).not.toContain('createdAt');
  });
});

describe('ngayHopLe', () => {
  it('ngày trong khoảng là hợp lệ', () => {
    expect(ngayHopLe(new Date(2026, 7, 30))).toBe(true);
    expect(ngayHopLe(new Date(NAM_HOP_LE.tu, 0, 1))).toBe(true);
    expect(ngayHopLe(new Date(NAM_HOP_LE.den, 11, 31))).toBe(true);
  });

  it('năm rác của hệ cũ bị loại — đo được 2 hồ sơ năm 225 và 226', () => {
    expect(ngayHopLe(new Date(225, 0, 1))).toBe(false);
    expect(ngayHopLe(new Date(3023, 0, 1))).toBe(false);
  });

  it('không có ngày thì không hợp lệ, và không đổ vỡ', () => {
    expect(ngayHopLe(null)).toBe(false);
    expect(ngayHopLe(undefined)).toBe(false);
  });
});
