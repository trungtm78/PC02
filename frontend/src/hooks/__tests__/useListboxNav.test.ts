import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useListboxNav } from '../useListboxNav';

Element.prototype.scrollIntoView = vi.fn();

function phim(key: string, extra: { isComposing?: boolean; keyCode?: number } = {}) {
  const preventDefault = vi.fn();
  const e = {
    key,
    preventDefault,
    nativeEvent: { isComposing: extra.isComposing ?? false, keyCode: extra.keyCode ?? 0 },
  } as unknown as ReactKeyboardEvent;
  return { e, preventDefault };
}

function dung(count: number, over: Partial<Parameters<typeof useListboxNav>[0]> = {}) {
  const onSelect = vi.fn();
  const onEscape = vi.fn();
  const onTab = vi.fn();
  const hook = renderHook(
    (props: { count: number; resetKey: string }) =>
      useListboxNav({ count: props.count, resetKey: props.resetKey, onSelect, onEscape, onTab, ...over }),
    { initialProps: { count, resetKey: 'a' } },
  );
  return { ...hook, onSelect, onEscape, onTab };
}

function bam(h: ReturnType<typeof dung>, key: string, extra?: { isComposing?: boolean; keyCode?: number }) {
  const p = phim(key, extra);
  act(() => h.result.current.onKeyDown(p.e));
  return p;
}

describe('useListboxNav', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bắt đầu không tô mục nào', () => {
    const h = dung(3);
    expect(h.result.current.activeIndex).toBe(-1);
    expect(h.result.current.activeDescendantId).toBeUndefined();
  });

  it('ArrowDown đi xuống và vòng về đầu ở cuối danh sách', () => {
    const h = dung(3);
    bam(h, 'ArrowDown');
    expect(h.result.current.activeIndex).toBe(0);
    bam(h, 'ArrowDown');
    bam(h, 'ArrowDown');
    expect(h.result.current.activeIndex).toBe(2);
    bam(h, 'ArrowDown');
    expect(h.result.current.activeIndex).toBe(0);
  });

  it('ArrowUp từ chưa tô nhảy xuống mục cuối, rồi lùi và vòng', () => {
    const h = dung(3);
    bam(h, 'ArrowUp');
    expect(h.result.current.activeIndex).toBe(2);
    bam(h, 'ArrowUp');
    expect(h.result.current.activeIndex).toBe(1);
    bam(h, 'ArrowUp');
    bam(h, 'ArrowUp');
    expect(h.result.current.activeIndex).toBe(2);
  });

  it('Home/End nhảy về đầu/cuối', () => {
    const h = dung(30);
    bam(h, 'End');
    expect(h.result.current.activeIndex).toBe(29);
    bam(h, 'Home');
    expect(h.result.current.activeIndex).toBe(0);
  });

  it('PageDown/PageUp nhảy 10 mục và chặn ở hai đầu, không vòng', () => {
    const h = dung(25);
    bam(h, 'PageDown');
    expect(h.result.current.activeIndex).toBe(9);
    bam(h, 'PageDown');
    bam(h, 'PageDown');
    expect(h.result.current.activeIndex).toBe(24);
    bam(h, 'PageUp');
    expect(h.result.current.activeIndex).toBe(14);
    bam(h, 'PageUp');
    bam(h, 'PageUp');
    expect(h.result.current.activeIndex).toBe(0);
  });

  it('phím điều hướng đều chặn hành vi mặc định (không cuộn trang, không đưa con trỏ về đầu ô)', () => {
    const h = dung(3);
    for (const k of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp']) {
      expect(bam(h, k).preventDefault).toHaveBeenCalled();
    }
  });

  it('Enter chỉ chọn khi có mục đang tô — không tự lấy mục đầu', () => {
    const h = dung(3);
    const p = bam(h, 'Enter');
    expect(h.onSelect).not.toHaveBeenCalled();
    // Vẫn chặn Enter để không gửi form đang chứa ô này.
    expect(p.preventDefault).toHaveBeenCalled();
  });

  it('Enter chọn đúng mục đang tô', () => {
    const h = dung(3);
    bam(h, 'ArrowDown');
    bam(h, 'ArrowDown');
    bam(h, 'Enter');
    expect(h.onSelect).toHaveBeenCalledTimes(1);
    expect(h.onSelect).toHaveBeenCalledWith(1);
  });

  it('đang gõ dấu tiếng Việt (isComposing / keyCode 229) thì bỏ qua mọi phím', () => {
    const h = dung(3);
    bam(h, 'ArrowDown');
    const p1 = bam(h, 'Enter', { isComposing: true });
    const p2 = bam(h, 'ArrowDown', { keyCode: 229 });
    expect(h.onSelect).not.toHaveBeenCalled();
    expect(h.result.current.activeIndex).toBe(0);
    expect(p1.preventDefault).not.toHaveBeenCalled();
    expect(p2.preventDefault).not.toHaveBeenCalled();
  });

  it('Escape gọi onEscape; Tab gọi onTab và KHÔNG chặn mặc định (để tiêu điểm đi tiếp)', () => {
    const h = dung(3);
    bam(h, 'Escape');
    expect(h.onEscape).toHaveBeenCalledTimes(1);
    const p = bam(h, 'Tab');
    expect(h.onTab).toHaveBeenCalledTimes(1);
    expect(p.preventDefault).not.toHaveBeenCalled();
  });

  it('danh sách rỗng: mũi tên không làm gì, Enter vẫn không gửi form, Escape vẫn đóng', () => {
    const h = dung(0);
    bam(h, 'ArrowDown');
    expect(h.result.current.activeIndex).toBe(-1);
    expect(bam(h, 'Enter').preventDefault).toHaveBeenCalled();
    expect(h.onSelect).not.toHaveBeenCalled();
    bam(h, 'Escape');
    expect(h.onEscape).toHaveBeenCalled();
  });

  it('bỏ tô khi danh sách đổi (resetKey) — không để Enter chọn nhầm người khác', () => {
    const h = dung(3);
    bam(h, 'ArrowDown');
    bam(h, 'ArrowDown');
    expect(h.result.current.activeIndex).toBe(1);
    h.rerender({ count: 2, resetKey: 'b' });
    expect(h.result.current.activeIndex).toBe(-1);
    bam(h, 'Enter');
    expect(h.onSelect).not.toHaveBeenCalled();
  });

  it('số mục co lại dưới chỉ số đang tô thì không trỏ ra ngoài danh sách', () => {
    const h = dung(5);
    bam(h, 'End');
    expect(h.result.current.activeIndex).toBe(4);
    h.rerender({ count: 2, resetKey: 'a' });
    bam(h, 'Enter');
    expect(h.onSelect).not.toHaveBeenCalled();
  });

  it('cung cấp id mục và aria-activedescendant khớp nhau', () => {
    const h = dung(3, { idPrefix: 'tdc' });
    expect(h.result.current.optionId(2)).toBe('tdc-muc-2');
    bam(h, 'ArrowDown');
    expect(h.result.current.activeDescendantId).toBe('tdc-muc-0');
  });

  it('đặt lại chỉ số bằng reset()', () => {
    const h = dung(3);
    bam(h, 'ArrowDown');
    act(() => h.result.current.reset());
    expect(h.result.current.activeIndex).toBe(-1);
  });

  it('ô chữ tự do (chanEnterKhiChuaTo=false): Enter khi chưa tô thì KHÔNG bị chặn, có tô thì chọn và chặn', () => {
    const h = dung(3, { chanEnterKhiChuaTo: false });
    const p1 = bam(h, 'Enter');
    expect(p1.preventDefault).not.toHaveBeenCalled();
    expect(h.onSelect).not.toHaveBeenCalled();
    bam(h, 'ArrowDown');
    const p2 = bam(h, 'Enter');
    expect(p2.preventDefault).toHaveBeenCalled();
    expect(h.onSelect).toHaveBeenCalledWith(0);
  });
});
