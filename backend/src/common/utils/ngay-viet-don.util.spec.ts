import {
  khoaSapXepNgayVietDon,
  ngayVietDonHienThi,
} from './ngay-viet-don.util';

/**
 * Một nơi duy nhất quyết định "Ngày viết đơn" hiện thế nào.
 *
 * Hồ sơ giữ hai cột (`petitionDate` ngày thật + `ngayVietDonEdtf`), nên mỗi nơi tự ghép là
 * mời chúng trôi khỏi nhau: nơi này in "__/12/2026", nơi kia in rỗng, nơi thứ ba bịa ngày 01.
 */
describe('ngayVietDonHienThi', () => {
  it.each([
    ['2026-12-15', '15/12/2026'],
    ['2026-12-XX', '__/12/2026'],
    ['2026-XX-XX', '__/__/2026'],
  ])('EDTF %s → %s', (edtf, mong) => {
    expect(ngayVietDonHienThi({ ngayVietDonEdtf: edtf })).toBe(mong);
  });

  it('hồ sơ CŨ chưa có cột EDTF thì vẫn in được từ cột ngày thật', () => {
    expect(
      ngayVietDonHienThi({ petitionDate: new Date('2026-12-15T00:00:00Z') }),
    ).toBe('15/12/2026');
  });

  it('EDTF thắng cột ngày thật khi có cả hai — EDTF là thứ cán bộ đã gõ', () => {
    expect(
      ngayVietDonHienThi({
        petitionDate: new Date('2026-12-01T00:00:00Z'),
        ngayVietDonEdtf: '2026-12-XX',
      }),
    ).toBe('__/12/2026');
  });

  it('không có gì → chuỗi rỗng, KHÔNG in "__/__/____" trống trơn lên chứng từ', () => {
    expect(ngayVietDonHienThi({})).toBe('');
    expect(
      ngayVietDonHienThi({ petitionDate: null, ngayVietDonEdtf: null }),
    ).toBe('');
  });

  it('chuỗi EDTF hỏng thì lùi về cột ngày thật, không nổ', () => {
    expect(
      ngayVietDonHienThi({
        ngayVietDonEdtf: 'rác',
        petitionDate: new Date('2026-01-02T00:00:00Z'),
      }),
    ).toBe('02/01/2026');
  });
});

describe('khoaSapXepNgayVietDon', () => {
  it('sắp đúng thứ tự thời gian bằng SO CHUỖI, kể cả đơn nhập thiếu', () => {
    const khoa = [
      { ngayVietDonEdtf: '2026-12-XX' },
      { ngayVietDonEdtf: '2025-01-05' },
      { ngayVietDonEdtf: '2026-03-XX' },
    ].map(khoaSapXepNgayVietDon);
    expect([...khoa].sort()).toEqual([
      '2025-01-05',
      '2026-03-XX',
      '2026-12-XX',
    ]);
  });

  it('lọc theo tháng bằng TIỀN TỐ bắt được cả đơn nhập đủ lẫn nhập thiếu', () => {
    const trongThang = [
      { ngayVietDonEdtf: '2026-12-15' },
      { ngayVietDonEdtf: '2026-12-XX' },
      { ngayVietDonEdtf: '2026-11-30' },
    ].filter((r) => khoaSapXepNgayVietDon(r)?.startsWith('2026-12'));
    expect(trongThang).toHaveLength(2);
  });

  it('hồ sơ cũ chưa có EDTF vẫn có khoá — không rơi vào rổ NULL', () => {
    expect(
      khoaSapXepNgayVietDon({ petitionDate: new Date('2026-12-15T00:00:00Z') }),
    ).toBe('2026-12-15');
  });

  it('không có gì → null', () => {
    expect(khoaSapXepNgayVietDon({})).toBeNull();
  });
});
