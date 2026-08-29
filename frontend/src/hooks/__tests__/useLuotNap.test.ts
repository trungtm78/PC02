import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLuotNap } from '../useLuotNap';

/**
 * Bất biến: chỉ lượt nạp MỚI NHẤT được coi là còn hiệu lực. Mọi lượt cũ — dù xong sau — đều
 * phải tự biết là mình đã lỗi thời và không ghi gì.
 */
describe('useLuotNap', () => {
  it('lượt duy nhất thì còn hiệu lực', () => {
    const { result } = renderHook(() => useLuotNap());
    const con = result.current.batDau();
    expect(con()).toBe(true);
  });

  it('lượt cũ hết hiệu lực ngay khi có lượt mới', () => {
    const { result } = renderHook(() => useLuotNap());
    const cu = result.current.batDau();
    const moi = result.current.batDau();
    expect(cu()).toBe(false);
    expect(moi()).toBe(true);
  });

  /** Đây là ca sát thực tế nhất: lượt cũ về SAU lượt mới và vẫn phải im. */
  it('lượt cũ về sau lượt mới vẫn không được ghi', () => {
    const { result } = renderHook(() => useLuotNap());
    const a = result.current.batDau();
    const b = result.current.batDau();
    const c = result.current.batDau();
    expect(c()).toBe(true);
    expect(b()).toBe(false);
    expect(a()).toBe(false);
  });

  it('chỉ MỘT lượt còn hiệu lực tại một thời điểm', () => {
    const { result } = renderHook(() => useLuotNap());
    const ds = [result.current.batDau(), result.current.batDau(), result.current.batDau()];
    expect(ds.filter((f) => f()).length).toBe(1);
  });
});
