import { dinhDangDoiTuongBiCan } from './doi-tuong-bi-can';

/** Cùng chuỗi với cột "Đối tượng bị can" trên màn (`formatDoiTuongBiCan` ở CaseListPageShell). */
describe('dinhDangDoiTuongBiCan', () => {
  it('không có bị can → ô trống', () => {
    expect(
      dinhDangDoiTuongBiCan({ subjects: [], _count: { subjects: 0 } }),
    ).toBe('');
    expect(dinhDangDoiTuongBiCan({ subjects: null, _count: null })).toBe('');
  });

  it('nối tên bằng dấu phẩy, bỏ tên rỗng', () => {
    expect(
      dinhDangDoiTuongBiCan({
        subjects: [
          { fullName: 'Nguyễn A' },
          { fullName: '' },
          { fullName: 'Trần B' },
        ],
        _count: { subjects: 2 },
      }),
    ).toBe('Nguyễn A, Trần B');
  });

  it('danh sách bị cắt → phần dư "+N" theo tổng máy chủ đếm', () => {
    expect(
      dinhDangDoiTuongBiCan({
        subjects: [{ fullName: 'Nguyễn A' }, { fullName: 'Trần B' }],
        _count: { subjects: 7 },
      }),
    ).toBe('Nguyễn A, Trần B +5');
  });

  it('thiếu tổng đếm → coi như không cắt; tổng nhỏ hơn số tên → không âm', () => {
    expect(
      dinhDangDoiTuongBiCan({ subjects: [{ fullName: 'Nguyễn A' }] }),
    ).toBe('Nguyễn A');
    expect(
      dinhDangDoiTuongBiCan({
        subjects: [{ fullName: 'Nguyễn A' }, { fullName: 'Trần B' }],
        _count: { subjects: 1 },
      }),
    ).toBe('Nguyễn A, Trần B');
  });
});
