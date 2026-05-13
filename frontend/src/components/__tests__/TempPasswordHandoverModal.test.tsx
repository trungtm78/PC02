import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TempPasswordHandoverModal } from '../TempPasswordHandoverModal';

function renderModal(overrides: { tempPassword?: string } = {}) {
  const onAcknowledged = vi.fn();
  render(
    <TempPasswordHandoverModal
      tempPassword={overrides.tempPassword ?? 'TestTemp@2026Az'}
      userDisplayName="Nguyễn Văn A"
      userEmail="cb@pc02.local"
      onAcknowledged={onAcknowledged}
    />,
  );
  return { onAcknowledged };
}

describe('TempPasswordHandoverModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom default has no clipboard; mock per-test where needed.
  });

  it('renders the temp password in a monospace, select-all block', () => {
    renderModal({ tempPassword: 'XYZ@1234abcDE' });
    const display = screen.getByTestId('temp-pw-display');
    expect(display.textContent).toBe('XYZ@1234abcDE');
    expect(display.className).toMatch(/font-mono/);
    expect(display.className).toMatch(/select-all/);
  });

  it('renders the warning text and user context', () => {
    renderModal();
    expect(screen.getByText(/chỉ hiển thị MỘT LẦN/)).toBeTruthy();
    expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
    expect(screen.getByText(/cb@pc02.local/)).toBeTruthy();
  });

  // F1: close button must be DISABLED until admin either copies OR ticks the checkbox.
  it('Đóng button is disabled initially', () => {
    renderModal();
    const closeBtn = screen.getByRole('button', { name: 'Đóng' });
    expect(closeBtn).toHaveProperty('disabled', true);
  });

  it('enables Đóng after the acknowledgment checkbox is ticked', () => {
    const { onAcknowledged } = renderModal();
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    const closeBtn = screen.getByRole('button', { name: 'Đóng' });
    expect(closeBtn).toHaveProperty('disabled', false);
    fireEvent.click(closeBtn);
    expect(onAcknowledged).toHaveBeenCalledTimes(1);
  });

  it('enables Đóng after a successful clipboard copy and announces success', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });

    const { onAcknowledged } = renderModal({ tempPassword: 'CopyMe@1234' });
    fireEvent.click(screen.getByRole('button', { name: /Sao chép mật khẩu/i }));

    await waitFor(() =>
      expect(screen.getByText(/Đã sao chép mật khẩu tạm thời/)).toBeTruthy(),
    );
    expect((navigator.clipboard.writeText as any)).toHaveBeenCalledWith('CopyMe@1234');

    const closeBtn = screen.getByRole('button', { name: 'Đóng' });
    expect(closeBtn).toHaveProperty('disabled', false);
    fireEvent.click(closeBtn);
    expect(onAcknowledged).toHaveBeenCalledTimes(1);
  });

  it('shows the manual-copy fallback when navigator.clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });

    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /Sao chép mật khẩu/i }));

    await waitFor(() =>
      expect(screen.getByText(/Vui lòng bôi đen mật khẩu/)).toBeTruthy(),
    );
  });

  // Non-dismissible: ESC key must NOT call onAcknowledged.
  it('ESC key does NOT close the modal', () => {
    const { onAcknowledged } = renderModal();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onAcknowledged).not.toHaveBeenCalled();
  });
});
