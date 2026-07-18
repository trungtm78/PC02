import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import {
  ShortcutHint,
  CheatSheetButton,
  useCheatSheetOpen,
  setCheatSheetOpen,
  toggleCheatSheet,
} from '../ShortcutCheatSheet';
import { setShortcutHintsEnabled } from '@/hooks/useShortcutHints';

// Cô lập khỏi React Query: map action → binding cố định.
vi.mock('@/hooks/useUserShortcuts', () => ({
  useUserShortcutMap: () =>
    new Map<string, string>([
      ['save', 'F2'],
      ['newRecord', 'Alt+N'],
      ['showCheatSheet', 'Shift+Slash'],
    ]),
}));

beforeEach(() => {
  localStorage.clear();
  setCheatSheetOpen(false);
});

describe('ShortcutHint', () => {
  it('hiện binding đã format (save → F2)', () => {
    render(<ShortcutHint action="save" />);
    expect(screen.getByText('F2')).toBeTruthy();
  });

  it('format tổ hợp đặc biệt (showCheatSheet Shift+Slash → ?)', () => {
    render(<ShortcutHint action="showCheatSheet" />);
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('ẩn hoàn toàn khi tắt toggle gợi ý', () => {
    setShortcutHintsEnabled(false);
    const { container } = render(<ShortcutHint action="save" />);
    expect(container.querySelector('kbd')).toBeNull();
  });
});

describe('cheat-sheet store', () => {
  it('toggle mở rồi đóng', () => {
    const { result } = renderHook(() => useCheatSheetOpen());
    expect(result.current).toBe(false);
    act(() => toggleCheatSheet());
    expect(result.current).toBe(true);
    act(() => setCheatSheetOpen(false));
    expect(result.current).toBe(false);
  });

  it('CheatSheetButton click → mở cheat-sheet', () => {
    const { result } = renderHook(() => useCheatSheetOpen());
    render(<CheatSheetButton />);
    fireEvent.click(screen.getByTestId('cheatsheet-open-btn'));
    expect(result.current).toBe(true);
  });
});
