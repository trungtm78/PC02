import { describe, expect, it } from 'vitest';

import { hoTen, tachHoTen } from '@/lib/hoTen';

/**
 * VÒNG KHỨ HỒI của họ tên: hiển thị → tách để lưu → hiển thị lại phải RA ĐÚNG chuỗi cũ.
 *
 * Bản trước tách ngược (`firstName` nhận tất cả trừ chữ cuối) trong khi mọi nơi hiển thị ghép
 * `lastName + firstName`. Hậu quả: mở một tài khoản ĐANG ĐÚNG rồi bấm Lưu là hỏng luôn, và
 * form vẫn nhìn đúng vì nó hiển thị bằng `hoTen` — chỉ lộ ra khi cầm bản in chứng từ, nơi máy
 * chủ ghép bằng `personName` cũng theo họ-trước.
 *
 * Ca thật anh gửi 09/09/2026: tài khoản `huypv` lưu `firstName="Phạm Văn"`, `lastName="Huy"`,
 * chứng từ in ra "Huy Phạm Văn" thay vì "Phạm Văn Huy".
 */

describe('tách họ tên khi lưu người dùng', () => {
  it.each([
    'Phạm Văn Huy',
    'Nguyễn An',
    'Trần Hoàng Duy Khánh',
    'Huy',
  ])('“%s” — hiển thị lại đúng chuỗi đã nhập', (hoVaTen) => {
    expect(hoTen(tachHoTen(hoVaTen))).toBe(hoVaTen);
  });

  it('HỌ và ĐỆM vào `lastName`, TÊN GỌI vào `firstName`', () => {
    expect(tachHoTen('Phạm Văn Huy')).toEqual({ lastName: 'Phạm Văn', firstName: 'Huy' });
  });

  it('mở tài khoản đang đúng rồi lưu lại KHÔNG làm hỏng', () => {
    const dangCo = { lastName: 'Phạm Văn', firstName: 'Huy' };

    expect(tachHoTen(hoTen(dangCo))).toEqual(dangCo);
  });

  it('chỉ một chữ thì không dựng họ rỗng thừa', () => {
    expect(tachHoTen('Huy')).toEqual({ lastName: '', firstName: 'Huy' });
  });
});
