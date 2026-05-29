import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppSidebar } from '../AppSidebar';

vi.mock('@/hooks/useBadgeCounts', () => ({
  useBadgeCounts: () => ({ counts: {}, refresh: vi.fn() }),
}));
vi.mock('@/lib/features', () => ({
  useMenuSections: () => [],
}));

function renderSidebar(props: { onClose?: () => void; isMobileOpen?: boolean } = {}) {
  return render(
    <MemoryRouter>
      <AppSidebar {...props} />
    </MemoryRouter>,
  );
}

describe('AppSidebar — Mobile drawer props', () => {
  it('does NOT render mobile close button when onClose is not provided', () => {
    renderSidebar();
    expect(screen.queryByTestId('sidebar-close-mobile')).toBeNull();
  });

  it('renders mobile close button (lg:hidden) when onClose is provided', () => {
    const onClose = vi.fn();
    renderSidebar({ onClose });
    const closeBtn = screen.getByTestId('sidebar-close-mobile');
    expect(closeBtn).toBeTruthy();
    expect(closeBtn.className).toContain('lg:hidden');
    expect(closeBtn.getAttribute('aria-label')).toBe('Đóng menu');
  });

  it('clicking mobile close button calls onClose', () => {
    const onClose = vi.fn();
    renderSidebar({ onClose });
    fireEvent.click(screen.getByTestId('sidebar-close-mobile'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mobile close button has 44px minimum touch target', () => {
    const onClose = vi.fn();
    renderSidebar({ onClose });
    const btn = screen.getByTestId('sidebar-close-mobile');
    expect(btn.className).toMatch(/min-h-\[44px\]/);
    expect(btn.className).toMatch(/min-w-\[44px\]/);
  });

  it('forces non-compact (260px) width when isMobileOpen=true', () => {
    const onClose = vi.fn();
    renderSidebar({ onClose, isMobileOpen: true });
    const sidebar = screen.getByTestId('main-sidebar');
    // Must render at 260px when mobile drawer is open (auto-decision #13)
    expect(sidebar.style.width).toBe('260px');
  });
});
