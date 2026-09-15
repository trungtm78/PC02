import { describe, it, expect } from 'vitest';
import { boDau, khopKhongDau } from '../bo-dau';

describe('bỏ dấu phía giao diện', () => {
  it.each([
    ['Nguyễn Văn Á', 'nguyen van a'],
    ['ĐỖ THỊ ĐÀO', 'do thi dao'],
    ['Trường Sa', 'truong sa'],
    ['Quỳnh', 'quynh'],
  ])('"%s" → "%s"', (vao, ra) => {
    expect(boDau(vao)).toBe(ra);
  });

  it('chữ tổ hợp (NFD) ra cùng kết quả với chữ dựng sẵn (NFC)', () => {
    expect(boDau('Nguyễn'.normalize('NFD'))).toBe(boDau('Nguyễn'.normalize('NFC')));
  });

  it('khớp không dấu, không hoa thường; truy vấn rỗng khớp tất cả', () => {
    expect(khopKhongDau('Đang xử lý', 'dang xu')).toBe(true);
    expect(khopKhongDau('Đang xử lý', 'ĐANG')).toBe(true);
    expect(khopKhongDau('Đang xử lý', 'luu')).toBe(false);
    expect(khopKhongDau('bất kỳ', '')).toBe(true);
  });
});
