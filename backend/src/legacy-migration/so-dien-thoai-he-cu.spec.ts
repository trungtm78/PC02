import { docSoDienThoaiHeCu } from './so-dien-thoai-he-cu';

/**
 * Các chuỗi dưới đây lấy nguyên văn từ máy chạy ngày 27/08/2026, kèm số hồ sơ mang chuỗi ấy.
 */
describe('docSoDienThoaiHeCu — phân biệt "không có" với "sai"', () => {
  it('số đúng dạng thì giữ nguyên', () => {
    expect(docSoDienThoaiHeCu('0912345678')).toEqual({ loai: 'giu-nguyen' });
  });

  it.each([
    ['0912 345 678'],
    ['0912.345.678'],
    ['0912-345-678'],
  ])('bỏ dấu phân cách ra đúng dạng thì chuẩn hoá: %s', (v) => {
    expect(docSoDienThoaiHeCu(v)).toEqual({ loai: 'chuan-hoa', giaTri: '0912345678' });
  });

  it.each([
    ['...', 3110],
    ['0000', 388],
    ['000', 251],
    ['..', 246],
    ['00', 229],
    ['.', 188],
    ['....', 166],
    ['0', 41],
    ['Không', 28],
    ['SDT', 0],
    ['00000000', 5],
    [',', 4],
    ['000000000', 4],
    ['', 0],
    ['   ', 0],
  ])('ký hiệu "không có" của hệ cũ: %s (%i hồ sơ)', (v) => {
    expect(docSoDienThoaiHeCu(v)).toEqual({ loai: 'khong-co' });
  });

  /**
   * Đủ chữ số để có thể là số thật thì KHÔNG xoá. Thà để cán bộ tự sửa còn hơn xoá mất một số
   * thật — 103 hồ sơ rơi vào nhóm này.
   */
  it.each([
    ['+84912345678'],
    ['0912345678 - 0987654321'],
    ['84912345678'],
  ])('đủ chữ số nhưng không khớp dạng thì không đoán: %s', (v) => {
    expect(docSoDienThoaiHeCu(v).loai).toBe('khong-doan-duoc');
  });

  /**
   * Bóc dấu phân cách thì không mất gì; bóc cả chữ thì mất. "0912345678 (nhà riêng)" cũng ra
   * đúng mười chữ số, nhưng vứt luôn chữ "nhà riêng" là lặng lẽ mất một mẩu cán bộ đã gõ.
   */
  it('có chữ kèm theo thì không tự bóc, dù chữ số ra đúng dạng', () => {
    expect(docSoDienThoaiHeCu('0912345678 (nhà riêng)').loai).toBe('khong-doan-duoc');
  });
});
