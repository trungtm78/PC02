import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const calls: Array<{ action: string; enabled: boolean; handler: () => void }> = [];
vi.mock('../useShortcut', () => ({
  useShortcut: (action: string, handler: () => void, opts?: { enabled?: boolean }) => {
    calls.push({ action, handler, enabled: opts?.enabled !== false });
  },
}));

import { useListShortcuts } from '../useListShortcuts';

beforeEach(() => { calls.length = 0; });

describe('useListShortcuts', () => {
  it('đăng ký newRecord/refreshList/export/search', () => {
    renderHook(() => useListShortcuts({ onNew: vi.fn(), onRefresh: vi.fn(), onExport: vi.fn() }));
    expect(calls.map((c) => c.action).sort()).toEqual(['export', 'newRecord', 'refreshList', 'search']);
  });

  it('handler không truyền → action disabled (trừ search luôn bật)', () => {
    renderHook(() => useListShortcuts({ onNew: vi.fn() }));
    expect(calls.find((c) => c.action === 'newRecord')?.enabled).toBe(true);
    expect(calls.find((c) => c.action === 'refreshList')?.enabled).toBe(false);
    expect(calls.find((c) => c.action === 'export')?.enabled).toBe(false);
    expect(calls.find((c) => c.action === 'search')?.enabled).toBe(true);
  });

  it('search mặc định focus [role=searchbox] khi không truyền onSearch', () => {
    const input = document.createElement('input');
    input.setAttribute('role', 'searchbox');
    document.body.appendChild(input);
    renderHook(() => useListShortcuts({}));
    calls.find((c) => c.action === 'search')?.handler();
    expect(document.activeElement).toBe(input);
    input.remove();
  });

  it('onSearch tùy chỉnh được ưu tiên', () => {
    const onSearch = vi.fn();
    renderHook(() => useListShortcuts({ onSearch }));
    calls.find((c) => c.action === 'search')?.handler();
    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});
