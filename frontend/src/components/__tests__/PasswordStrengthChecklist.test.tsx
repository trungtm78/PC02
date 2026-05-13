import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  PasswordStrengthChecklist,
  PASSWORD_RULES,
  isStrongPassword,
} from '../PasswordStrengthChecklist';

describe('PasswordStrengthChecklist', () => {
  it('renders all 4 rules', () => {
    render(<PasswordStrengthChecklist password="abc" />);
    expect(screen.getByText('Tối thiểu 8 ký tự')).toBeTruthy();
    expect(screen.getByText('Có chữ hoa (A-Z)')).toBeTruthy();
    expect(screen.getByText('Có chữ số (0-9)')).toBeTruthy();
    expect(screen.getByText('Có ký tự đặc biệt (!@#$%^&*)')).toBeTruthy();
  });

  // a11y: live region so screen reader announces rule status changes
  it('exposes a polite live region (a11y)', () => {
    const { container } = render(<PasswordStrengthChecklist password="test" />);
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
  });

  it('PASSWORD_RULES has exactly 4 rules', () => {
    expect(PASSWORD_RULES).toHaveLength(4);
  });

  describe('isStrongPassword', () => {
    it('returns true when all 4 rules pass', () => {
      expect(isStrongPassword('Strong@Pass1')).toBe(true);
    });

    it.each([
      ['shrt@A1', 'too short'],          // length 7
      ['nouppercase@1', 'no uppercase'],
      ['NoSpecialChar1', 'no special'],
      ['NoDigits!@A', 'no digit'],
    ])('returns false for "%s" (%s)', (pw) => {
      expect(isStrongPassword(pw)).toBe(false);
    });

    it('returns true even when lowercase is absent (we do not require it)', () => {
      expect(isStrongPassword('NOLOWER@1A')).toBe(true);
    });
  });
});
