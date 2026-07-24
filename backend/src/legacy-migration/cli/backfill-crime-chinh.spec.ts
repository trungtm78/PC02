import { chuanTenToi } from './backfill-crime-chinh';

describe('chuanTenToi — khớp tên tội danh', () => {
  it('bỏ dấu + thường hoá', () => {
    expect(chuanTenToi('Trộm cắp tài sản')).toBe('trom cap tai san');
  });
  it('bỏ tiền tố "Tội"', () => {
    expect(chuanTenToi('Tội giết người')).toBe('giet nguoi');
    expect(chuanTenToi('Giết người')).toBe('giet nguoi');
  });
  it('gộp khoảng trắng', () => {
    expect(chuanTenToi('Lừa  đảo   chiếm đoạt')).toBe('lua dao chiem doat');
  });
});
