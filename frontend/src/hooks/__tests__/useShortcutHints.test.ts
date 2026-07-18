import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShortcutHintsEnabled, setShortcutHintsEnabled } from '../useShortcutHints';

beforeEach(() => {
  localStorage.clear();
});

describe('useShortcutHints', () => {
  it('mặc định BẬT khi chưa có giá trị lưu', () => {
    const { result } = renderHook(() => useShortcutHintsEnabled());
    expect(result.current).toBe(true);
  });

  it('tắt → hook trả false + persist localStorage', () => {
    const { result } = renderHook(() => useShortcutHintsEnabled());
    act(() => setShortcutHintsEnabled(false));
    expect(result.current).toBe(false);
    expect(localStorage.getItem('pc02-shortcut-hints')).toBe('false');
  });

  it('bật lại → hook trả true', () => {
    setShortcutHintsEnabled(false);
    const { result } = renderHook(() => useShortcutHintsEnabled());
    expect(result.current).toBe(false);
    act(() => setShortcutHintsEnabled(true));
    expect(result.current).toBe(true);
  });
});
