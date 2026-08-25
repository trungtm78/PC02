import { describe, it, expect } from 'vitest';
import { hoTen, hoTenCoCapBac } from '../hoTen';

/**
 * Thứ tự họ tên tiếng Việt: HỌ trước, TÊN sau.
 *
 * Anh báo 25/08/2026: ô "Điều tra viên chính" ở form Khởi tố vụ án hiện "Thành Phường Tân",
 * "Đức Xã Châu", "Đông Phường An Hội". Mã cũ ghép `[firstName, lastName]` theo quy ước tiếng
 * Anh, trong khi cơ sở dữ liệu lưu `lastName` = họ và tên đệm, `firstName` = tên gọi.
 *
 * Dữ liệu dùng trong ca kiểm lấy NGUYÊN VĂN từ bản chạy thật, không bịa.
 */
describe('hoTen', () => {
  it('ghép HỌ trước TÊN sau — đúng ba tài khoản anh chụp được', () => {
    expect(hoTen({ lastName: 'Phường An Hội', firstName: 'Đông' })).toBe('Phường An Hội Đông');
    expect(hoTen({ lastName: 'Xã Châu', firstName: 'Đức' })).toBe('Xã Châu Đức');
    expect(hoTen({ lastName: 'Phường Vĩnh', firstName: 'Tân' })).toBe('Phường Vĩnh Tân');
  });

  it('tên người thường cũng đúng — "Hà Minh" + "Trung" ra "Hà Minh Trung"', () => {
    expect(hoTen({ lastName: 'Hà Minh', firstName: 'Trung' })).toBe('Hà Minh Trung');
  });

  it('KHÔNG ra thứ tự cũ — đây là chính lỗi anh báo', () => {
    // Ca kiểm này tồn tại để bản vá không bị ai lật ngược lại "cho giống chuẩn quốc tế".
    expect(hoTen({ lastName: 'Phường An Hội', firstName: 'Đông' })).not.toBe('Đông Phường An Hội');
  });

  it('thiếu một trường thì không để lại khoảng trắng thừa', () => {
    expect(hoTen({ lastName: 'Nguyễn Văn', firstName: null })).toBe('Nguyễn Văn');
    expect(hoTen({ lastName: null, firstName: 'An' })).toBe('An');
  });

  it('không có tên nào → rơi về username', () => {
    expect(hoTen({ firstName: null, lastName: null, username: 'phuonganhoidong' })).toBe(
      'phuonganhoidong',
    );
  });

  it('không có gì → chuỗi rỗng, không phải "undefined"', () => {
    // Nối chuỗi với undefined cho ra chữ "undefined" ngay trên màn hình cán bộ.
    expect(hoTen({})).toBe('');
    expect(hoTen(null)).toBe('');
  });

  it('nhận giá trị dự phòng do nơi gọi chỉ định', () => {
    expect(hoTen(null, '—')).toBe('—');
    expect(hoTen({ firstName: null, lastName: null }, '—')).toBe('—');
  });

  it('chuỗi rỗng cũng coi như thiếu, không ra khoảng trắng', () => {
    expect(hoTen({ lastName: '', firstName: 'An' })).toBe('An');
  });
});

describe('hoTenCoCapBac', () => {
  it('cấp bậc đứng TRƯỚC họ tên — dùng in trên chứng từ', () => {
    expect(hoTenCoCapBac({ rank: 'Thiếu tá', lastName: 'Phường An Hội', firstName: 'Tây' })).toBe(
      'Thiếu tá Phường An Hội Tây',
    );
  });

  it('không có cấp bậc thì chỉ ra họ tên, không thừa khoảng trắng', () => {
    expect(hoTenCoCapBac({ rank: null, lastName: 'Hà Minh', firstName: 'Trung' })).toBe(
      'Hà Minh Trung',
    );
  });
});
