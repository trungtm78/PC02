import { laSoKhongDoChuyenNham } from './don-so-khong.util';

/**
 * Dọn số 0 là thao tác ĐỔI DỮ LIỆU TRÊN 30 NGHÌN HỒ SƠ, nên phép chọn phải chặt.
 *
 * Sai theo hướng dọn quá tay thì mất số liệu cán bộ chủ ý ghi; sai theo hướng dọn thiếu thì
 * báo cáo thống kê vẫn cộng nhầm "chưa có số liệu" vào "thiệt hại 0 đồng".
 */
describe('Nhận ra số 0 do bộ chuyển sinh ra', () => {
  it('cột = 0 và bản gốc là "0" trần → dọn', () => {
    expect(laSoKhongDoChuyenNham(0, '0')).toBe(true);
  });

  it('cột = 0 và bản gốc rỗng hoặc thiếu → dọn', () => {
    expect(laSoKhongDoChuyenNham(0, '')).toBe(true);
    expect(laSoKhongDoChuyenNham(0, null)).toBe(true);
    expect(laSoKhongDoChuyenNham(0, undefined)).toBe(true);
  });

  /**
   * "0 người" / "0 đồng" là cán bộ CHỦ Ý ghi số không. Dọn mất là xoá một khẳng định nghiệp
   * vụ và thay bằng "chưa biết" — sai theo hướng nguy hiểm hơn.
   */
  it('cột = 0 nhưng bản gốc viết kèm đơn vị → GIỮ', () => {
    expect(laSoKhongDoChuyenNham(0, '0 người')).toBe(false);
    expect(laSoKhongDoChuyenNham(0, '0 đồng')).toBe(false);
  });

  it('cột khác 0 thì không đụng tới, dù bản gốc thế nào', () => {
    expect(laSoKhongDoChuyenNham(800, '800')).toBe(false);
    expect(laSoKhongDoChuyenNham(2, '')).toBe(false);
    expect(laSoKhongDoChuyenNham(-1, '0')).toBe(false);
  });

  it('cột đang trống thì không có gì để dọn', () => {
    expect(laSoKhongDoChuyenNham(null, '0')).toBe(false);
    expect(laSoKhongDoChuyenNham(undefined, '0')).toBe(false);
  });
});
