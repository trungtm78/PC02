import { describe, it, expect } from 'vitest';
import { demGiaTri, docTheTuThamSo, SO_GIA_TRI_TOI_DA } from '../the';

/**
 * Máy chủ nhận tối đa SO_GIA_TRI_TOI_DA mục `tk` (DTO `ArrayMaxSize`), vượt là 400 cho CẢ danh sách
 * lẫn thống kê. Ô thẻ chặn khi thêm, nhưng đường dẫn dán tay / tham số cũ cộng thêm thì không qua ô —
 * phải chặn ngay lúc đọc địa chỉ trang, không để một đường dẫn chia sẻ làm hỏng cả màn.
 */
describe('docTheTuThamSo — không vượt giới hạn máy chủ', () => {
  it('25 mục trên URL → chỉ đọc SO_GIA_TRI_TOI_DA giá trị đầu', () => {
    const sp = new URLSearchParams(
      Array.from({ length: 25 }, (_, i) => ['p_tk', `nguoiGui~v${i}`]),
    );
    const the = docTheTuThamSo(sp, 'p');
    expect(demGiaTri(the)).toBe(SO_GIA_TRI_TOI_DA);
    expect(the[0].giaTri[0]).toBe('v0');
    expect(the[0].giaTri[SO_GIA_TRI_TOI_DA - 1]).toBe(`v${SO_GIA_TRI_TOI_DA - 1}`);
  });

  it('đủ giới hạn bằng `tk` rồi thêm tham số cũ → tham số cũ không đẩy vượt', () => {
    const sp = new URLSearchParams(
      Array.from({ length: SO_GIA_TRI_TOI_DA }, (_, i) => ['p_tk', `nguoiGui~v${i}`]),
    );
    sp.append('p_q', 'abc');
    expect(demGiaTri(docTheTuThamSo(sp, 'p', { q: '*' }))).toBe(SO_GIA_TRI_TOI_DA);
  });
});
