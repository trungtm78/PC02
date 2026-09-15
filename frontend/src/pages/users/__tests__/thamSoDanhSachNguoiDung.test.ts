import { describe, it, expect } from 'vitest';
import { thamSoDanhSachNguoiDung } from '../thamSoDanhSachNguoiDung';

/**
 * Tham số gửi `GET /admin/users` từ các ô lọc của màn.
 *
 * [lỗi có sẵn] Màn từng gửi `isActive=true|false` khi lọc trạng thái, trong khi `QueryUsersDto`
 * chỉ khai `status` (`active` | `inactive`). ValidationPipe toàn cục bật `forbidNonWhitelisted`
 * nên máy chủ trả 400 cho CẢ danh sách: chọn "Hoạt động" là bảng trống kèm lỗi.
 */
describe('thamSoDanhSachNguoiDung', () => {
  it('không lọc gì → không gửi tham số nào', () => {
    expect(thamSoDanhSachNguoiDung({ tuKhoa: '', vaiTro: 'all', trangThai: 'all' })).toEqual({});
  });

  it('lọc trạng thái → gửi `status` đúng mã DTO, KHÔNG gửi `isActive`', () => {
    expect(thamSoDanhSachNguoiDung({ tuKhoa: '', vaiTro: 'all', trangThai: 'active' })).toEqual({
      status: 'active',
    });
    expect(thamSoDanhSachNguoiDung({ tuKhoa: '', vaiTro: 'all', trangThai: 'inactive' })).toEqual({
      status: 'inactive',
    });
  });

  it('từ khoá và vai trò đi đúng tên tham số', () => {
    expect(thamSoDanhSachNguoiDung({ tuKhoa: 'an', vaiTro: 'r1', trangThai: 'all' })).toEqual({
      search: 'an',
      roleId: 'r1',
    });
  });

  /**
   * M6: cờ `TIM_KIEM_THE` bật → gửi thẻ (`tk`) thay cho ô chữ; máy chủ bỏ dấu và chọn cột. Không gửi
   * cả hai: `search` cũ cũng quy về thẻ "*" ở máy chủ, gửi kèm là lọc hai lần.
   */
  it('cờ bật → gửi `tk`, không gửi `search`; lọc vai trò/trạng thái giữ nguyên', () => {
    expect(
      thamSoDanhSachNguoiDung({
        tuKhoa: 'chu cu',
        vaiTro: 'r1',
        trangThai: 'active',
        theBat: true,
        tk: ['hoTen~an', '*~cb01'],
      }),
    ).toEqual({ tk: ['hoTen~an', '*~cb01'], roleId: 'r1', status: 'active' });
  });

  it('cờ bật mà không có thẻ → không gửi `tk` rỗng', () => {
    expect(
      thamSoDanhSachNguoiDung({
        tuKhoa: '',
        vaiTro: 'all',
        trangThai: 'all',
        theBat: true,
        tk: [],
      }),
    ).toEqual({});
  });
});
