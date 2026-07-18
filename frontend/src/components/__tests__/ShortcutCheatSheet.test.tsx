import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, renderHook, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ShortcutCheatSheet,
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
  getCaptureModeActive: () => false,
}));

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  localStorage.clear();
  setCheatSheetOpen(false);
  cleanup();
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

describe('ShortcutCheatSheet modal', () => {
  it('phím ? ĐÓNG cheat-sheet khi đang mở (không bị guard modal nuốt)', () => {
    renderWithProviders(<ShortcutCheatSheet />);
    act(() => setCheatSheetOpen(true));
    expect(screen.getByRole('dialog')).toBeTruthy();
    // `?` = Shift+Slash (serializeKey đọc e.code='Slash' + shiftKey)
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Slash', key: '?', shiftKey: true }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Esc ĐÓNG cheat-sheet khi đang mở', () => {
    renderWithProviders(<ShortcutCheatSheet />);
    act(() => setCheatSheetOpen(true));
    expect(screen.getByRole('dialog')).toBeTruthy();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
