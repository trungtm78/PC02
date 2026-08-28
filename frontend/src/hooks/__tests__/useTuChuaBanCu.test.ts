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

import { renderHook, act, waitFor } from '@testing-library/react';
import { useTuChuaBanCu } from '../useTuChuaBanCu';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
const apiGet = api.get as unknown as ReturnType<typeof vi.fn>;

/**
 * CỔNG (Codex 28/08/2026): ca kiểm cũ chỉ gọi hàm thuần `canTuChua`, không hề chạm phần nguy
 * hiểm nhất — gỡ service worker, xoá kho nội dung, và tải lại trang. Đó là ca kiểm xanh giả.
 *
 * Dưới đây kiểm CẢ HOOK, và đặc biệt kiểm điều quan trọng nhất: nó KHÔNG được tự tải lại.
 */
describe('useTuChuaBanCu — hành vi thật của hook', () => {
  let soLanTaiLai = 0;
  const goRegs = vi.fn(async () => []);
  const xoaCache = vi.fn(async () => true);

  beforeEach(() => {
    sessionStorage.clear();
    soLanTaiLai = 0;
    apiGet.mockReset();
    goRegs.mockClear();
    xoaCache.mockClear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload: () => { soLanTaiLai += 1; } },
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistrations: goRegs },
    });
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: { keys: async () => ['a', 'b'], delete: xoaCache },
    });
  });

  it('cùng phiên bản thì KHÔNG báo gì', async () => {
    apiGet.mockResolvedValue({ data: { version: '0.75.0.0' } });
    const { result } = renderHook(() => useTuChuaBanCu('0.75.0.0'));
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/health'));
    expect(result.current.banCu).toBe(false);
  });

  it('lệch phiên bản thì bật cờ báo', async () => {
    apiGet.mockResolvedValue({ data: { version: '0.76.0.0' } });
    const { result } = renderHook(() => useTuChuaBanCu('0.75.0.0'));
    await waitFor(() => expect(result.current.banCu).toBe(true));
  });

  /**
   * ĐIỀU QUAN TRỌNG NHẤT. Hook gắn ở khung ứng dụng, bọc MỌI màn nhập liệu, và dự án không có
   * lớp chặn nào cho form dở dang. Tự tải lại giữa lúc cán bộ đang gõ hồ sơ là cuốn mất công
   * của họ — đổi một lỗi im lặng lấy một lỗi ồn ào hơn thì không phải là chữa.
   */
  it('KHÔNG tự tải lại trang, dù phát hiện bản cũ', async () => {
    apiGet.mockResolvedValue({ data: { version: '0.76.0.0' } });
    const { result } = renderHook(() => useTuChuaBanCu('0.75.0.0'));
    await waitFor(() => expect(result.current.banCu).toBe(true));
    await new Promise((r) => setTimeout(r, 30));
    expect(soLanTaiLai).toBe(0);
  });

  it('chỉ khi cán bộ BẤM mới gỡ service worker, xoá kho, rồi tải lại', async () => {
    apiGet.mockResolvedValue({ data: { version: '0.76.0.0' } });
    const { result } = renderHook(() => useTuChuaBanCu('0.75.0.0'));
    await waitFor(() => expect(result.current.banCu).toBe(true));
    act(() => result.current.capNhat());
    await waitFor(() => expect(soLanTaiLai).toBe(1));
    expect(goRegs).toHaveBeenCalled();
    // Chỉ gỡ service worker là chưa đủ: kho nội dung vẫn giữ gói cũ và bản mới sẽ dùng lại.
    expect(xoaCache).toHaveBeenCalledTimes(2);
  });

  /** Chốt phải ghi TRƯỚC khi tải lại, nếu không lần tải sau lại thấy lệch và báo tiếp mãi. */
  it('đánh dấu đã tự chữa trước khi tải lại', async () => {
    apiGet.mockResolvedValue({ data: { version: '0.76.0.0' } });
    const { result } = renderHook(() => useTuChuaBanCu('0.75.0.0'));
    await waitFor(() => expect(result.current.banCu).toBe(true));
    act(() => result.current.capNhat());
    await waitFor(() => expect(sessionStorage.getItem(KHOA_DA_TU_CHUA)).toBe('1'));
  });

  it('máy chủ lỗi thì im lặng, không báo nhầm', async () => {
    apiGet.mockRejectedValue(new Error('mat mang'));
    const { result } = renderHook(() => useTuChuaBanCu('0.75.0.0'));
    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.banCu).toBe(false);
    expect(soLanTaiLai).toBe(0);
  });

  /** Quay lại tab thì hỏi lại — cán bộ để tab mở cả ngày, chỉ hỏi lúc vào là bỏ lỡ mọi lần deploy. */
  it('quay lại tab thì hỏi lại máy chủ', async () => {
    apiGet.mockResolvedValue({ data: { version: '0.75.0.0' } });
    renderHook(() => useTuChuaBanCu('0.75.0.0'));
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
  });

  it('gỡ khỏi màn hình thì dừng hỏi, không rò rỉ bộ đếm', async () => {
    apiGet.mockResolvedValue({ data: { version: '0.75.0.0' } });
    const { unmount } = renderHook(() => useTuChuaBanCu('0.75.0.0'));
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    unmount();
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});
