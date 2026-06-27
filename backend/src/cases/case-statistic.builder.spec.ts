import { buildCaseStatisticData } from './case-statistic.builder';

describe('buildCaseStatisticData', () => {
  it('convert field ngày string → Date, giữ field số/bool/text', () => {
    const data = buildCaseStatisticData({
      soSungThuHoi: 3,
      coBangNhom: true,
      soDangKyHoSo: 'HS-01',
      ngayThongKe: '2026-06-01',
      ngayDauThu: '2026-05-20',
    });
    expect(data.soSungThuHoi).toBe(3);
    expect(data.coBangNhom).toBe(true);
    expect(data.soDangKyHoSo).toBe('HS-01');
    expect(data.ngayThongKe).toBeInstanceOf(Date);
    expect(data.ngayDauThu).toBeInstanceOf(Date);
  });

  it('field ngày bỏ trống → undefined (không Invalid Date)', () => {
    const data = buildCaseStatisticData({ soSungThuHoi: 1 });
    expect(data.ngayThongKe).toBeUndefined();
  });

  it('object rỗng → {}', () => {
    expect(buildCaseStatisticData({})).toEqual({});
  });
});
