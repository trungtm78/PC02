import { chonToiDanh, chuanTenToi, type BangTraToiDanh } from './chon-toi-danh';

const BANG: BangTraToiDanh = {
  theoSo: new Map([
    [173, 'crime-d173'],
    [95, 'crime-d95'],
  ]),
  theoTen: new Map([['trom cap tai san', 'crime-d173']]),
};

describe('chonToiDanh — nối tội danh hệ cũ sang bảng master', () => {
  it('nối qua SỐ khi hệ cũ ghi mã điều luật', () => {
    expect(chonToiDanh({ toi_danh_chinh_blhs2015: '173' }, null, BANG)).toEqual({
      crimeId: 'crime-d173',
      cach: 'so',
    });
  });

  it('nhận cả khoá cũ hơn `toi_danh_chinh`', () => {
    expect(chonToiDanh({ toi_danh_chinh: '95' }, null, BANG).crimeId).toBe('crime-d95');
  });

  /** Số ĐI TRƯỚC tên: mã điều luật là dữ kiện chắc, tên là chuỗi cán bộ gõ tay. */
  it('có cả số lẫn tên thì lấy theo số', () => {
    const kq = chonToiDanh({ toi_danh_chinh_blhs2015: '95' }, 'Tội trộm cắp tài sản', BANG);
    expect(kq).toEqual({ crimeId: 'crime-d95', cach: 'so' });
  });

  it('không có số thì lùi về khớp tên', () => {
    expect(chonToiDanh({}, 'Tội trộm cắp tài sản', BANG)).toEqual({
      crimeId: 'crime-d173',
      cach: 'ten',
    });
  });

  /** Số không có trong bảng master thì vẫn được lùi về tên, không bỏ cuộc sớm. */
  it('số lạ nhưng tên khớp thì vẫn nối được', () => {
    expect(chonToiDanh({ toi_danh_chinh_blhs2015: '9999' }, 'trộm cắp tài sản', BANG).cach).toBe(
      'ten',
    );
  });

  it.each([
    [null, null],
    [{}, null],
    [{ toi_danh_chinh_blhs2015: '' }, ''],
    [{ toi_danh_chinh_blhs2015: '0' }, null],
    [{ toi_danh_chinh_blhs2015: 'abc' }, null],
  ])('không đoán được thì nói không, không bịa (%s)', (raw, ten) => {
    expect(chonToiDanh(raw as Record<string, unknown> | null, ten, BANG)).toEqual({
      cach: 'khong',
    });
  });
});

describe('chuanTenToi — khớp tên bất kể dấu và tiền tố', () => {
  it.each([
    ['Tội trộm cắp tài sản', 'trom cap tai san'],
    ['TRỘM CẮP TÀI SẢN', 'trom cap tai san'],
    ['  Tội   trộm cắp   tài sản ', 'trom cap tai san'],
    ['Tội đánh bạc', 'danh bac'],
  ])('%s → %s', (vao, ra) => {
    expect(chuanTenToi(vao)).toBe(ra);
  });
});
