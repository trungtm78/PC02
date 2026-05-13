import { Check, X } from 'lucide-react';

export interface PasswordRule {
  label: string;
  test: (v: string) => boolean;
}

/**
 * Single source of truth for the strong-password rules used by both
 * ChangePasswordModal (voluntary change) and FirstLoginChangePasswordPage
 * (forced change). Mirrors backend STRONG_PASSWORD_REGEX exactly.
 */
export const PASSWORD_RULES: PasswordRule[] = [
  { label: 'Tối thiểu 8 ký tự', test: (v) => v.length >= 8 },
  { label: 'Có chữ hoa (A-Z)', test: (v) => /[A-Z]/.test(v) },
  { label: 'Có chữ số (0-9)', test: (v) => /[0-9]/.test(v) },
  { label: 'Có ký tự đặc biệt (!@#$%^&*)', test: (v) => /[!@#$%^&*]/.test(v) },
];

export function isStrongPassword(password: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(password));
}

interface Props {
  password: string;
  /** Render even when password is empty (forced flow shows the rules upfront). */
  alwaysVisible?: boolean;
  /** Optional id for `aria-describedby` linking from the password input. */
  id?: string;
}

/**
 * Real-time password strength checklist with a polite live region so screen
 * readers announce rule satisfaction as the user types. Each rule renders
 * with a check/x icon and color-coded text.
 */
export function PasswordStrengthChecklist({
  password,
  alwaysVisible = false,
  id,
}: Props) {
  if (!alwaysVisible && password.length === 0) return null;

  return (
    <ul
      id={id}
      role="status"
      aria-live="polite"
      aria-label="Yêu cầu mật khẩu"
      className="mt-2 space-y-1"
    >
      {PASSWORD_RULES.map((rule) => {
        const passed = rule.test(password);
        return (
          <li
            key={rule.label}
            className="flex items-center gap-1.5 text-xs"
            data-testid={`pw-rule-${passed ? 'passed' : 'pending'}`}
          >
            {passed ? (
              <Check className="w-3.5 h-3.5 text-green-500 flex-shrink-0" aria-hidden="true" />
            ) : (
              <X className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" aria-hidden="true" />
            )}
            <span className={passed ? 'text-green-700' : 'text-slate-500'}>
              {rule.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
