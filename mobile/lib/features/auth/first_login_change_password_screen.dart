import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_provider.dart';
import '../../core/auth/password_strength.dart';
import '../../core/logging/log.dart';
import '../../core/testing/maestro_keys.dart';
import '../../shared/theme/app_theme.dart';

/// Forced first-login password change screen. Reached when login() or
/// verify2fa() returns `pending_change_password`. The user must change the
/// admin-issued temp password before any further use.
///
/// On 401 (token expired) or 409 (admin reset again) the provider clears
/// pendingChangePasswordToken and rethrows — UI navigates back to login.
class FirstLoginChangePasswordScreen extends ConsumerStatefulWidget {
  const FirstLoginChangePasswordScreen({super.key});

  @override
  ConsumerState<FirstLoginChangePasswordScreen> createState() =>
      _FirstLoginChangePasswordScreenState();
}

class _FirstLoginChangePasswordScreenState
    extends ConsumerState<FirstLoginChangePasswordScreen> {
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  String? _error;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _newCtrl.addListener(() => setState(() {}));
    _confirmCtrl.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Guard: if user lands here without a pending token (deep-link / hot
      // reload), bounce to login.
      final token = ref.read(authProvider).pendingChangePasswordToken;
      if (token == null && mounted) {
        context.go('/login');
      }
    });
  }

  @override
  void dispose() {
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  bool get _canSubmit {
    final pw = _newCtrl.text;
    final confirm = _confirmCtrl.text;
    return !_submitting &&
        isStrongPassword(pw) &&
        confirm.isNotEmpty &&
        pw == confirm;
  }

  String? get _mismatchError {
    final pw = _newCtrl.text;
    final confirm = _confirmCtrl.text;
    if (confirm.isEmpty) return null;
    if (pw != confirm) return 'Hai mật khẩu chưa trùng nhau';
    return null;
  }

  Future<void> _submit() async {
    if (!_canSubmit) return;
    setState(() {
      _error = null;
      _submitting = true;
    });
    try {
      await ref
          .read(authProvider.notifier)
          .firstLoginChangePassword(_newCtrl.text);
      if (!mounted) return;
      // BUG-1: FCM init handled by AuthNotifier callback now.
      if (mounted) context.go('/');
    } on DioException catch (e) {
      if (!mounted) return;
      final status = e.response?.statusCode;
      if (status == 401) {
        _showToastAndGoLogin('Mật khẩu tạm đã hết hạn. Vui lòng đăng nhập lại.');
      } else if (status == 409) {
        _showToastAndGoLogin(
            'Quản trị đã reset lại mật khẩu. Đăng nhập với mật khẩu mới nhất.');
      } else {
        final msg = e.response?.data is Map
            ? (e.response?.data as Map)['message'] as String?
            : null;
        setState(() {
          _error = msg ?? 'Đổi mật khẩu thất bại. Vui lòng thử lại.';
          _submitting = false;
        });
      }
    } catch (e, st) {
      // BUG-4: non-DioException path (likely a Dart-level network/timeout).
      logError('firstLoginChangePassword.network', e, st);
      if (!mounted) return;
      setState(() {
        _error = 'Lỗi mạng. Vui lòng kiểm tra kết nối.';
        _submitting = false;
      });
    }
  }

  void _showToastAndGoLogin(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), duration: const Duration(seconds: 4)),
    );
    context.go('/login');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Đổi mật khẩu lần đầu'),
        automaticallyImplyLeading: false,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Semantics(
                identifier: MaestroKeys.firstLoginInstructionBanner,
                container: true,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.yellow.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                        color: AppColors.yellow.withValues(alpha: 0.4)),
                  ),
                  child: const Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.key, color: AppColors.yellow, size: 20),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Anh/chị phải đổi mật khẩu trước khi sử dụng hệ thống. '
                          'Mật khẩu mới phải khác mật khẩu tạm và đáp ứng quy tắc bên dưới.',
                          style: TextStyle(fontSize: 13, height: 1.4),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Semantics(
                identifier: MaestroKeys.firstLoginNewPasswordField,
                textField: true,
                obscured: _obscureNew,
                child: TextField(
                  controller: _newCtrl,
                  obscureText: _obscureNew,
                  autofocus: true,
                  decoration: InputDecoration(
                    labelText: 'Mật khẩu mới',
                    prefixIcon: const Icon(Icons.lock_outline),
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: Icon(_obscureNew
                          ? Icons.visibility
                          : Icons.visibility_off),
                      onPressed: () =>
                          setState(() => _obscureNew = !_obscureNew),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              _StrengthChecklist(password: _newCtrl.text),
              const SizedBox(height: 16),
              Semantics(
                identifier: MaestroKeys.firstLoginConfirmPasswordField,
                textField: true,
                obscured: _obscureConfirm,
                child: TextField(
                  controller: _confirmCtrl,
                  obscureText: _obscureConfirm,
                  decoration: InputDecoration(
                    labelText: 'Xác nhận mật khẩu',
                    prefixIcon: const Icon(Icons.lock_outline),
                    border: const OutlineInputBorder(),
                    errorText: _mismatchError,
                    suffixIcon: IconButton(
                      icon: Icon(_obscureConfirm
                          ? Icons.visibility
                          : Icons.visibility_off),
                      onPressed: () => setState(
                          () => _obscureConfirm = !_obscureConfirm),
                    ),
                  ),
                  onSubmitted: (_) => _submit(),
                ),
              ),
              if (_mismatchError != null)
                Semantics(
                  identifier: MaestroKeys.firstLoginMismatchText,
                  liveRegion: true,
                  child: const SizedBox.shrink(),
                ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Semantics(
                  identifier: MaestroKeys.firstLoginErrorText,
                  liveRegion: true,
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.red.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                          color: AppColors.red.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.error_outline,
                            color: AppColors.red, size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(_error!,
                              style: const TextStyle(
                                  color: AppColors.red, fontSize: 13)),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 24),
              SizedBox(
                height: 48,
                child: Semantics(
                  identifier: MaestroKeys.firstLoginSubmitButton,
                  button: true,
                  enabled: _canSubmit,
                  child: ElevatedButton(
                    onPressed: _canSubmit ? _submit : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.navy,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: Colors.grey[300],
                    ),
                    child: _submitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Đổi mật khẩu',
                            style: TextStyle(fontSize: 16)),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StrengthChecklist extends StatelessWidget {
  final String password;
  const _StrengthChecklist({required this.password});

  // Order MUST match passwordRules order in lib/core/auth/password_strength.dart.
  // Maestro flows assert by per-rule identifier so re-ordering rules without
  // updating these keys would silently break flows.
  static const _ruleKeys = <String>[
    MaestroKeys.firstLoginRuleLength,
    MaestroKeys.firstLoginRuleUpper,
    MaestroKeys.firstLoginRuleDigit,
    MaestroKeys.firstLoginRuleSpecial,
  ];

  @override
  Widget build(BuildContext context) {
    assert(_ruleKeys.length == passwordRules.length,
        '_ruleKeys must stay in lockstep with passwordRules');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < passwordRules.length; i++)
          Semantics(
            identifier: _ruleKeys[i],
            // value: 'passed' / 'pending' lets Maestro assert per-rule state.
            value: passwordRules[i].test(password) ? 'passed' : 'pending',
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(
                children: [
                  Icon(
                    passwordRules[i].test(password)
                        ? Icons.check_circle
                        : Icons.radio_button_unchecked,
                    size: 16,
                    color: passwordRules[i].test(password)
                        ? AppColors.green
                        : Colors.grey[400],
                  ),
                  const SizedBox(width: 8),
                  Text(
                    passwordRules[i].label,
                    style: TextStyle(
                      fontSize: 12,
                      color: passwordRules[i].test(password)
                          ? AppColors.green
                          : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
