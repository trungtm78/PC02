import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useGridLayout, GRID_FLAG, GRID_LAYOUT_STORAGE_KEY } from '../useGridLayout';
import { FeatureFlagsContext } from '@/lib/features/featureFlagsContextObject';

/**
 * The grid is the DEFAULT way to enter and read figures (the template as the officer knows it), with an emergency
 * switch: the flag `dynamic_reports_grid` brings the list back for everyone without a deploy. The list stays the
 * default where the screen is narrow, and the choice of a person who picked a layout is remembered.
 */

function flagsWith(enabled: boolean | null) {
  const flags = new Map<string, { key: string; enabled: boolean }>();
  if (enabled !== null) flags.set(GRID_FLAG, { key: GRID_FLAG, enabled });
  return ({ children }: { children: ReactNode }) => (
    <FeatureFlagsContext.Provider value={{ flags, isLoading: false } as never}>{children}</FeatureFlagsContext.Provider>
  );
}

function stubScreen(narrow: boolean | 'unknown') {
  if (narrow === 'unknown') {
    vi.stubGlobal('matchMedia', undefined);
    Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true, writable: true });
    return;
  }
  const impl = (query: string) => ({ matches: narrow && query.includes('max-width'), media: query, addEventListener() {}, removeEventListener() {} });
  Object.defineProperty(window, 'matchMedia', { value: impl, configurable: true, writable: true });
}

describe('useGridLayout', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'matchMedia', { value: undefined, configurable: true, writable: true });
    localStorage.clear();
  });

  it('starts as the grid on a wide screen when nothing has been switched off', () => {
    stubScreen(false);
    const { result } = renderHook(() => useGridLayout(), { wrapper: flagsWith(null) }); // flag never seeded
    expect(result.current.gridAllowed).toBe(true);
    expect(result.current.layoutMode).toBe('grid');
  });

  it('starts as the list on a narrow screen', () => {
    stubScreen(true);
    const { result } = renderHook(() => useGridLayout(), { wrapper: flagsWith(true) });
    expect(result.current.layoutMode).toBe('list');
    expect(result.current.gridAllowed).toBe(true); // it can still be opened
  });

  it('when the screen cannot be measured it stays the list: the safe view', () => {
    stubScreen('unknown');
    const { result } = renderHook(() => useGridLayout(), { wrapper: flagsWith(true) });
    expect(result.current.layoutMode).toBe('list');
  });

  it('while the flags are still being read the list is shown, then the grid opens (never a grid that is about to be switched off)', () => {
    stubScreen(false);
    let loading = true;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <FeatureFlagsContext.Provider value={{ flags: new Map(), isLoading: loading } as never}>{children}</FeatureFlagsContext.Provider>
    );
    const { result, rerender } = renderHook(() => useGridLayout(), { wrapper });
    expect(result.current.layoutMode).toBe('list');
    expect(result.current.gridAllowed).toBe(false);
    loading = false;
    rerender();
    expect(result.current.gridAllowed).toBe(true);
    expect(result.current.layoutMode).toBe('grid');
  });

  it('the emergency switch brings the list back for everyone, and the grid cannot be opened', () => {
    stubScreen(false);
    const { result } = renderHook(() => useGridLayout(), { wrapper: flagsWith(false) });
    expect(result.current.gridAllowed).toBe(false);
    expect(result.current.layoutMode).toBe('list');
    act(() => result.current.setLayoutMode('grid'));
    expect(result.current.layoutMode).toBe('list');
  });

  it('switching the flag off while the page is open takes the grid away at once', () => {
    stubScreen(false);
    let enabled = true;
    const wrapper = ({ children }: { children: ReactNode }) => {
      const Provider = flagsWith(enabled);
      return <Provider>{children}</Provider>;
    };
    const { result, rerender } = renderHook(() => useGridLayout(), { wrapper });
    expect(result.current.layoutMode).toBe('grid');
    enabled = false;
    rerender();
    expect(result.current.layoutMode).toBe('list');
  });

  it('remembers what a person picked, over the default', () => {
    stubScreen(false);
    const first = renderHook(() => useGridLayout(), { wrapper: flagsWith(true) });
    act(() => first.result.current.setLayoutMode('list'));
    expect(localStorage.getItem(GRID_LAYOUT_STORAGE_KEY)).toBe('list');
    first.unmount();

    const second = renderHook(() => useGridLayout(), { wrapper: flagsWith(true) });
    expect(second.result.current.layoutMode).toBe('list');
  });

  it('a choice made on a narrow screen opens the grid next time, as picked', () => {
    stubScreen(true);
    const first = renderHook(() => useGridLayout(), { wrapper: flagsWith(true) });
    act(() => first.result.current.setLayoutMode('grid'));
    first.unmount();
    const second = renderHook(() => useGridLayout(), { wrapper: flagsWith(true) });
    expect(second.result.current.layoutMode).toBe('grid');
  });

  it('unreadable or unwritable storage is no problem', () => {
    stubScreen(false);
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useGridLayout(), { wrapper: flagsWith(true) });
    expect(result.current.layoutMode).toBe('grid');
    expect(() => act(() => result.current.setLayoutMode('list'))).not.toThrow();
    spy.mockRestore();
    set.mockRestore();
  });

  it('a stored value that is not a layout is ignored', () => {
    stubScreen(false);
    localStorage.setItem(GRID_LAYOUT_STORAGE_KEY, 'tabs');
    const { result } = renderHook(() => useGridLayout(), { wrapper: flagsWith(true) });
    expect(result.current.layoutMode).toBe('grid');
  });
});
