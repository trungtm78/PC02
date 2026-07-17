import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock useShortcut để kiểm tra đăng ký đúng action + enabled (không cần DOM/hotkeys thật).
const calls: Array<{ action: string; enabled: boolean; handler: () => void }> = [];
vi.mock('../useShortcut', () => ({
  useShortcut: (action: string, handler: () => void, opts?: { enabled?: boolean }) => {
    calls.push({ action, handler, enabled: opts?.enabled !== false });
  },
}));

import { useFormShortcuts } from '../useFormShortcuts';

beforeEach(() => {
  calls.length = 0;
});

describe('useFormShortcuts', () => {
  it('đăng ký đủ 4 action save/cancel/exportDocx/delete', () => {
    renderHook(() =>
      useFormShortcuts({ onSave: vi.fn(), onCancel: vi.fn(), onExportDocs: vi.fn(), onDelete: vi.fn(), canDelete: true }),
    );
    expect(calls.map((c) => c.action).sort()).toEqual(['cancel', 'delete', 'exportDocx', 'save']);
  });

  it('delete DISABLED khi canDelete=false (form tạo mới)', () => {
    renderHook(() => useFormShortcuts({ onDelete: vi.fn(), canDelete: false }));
    const del = calls.find((c) => c.action === 'delete');
    expect(del?.enabled).toBe(false);
  });

  it('delete ENABLED khi có onDelete + canDelete=true (form sửa)', () => {
    renderHook(() => useFormShortcuts({ onDelete: vi.fn(), canDelete: true }));
    expect(calls.find((c) => c.action === 'delete')?.enabled).toBe(true);
  });

  it('handler không truyền → action đó disabled (enabled=false)', () => {
    renderHook(() => useFormShortcuts({ onSave: vi.fn() }));
    expect(calls.find((c) => c.action === 'save')?.enabled).toBe(true);
    expect(calls.find((c) => c.action === 'cancel')?.enabled).toBe(false);
    expect(calls.find((c) => c.action === 'exportDocx')?.enabled).toBe(false);
  });

  it('gọi handler tương ứng khi shortcut fire', () => {
    const onSave = vi.fn();
    renderHook(() => useFormShortcuts({ onSave }));
    calls.find((c) => c.action === 'save')?.handler();
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
