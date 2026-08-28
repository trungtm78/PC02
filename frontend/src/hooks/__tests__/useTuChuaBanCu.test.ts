import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canTuChua, KHOA_DA_TU_CHUA } from '../useTuChuaBanCu';

/**
 * App tự nhận ra mình đang chạy bản cũ.
 *
 * Ngày 28/08/2026 cán bộ dùng app của bản 23/08 suốt 5 ngày mà không ai biết: CDN giữ `sw.js`
 * cũ ở biên, service worker cũ tiếp tục phục vụ gói cũ từ kho nội bộ, và mọi tệp cũ vẫn còn
 * trên máy chủ nên app cũ chạy trơn tru. Deploy xanh, health ok, hỏng hoàn toàn im lặng.
 *
 * Giao diện chỉ mang bản số nướng sẵn lúc dựng nên không tự biết. Nay nó hỏi `/api/v1/health`
 * — nguồn không bao giờ bị cache — và so.
 *
 * RỦI RO LỚN NHẤT của tính năng này KHÔNG phải là nó không chạy, mà là nó tự tải lại trang
 * VÒNG VÔ TẬN giữa giờ làm việc, cuốn mất dữ liệu cán bộ đang nhập. Phần lớn ca kiểm dưới đây
 * canh đúng chuyện ấy.
 */
describe('Tự chữa khi đang chạy bản cũ', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('cùng phiên bản thì KHÔNG làm gì', () => {
    expect(canTuChua('0.75.0.0', '0.75.0.0')).toBe(false);
  });

  it('khác phiên bản thì cần tự chữa', () => {
    expect(canTuChua('0.74.0.0', '0.75.0.0')).toBe(true);
  });

  /**
   * Chốt chặn chống vòng lặp: đã tự chữa một lần trong phiên này thì THÔI.
   *
   * Không có chốt này thì mỗi lần tải lại là một lần so lệch tiếp (vì service worker vẫn ghim
   * bản cũ) → tải lại → so lệch → tải lại… trang nhấp nháy vô tận và cán bộ mất hết dữ liệu
   * đang nhập dở.
   */
  it('đã tự chữa một lần trong phiên thì KHÔNG làm nữa', () => {
    sessionStorage.setItem(KHOA_DA_TU_CHUA, '1');
    expect(canTuChua('0.74.0.0', '0.75.0.0')).toBe(false);
  });

  /** Máy chủ chưa trả phiên bản (bản cũ chưa có trường ấy) → không làm gì. */
  it('máy chủ không trả phiên bản thì KHÔNG làm gì', () => {
    expect(canTuChua('0.75.0.0', undefined)).toBe(false);
    expect(canTuChua('0.75.0.0', '')).toBe(false);
  });

  /** Bản số của giao diện thiếu (dựng lỗi) → không đoán, không tự chữa. */
  it('giao diện không có phiên bản thì KHÔNG làm gì', () => {
    expect(canTuChua('', '0.75.0.0')).toBe(false);
    expect(canTuChua(undefined, '0.75.0.0')).toBe(false);
  });

  /**
   * `0.0.0.0` là giá trị máy chủ trả khi KHÔNG đọc được tệp phiên bản. Coi nó là "khác" thì
   * mỗi máy chủ đọc lỗi sẽ bắt toàn bộ cán bộ tải lại trang một lần vô cớ.
   */
  it('máy chủ trả `0.0.0.0` (không đọc được) thì KHÔNG tự chữa', () => {
    expect(canTuChua('0.75.0.0', '0.0.0.0')).toBe(false);
  });

  it('khoảng trắng thừa không bị coi là khác phiên bản', () => {
    expect(canTuChua('0.75.0.0', ' 0.75.0.0 ')).toBe(false);
  });
});
