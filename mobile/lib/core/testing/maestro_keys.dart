/// Stable Semantics identifiers used by Maestro E2E flows in `mobile/.maestro/`.
///
/// Why a central constants file: Maestro selectors should NOT match against
/// Vietnamese UI labels because (a) localization changes break flows silently,
/// and (b) ambiguous text like "Đăng nhập" appears multiple times. Identifiers
/// here live forever; Vietnamese copy can evolve freely.
///
/// All screens that take E2E coverage MUST wrap critical interactive elements
/// in `Semantics(identifier: MaestroKeys.xxx, ...)` so Maestro's
/// `tapOn: id: "xxx"` matchers find them deterministically.
///
/// Rule: never reuse an identifier on two widgets at the same time. If a
/// dialog/sheet overlays the screen, give it its own namespace.
abstract final class MaestroKeys {
  // ── Login screen ───────────────────────────────────────────────
  static const loginEmailField = 'login-email-field';
  static const loginPasswordField = 'login-password-field';
  static const loginSubmitButton = 'login-submit-button';
  static const loginBiometricButton = 'login-biometric-button';
  static const loginErrorText = 'login-error-text';

  // ── 2FA screen ─────────────────────────────────────────────────
  static const twoFaOtpField = '2fa-otp-field';
  static const twoFaSubmitButton = '2fa-submit-button';
  static const twoFaErrorText = '2fa-error-text';

  // ── First-login change password screen ─────────────────────────
  static const firstLoginNewPasswordField = 'first-login-new-password-field';
  static const firstLoginConfirmPasswordField =
      'first-login-confirm-password-field';
  static const firstLoginSubmitButton = 'first-login-submit-button';
  static const firstLoginErrorText = 'first-login-error-text';
  static const firstLoginMismatchText = 'first-login-mismatch-text';
  static const firstLoginInstructionBanner = 'first-login-instruction-banner';
  // Per-rule identifiers so flows can assert specific rules pass/fail.
  static const firstLoginRuleLength = 'first-login-rule-length';
  static const firstLoginRuleUpper = 'first-login-rule-upper';
  static const firstLoginRuleDigit = 'first-login-rule-digit';
  static const firstLoginRuleSpecial = 'first-login-rule-special';

  // ── Shell (post-auth) ──────────────────────────────────────────
  static const dashboardScaffold = 'dashboard-scaffold';
}
