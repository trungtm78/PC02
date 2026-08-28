import { describe, it, expect } from 'vitest';
import { dangBiKhoa } from '../UserManagementPage';

/**
 * Nhận biết tài khoản đang bị khoá.
 *
 * Thông báo đăng nhập CỐ Ý không nói "đang bị khoá" (chống dò tên đăng nhập), nên màn quản lý
 * người dùng là chỗ DUY NHẤT trạng thái ấy hiện ra. Nhận sai ở đây là nút mở khoá bấm mù.
 */
describe('dangBiKhoa', () => {
  it('không có mốc khoá thì không bị khoá', () => {
    expect(dangBiKhoa({})).toBe(false);
    expect(dangBiKhoa({ lockedUntil: null })).toBe(false);
  });

  it('mốc khoá ở TƯƠNG LAI thì đang bị khoá', () => {
    expect(dangBiKhoa({ lockedUntil: new Date(Date.now() + 60_000).toISOString() })).toBe(true);
  });

  /**
   * Mốc ở QUÁ KHỨ nghĩa là khoá đã hết hạn. Coi nó là "đang khoá" thì nút mở khoá hiện mãi cho
   * tài khoản vốn dùng bình thường — và người xem tưởng cả hệ thống đang hỏng.
   */
  it('mốc khoá đã QUA thì hết khoá', () => {
    expect(dangBiKhoa({ lockedUntil: new Date(Date.now() - 60_000).toISOString() })).toBe(false);
  });

  /** Chuỗi rác trong dữ liệu không được biến thành "đang khoá" vĩnh viễn. */
  it('mốc khoá không đọc được thì coi như không khoá', () => {
    expect(dangBiKhoa({ lockedUntil: 'không-phải-ngày' })).toBe(false);
  });
});
