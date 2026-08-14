import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from '../MainLayout';

// Force mobile viewport BEFORE any module imports the layout.
// jsdom defaults innerWidth=1024 which would make isDesktopWidth=true and
// hide the hamburger button + use the desktop layout branch.
Object.defineProperty(window, 'innerWidth', { value: 430, writable: true, configurable: true });
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false, // any media query (incl. (min-width: 1024px)) returns false on mobile
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }),
});

// Mock dependencies that touch network or browser APIs
vi.mock('@/stores/auth.store', () => ({
  authStore: {
    // usePermission subscribes to the store now instead of snapshotting it.
    getProfileRaw: vi.fn(() => null),
    onTokenChanged: vi.fn(() => () => {}),
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
  CheatSheetButton: () => null,
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

  it('renders hamburger button for mobile viewport', () => {
    renderLayout();
    const hamburger = screen.getByTestId('mobile-hamburger');
    expect(hamburger).toBeTruthy();
    expect(hamburger.getAttribute('aria-label')).toBe('Mở menu');
  });

  it('hamburger has min 44px touch target', () => {
    renderLayout();
    const hamburger = screen.getByTestId('mobile-hamburger');
    expect(hamburger.className).toMatch(/min-h-\[44px\]|w-11|h-11|p-2/);
  });

  it('sidebar starts closed on mobile (translateX(-100%) inline style)', () => {
    renderLayout();
    const wrapper = screen.getByTestId('sidebar-wrapper');
    expect(wrapper.style.transform).toBe('translateX(-100%)');
    expect(wrapper.hasAttribute('inert')).toBe(true);
  });

  it('clicking hamburger opens the sidebar drawer', () => {
    renderLayout();
    const hamburger = screen.getByTestId('mobile-hamburger');
    fireEvent.click(hamburger);
    const wrapper = screen.getByTestId('sidebar-wrapper');
    expect(wrapper.style.transform).toBe('translateX(0)');
    expect(wrapper.hasAttribute('inert')).toBe(false);
  });

  it('renders backdrop when drawer is open on mobile', () => {
    renderLayout();
    expect(screen.queryByTestId('sidebar-backdrop')).toBeNull();
    fireEvent.click(screen.getByTestId('mobile-hamburger'));
    const backdrop = screen.getByTestId('sidebar-backdrop');
    expect(backdrop).toBeTruthy();
    expect(backdrop.className).toContain('bg-black/50');
  });

  it('clicking backdrop closes the sidebar', () => {
    renderLayout();
    fireEvent.click(screen.getByTestId('mobile-hamburger'));
    expect(screen.getByTestId('sidebar-wrapper').style.transform).toBe('translateX(0)');
    fireEvent.click(screen.getByTestId('sidebar-backdrop'));
    expect(screen.getByTestId('sidebar-wrapper').style.transform).toBe('translateX(-100%)');
  });

  it('Escape key closes the open sidebar', () => {
    renderLayout();
    fireEvent.click(screen.getByTestId('mobile-hamburger'));
    expect(screen.getByTestId('sidebar-wrapper').style.transform).toBe('translateX(0)');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('sidebar-wrapper').style.transform).toBe('translateX(-100%)');
  });
});
