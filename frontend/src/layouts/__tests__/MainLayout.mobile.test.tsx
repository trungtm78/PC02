import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from '../MainLayout';

// Mock dependencies that touch network or browser APIs
vi.mock('@/stores/auth.store', () => ({
  authStore: {
    getUser: () => ({ email: 'test@pc02.local', role: 'INVESTIGATOR' }),
    clearTokens: vi.fn(),
  },
}));

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn().mockResolvedValue({}) },
}));

vi.mock('@/hooks/useAbbreviationExpander', () => ({
  useAbbreviationExpander: () => {},
}));
vi.mock('@/hooks/useAddressConverter', () => ({
  useAddressConverter: () => ({ preview: null, applyConversion: vi.fn(), cancelConversion: vi.fn() }),
}));
vi.mock('@/hooks/useShortcut', () => ({
  useShortcut: () => {},
}));
vi.mock('@/hooks/useUserShortcuts', () => ({
  useUserShortcutBroadcast: () => {},
}));
vi.mock('@/hooks/useBadgeCounts', () => ({
  useBadgeCounts: () => ({ counts: {}, refresh: vi.fn() }),
}));
vi.mock('@/lib/features', () => ({
  useMenuSections: () => [],
}));

vi.mock('@/components/NotificationDropdown', () => ({
  NotificationDropdown: () => <div data-testid="notif-mock" />,
}));
vi.mock('@/components/GlobalSearchBar', () => ({
  GlobalSearchBar: () => <div data-testid="search-mock" />,
}));
vi.mock('@/components/ChangePasswordModal', () => ({
  ChangePasswordModal: () => null,
}));
vi.mock('@/components/TwoFaSetupModal', () => ({
  TwoFaSetupModal: () => null,
}));
vi.mock('@/components/AddressConversionDialog', () => ({
  AddressConversionDialog: () => null,
}));
vi.mock('@/components/ShortcutCheatSheet', () => ({
  ShortcutCheatSheet: () => null,
}));
vi.mock('@/components/PwaUpdatePrompt', () => ({
  PwaUpdatePrompt: () => null,
}));

function renderLayout(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<div>Home</div>} />
          <Route path="cases" element={<div>Cases</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('MainLayout — Mobile drawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders hamburger button (lg:hidden) for mobile viewport', () => {
    renderLayout();
    const hamburger = screen.getByTestId('mobile-hamburger');
    expect(hamburger).toBeTruthy();
    expect(hamburger.className).toContain('lg:hidden');
    expect(hamburger.getAttribute('aria-label')).toBe('Mở menu');
  });

  it('hamburger has min 44px touch target', () => {
    renderLayout();
    const hamburger = screen.getByTestId('mobile-hamburger');
    expect(hamburger.className).toMatch(/min-h-\[44px\]|w-11|h-11|p-2/);
  });

  it('sidebar starts closed on mobile (translate-x-full)', () => {
    renderLayout();
    const wrapper = screen.getByTestId('sidebar-wrapper');
    expect(wrapper.className).toContain('-translate-x-full');
  });

  it('clicking hamburger opens the sidebar drawer', () => {
    renderLayout();
    const hamburger = screen.getByTestId('mobile-hamburger');
    fireEvent.click(hamburger);
    const wrapper = screen.getByTestId('sidebar-wrapper');
    expect(wrapper.className).toContain('translate-x-0');
    expect(wrapper.className).not.toContain('-translate-x-full');
  });

  it('renders backdrop when drawer is open (mobile only)', () => {
    renderLayout();
    expect(screen.queryByTestId('sidebar-backdrop')).toBeNull();
    fireEvent.click(screen.getByTestId('mobile-hamburger'));
    const backdrop = screen.getByTestId('sidebar-backdrop');
    expect(backdrop).toBeTruthy();
    expect(backdrop.className).toContain('lg:hidden');
  });

  it('clicking backdrop closes the sidebar', () => {
    renderLayout();
    fireEvent.click(screen.getByTestId('mobile-hamburger'));
    expect(screen.getByTestId('sidebar-wrapper').className).toContain('translate-x-0');
    fireEvent.click(screen.getByTestId('sidebar-backdrop'));
    expect(screen.getByTestId('sidebar-wrapper').className).toContain('-translate-x-full');
  });

  it('Escape key closes the open sidebar', () => {
    renderLayout();
    fireEvent.click(screen.getByTestId('mobile-hamburger'));
    expect(screen.getByTestId('sidebar-wrapper').className).toContain('translate-x-0');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('sidebar-wrapper').className).toContain('-translate-x-full');
  });
});
