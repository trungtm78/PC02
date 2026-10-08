import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MAN_HINH_DIEN_THOAI, soKhoMediaQueryChoCaKiem, useDienThoai, useMediaQuery } from '../useMediaQuery';

/** MediaQueryList giả đếm số lần đăng ký/gỡ bộ lắng nghe gốc. */
function dungMatchMedia(matchesBanDau: boolean) {
  const nguoiNghe = new Set<(e: { matches: boolean }) => void>();
  const mql = {
    matches: matchesBanDau,
    addEventListener: vi.fn((_: string, f: (e: { matches: boolean }) => void) => nguoiNghe.add(f)),
    removeEventListener: vi.fn((_: string, f: (e: { matches: boolean }) => void) => nguoiNghe.delete(f)),
  };
  const matchMedia = vi.fn(() => mql);
  vi.stubGlobal('matchMedia', matchMedia);
  Object.defineProperty(window, 'matchMedia', { value: matchMedia, configurable: true, writable: true });
  return {
    mql,
    matchMedia,
    doi(matches: boolean) {
      mql.matches = matches;
      nguoiNghe.forEach((f) => f({ matches }));
    },
  };
}

describe('useMediaQuery / useDienThoai', () => {
  const goc = window.matchMedia;
  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', { value: goc, configurable: true, writable: true });
    vi.unstubAllGlobals();
  });

  it('truy vấn điện thoại là ≤767px (khớp @media của --be-rong-cot-thao-tac ở index.css)', () => {
    expect(MAN_HINH_DIEN_THOAI).toBe('(max-width: 767px)');
  });

  it('không có matchMedia (jsdom/SSR) → false, không ném lỗi', () => {
    Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true, writable: true });
    const { result } = renderHook(() => useDienThoai());
    expect(result.current).toBe(false);
  });

  it('đọc giá trị ban đầu và CẬP NHẬT khi xoay/đổi khung nhìn', () => {
    const mm = dungMatchMedia(false);
    const { result } = renderHook(() => useDienThoai());
    expect(result.current).toBe(false);
    act(() => mm.doi(true));
    expect(result.current).toBe(true);
    act(() => mm.doi(false));
    expect(result.current).toBe(false);
  });

  describe('MỘT bộ lắng nghe dùng chung (R-C2)', () => {
    beforeEach(() => expect(soKhoMediaQueryChoCaKiem()).toBe(0));

    it('100 dòng cùng dùng → matchMedia gọi 1 lần, addEventListener 1 lần', () => {
      const mm = dungMatchMedia(true);
      const may = Array.from({ length: 100 }, () => renderHook(() => useDienThoai()));
      expect(mm.matchMedia.mock.calls.filter((c) => (c as unknown[])[0] === MAN_HINH_DIEN_THOAI).length).toBeLessThanOrEqual(
        2,
      );
      expect(mm.mql.addEventListener).toHaveBeenCalledTimes(1);
      expect(soKhoMediaQueryChoCaKiem()).toBe(1);
      // Tất cả nhận cùng một thay đổi.
      act(() => mm.doi(false));
      expect(may.every((m) => m.result.current === false)).toBe(true);
      may.forEach((m) => m.unmount());
      // Dòng cuối rời đi → gỡ bộ lắng nghe gốc, không rò.
      expect(mm.mql.removeEventListener).toHaveBeenCalledTimes(1);
      expect(soKhoMediaQueryChoCaKiem()).toBe(0);
    });

    it('truy vấn khác nhau dùng bộ riêng', () => {
      dungMatchMedia(true);
      const a = renderHook(() => useMediaQuery('(min-width: 1px)'));
      const b = renderHook(() => useMediaQuery('(min-width: 2px)'));
      expect(soKhoMediaQueryChoCaKiem()).toBe(2);
      a.unmount();
      b.unmount();
      expect(soKhoMediaQueryChoCaKiem()).toBe(0);
    });
  });
});
