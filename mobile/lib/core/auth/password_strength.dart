class PasswordRule {
  final String label;
  final bool Function(String) test;
  const PasswordRule(this.label, this.test);
}

final List<PasswordRule> passwordRules = [
  PasswordRule('Tối thiểu 8 ký tự', (v) => v.length >= 8),
  PasswordRule('Có chữ hoa (A-Z)', (v) => RegExp(r'[A-Z]').hasMatch(v)),
  PasswordRule('Có chữ số (0-9)', (v) => RegExp(r'[0-9]').hasMatch(v)),
  PasswordRule(
      'Có ký tự đặc biệt (!@#\$%^&*)', (v) => RegExp(r'[!@#$%^&*]').hasMatch(v)),
];

bool isStrongPassword(String password) =>
    passwordRules.every((r) => r.test(password));
