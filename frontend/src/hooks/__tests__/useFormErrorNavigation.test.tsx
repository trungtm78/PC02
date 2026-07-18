import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useFormErrorNavigation } from '../useFormErrorNavigation';

vi.mock('@/hooks/useUserShortcuts', () => ({
  useUserShortcutMap: () => new Map<string, string>([['nextError', 'Shift+Enter']]),
}));

function makeEvent(code: string, shiftKey: boolean): ReactKeyboardEvent<HTMLElement> {
  return {
    nativeEvent: new KeyboardEvent('keydown', { code, key: code, shiftKey }),
    preventDefault: vi.fn(),
  } as unknown as ReactKeyboardEvent<HTMLElement>;
}

describe('useFormErrorNavigation', () => {
  it('focusFirstError: false khi không lỗi, true khi có lỗi', () => {
    const { result, rerender } = renderHook(
      ({ f }: { f: string[] }) => useFormErrorNavigation(() => f),
      { initialProps: { f: [] as string[] } },
    );
    expect(result.current.focusFirstError()).toBe(false);
    rerender({ f: ['field-x'] });
    expect(result.current.focusFirstError()).toBe(true);
  });

  it('handleFormKeyDown: Shift+Enter + có lỗi → preventDefault (nhảy ô lỗi)', () => {
    const { result } = renderHook(() => useFormErrorNavigation(() => ['field-x']));
    const e = makeEvent('Enter', true);
    result.current.handleFormKeyDown(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('handleFormKeyDown: Enter thường → KHÔNG preventDefault (không khớp binding)', () => {
    const { result } = renderHook(() => useFormErrorNavigation(() => ['field-x']));
    const e = makeEvent('Enter', false);
    result.current.handleFormKeyDown(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('handleFormKeyDown: Shift+Enter nhưng KHÔNG lỗi → không chặn (xuống dòng bình thường)', () => {
    const { result } = renderHook(() => useFormErrorNavigation(() => []));
    const e = makeEvent('Enter', true);
    result.current.handleFormKeyDown(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});
