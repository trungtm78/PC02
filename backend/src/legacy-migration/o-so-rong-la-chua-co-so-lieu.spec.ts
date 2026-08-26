import { parityColumns } from './legacy-mapper';

/**
 * Ô SỐ ghi "0" ở hệ cũ là ô TRỐNG, không phải số không.
 *
 * Đo trên máy thật 26/08/2026: 30.089 đơn thư có `soTienBiThietHai = 0` và 30.956 đơn có
 * `soLuongBiHai = 0`, trong khi hệ cũ chỉ có 1.447 và 599 hồ sơ mang số thật khác 0. Nghĩa là
 * bộ chuyển dữ liệu đã đọc ô trống của hệ cũ thành con số.
 *
 * Trong hồ sơ pháp lý hai thứ ấy khác hẳn nhau: "thiệt hại 0 đồng" là một KHẲNG ĐỊNH, còn
 * "chưa có số liệu" là chưa biết. Báo cáo thống kê cộng nhầm hai nhóm ấy vào nhau.
 *
 * Cùng một lớp với hai mốc rỗng `"0"` và `"-25200"` mà `parseLegacyDate` đã xử cho ô ngày.
 * Anh chốt ngày 26/08/2026: coi là "chưa có số liệu".
 */
describe('Ô số rỗng của hệ cũ không được thành số không', () => {
  it('ô ghi "0" thì không sinh cột — coi như chưa có số liệu', () => {
    const out = parityColumns(
      { so_tien_bi_thiet_hai: '0', so_luong_bi_hai: '0' },
      'petition',
    );
    expect(out).not.toHaveProperty('soTienBiThietHai');
    expect(out).not.toHaveProperty('soLuongBiHai');
  });

  it('ô rỗng hoặc thiếu cũng không sinh cột', () => {
    expect(parityColumns({ so_tien_bi_thiet_hai: '' }, 'petition')).not.toHaveProperty(
      'soTienBiThietHai',
    );
    expect(parityColumns({}, 'petition')).not.toHaveProperty('soLuongBiHai');
  });

  it('số thật vẫn giữ nguyên, kể cả cách viết của hệ cũ', () => {
    expect(parityColumns({ so_luong_bi_hai: '2' }, 'petition')).toMatchObject({
      soLuongBiHai: 2,
    });
    expect(parityColumns({ so_tien_bi_thiet_hai: '800' }, 'petition')).toMatchObject({
      soTienBiThietHai: 800,
    });
    expect(parityColumns({ so_tien_bi_thiet_hai: '2 tỷ' }, 'petition')).toMatchObject({
      soTienBiThietHai: 2_000_000_000,
    });
  });

  /**
   * "0 đồng" hay "0 người" viết kèm đơn vị là cán bộ CHỦ Ý ghi số không — khác hẳn ô để
   * trống mà hệ cũ tự điền "0". Không được gộp hai thứ.
   */
  it('số không viết kèm đơn vị là số thật, giữ lại', () => {
    expect(parityColumns({ so_luong_bi_hai: '0 người' }, 'petition')).toMatchObject({
      soLuongBiHai: 0,
    });
  });
});
