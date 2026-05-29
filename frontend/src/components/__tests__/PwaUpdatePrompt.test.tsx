import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PwaUpdatePrompt } from '../PwaUpdatePrompt';

// Mock the virtual:pwa-register/react module used by vite-plugin-pwa.
// We control needRefresh and updateServiceWorker per test.
const mockUpdateSW = vi.fn();
let mockNeedRefresh = false;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [mockNeedRefresh, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: mockUpdateSW,
  }),
}));

describe('PwaUpdatePrompt', () => {
  beforeEach(() => {
    mockUpdateSW.mockClear();
    mockNeedRefresh = false;
  });

  it('renders nothing when needRefresh=false', () => {
    mockNeedRefresh = false;
    render(<PwaUpdatePrompt />);
    expect(screen.queryByTestId('pwa-update-prompt')).toBeNull();
  });

  it('renders prompt when needRefresh=true', () => {
    mockNeedRefresh = true;
    render(<PwaUpdatePrompt />);
    expect(screen.getByTestId('pwa-update-prompt')).toBeTruthy();
  });

  it('shows Vietnamese update message', () => {
    mockNeedRefresh = true;
    render(<PwaUpdatePrompt />);
    expect(screen.getByText(/cập nhật mới/i)).toBeTruthy();
  });

  it('calls updateServiceWorker(true) when "Cập nhật ngay" is clicked', () => {
    mockNeedRefresh = true;
    render(<PwaUpdatePrompt />);
    fireEvent.click(screen.getByText('Cập nhật ngay'));
    expect(mockUpdateSW).toHaveBeenCalledWith(true);
  });

  it('positions at bottom of viewport (not blocking modal)', () => {
    mockNeedRefresh = true;
    render(<PwaUpdatePrompt />);
    const prompt = screen.getByTestId('pwa-update-prompt');
    expect(prompt.className).toContain('bottom-');
    expect(prompt.className).toContain('fixed');
  });

  it('uses z-50 to stay visible above main content but below modals', () => {
    mockNeedRefresh = true;
    render(<PwaUpdatePrompt />);
    const prompt = screen.getByTestId('pwa-update-prompt');
    // z-30 keeps below modal overlay (z-40) but above main content
    expect(prompt.className).toMatch(/z-(30|40)/);
  });

  it('dismiss button calls setNeedRefresh(false)', () => {
    mockNeedRefresh = true;
    render(<PwaUpdatePrompt />);
    expect(screen.getByLabelText('Đóng thông báo cập nhật')).toBeTruthy();
  });
});
