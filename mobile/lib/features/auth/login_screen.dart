import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/auth/auth_provider.dart';
import '../../core/auth/biometric_service.dart';
import '../../core/constants/app_constants.dart';
import '../../core/fcm/fcm_service.dart';
import '../../core/testing/maestro_keys.dart';
import '../../shared/theme/app_theme.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  String? _error;
  bool _obscure = true;
  bool _showBioButton = false;

  @override
  void initState() {
    super.initState();
    _checkBiometric();
  }

  Future<void> _checkBiometric() async {
    final svc = ref.read(biometricServiceProvider);
    final available = await svc.isAvailable();
    final enabled = await svc.isEnabled();
    if (available && enabled && mounted) {
      setState(() => _showBioButton = true);
    }
  }

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _error = null);

    final email = _emailCtrl.text.trim();
    final password = _passCtrl.text;

    try {
      final result = await ref.read(authProvider.notifier).login(email, password);

      if (!mounted) return;
      if (result == AppAuthResult.pending2fa) {
        context.push('/login/2fa');
      } else if (result == AppAuthResult.pendingChangePassword) {
        context.go('/auth/first-login-change-password');
      } else {
        try {
          final fcm = ref.read(fcmServiceProvider);
          await fcm.init();
        } catch (_) {}
        if (mounted) {
          await _offerBiometric(email, password);
          if (mounted) context.go('/');
        }
      }
    } catch (e) {
      setState(() => _error = 'Email hoặc mật khẩu không đúng');
    }
  }

  Future<void> _offerBiometric(String email, String password) async {
    final svc = ref.read(biometricServiceProvider);
    if (!await svc.isAvailable()) return;
    if (await svc.isEnabled()) return;

    if (!mounted) return;
    final enable = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Bật đăng nhập sinh trắc học?'),
        content: const Text(
            'Lần sau bạn có thể đăng nhập bằng vân tay hoặc khuôn mặt thay vì nhập mật khẩu.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Để sau'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.navy),
            child: const Text('Bật', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (enable == true) {
      await svc.saveCredentials(email, password);
    }
  }

  Future<void> _loginWithBiometric() async {
    final svc = ref.read(biometricServiceProvider);
    try {
      final ok = await svc.authenticate();
      if (!ok || !mounted) return;

      final creds = await svc.getCredentials();
      if (creds == null) {
        if (mounted) setState(() => _error = 'Không tìm thấy thông tin đăng nhập');
        return;
      }

      setState(() => _error = null);
      final result = await ref.read(authProvider.notifier).login(creds.email, creds.password);
      if (!mounted) return;
      if (result == AppAuthResult.pending2fa) {
        context.push('/login/2fa');
      } else if (result == AppAuthResult.pendingChangePassword) {
        context.go('/auth/first-login-change-password');
      } else {
        try {
          await ref.read(fcmServiceProvider).init();
        } catch (_) {}
        if (mounted) context.go('/');
      }
    } catch (_) {
      if (mounted) setState(() => _error = 'Xác thực sinh trắc học thất bại');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLoading = ref.watch(authProvider).isLoading;

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(32),
            child: Form(
              key: _formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Image.asset(
                    'assets/images/logo-cong-an.png',
                    width: 96,
                    height: 96,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'PC02 Quản lý',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: AppColors.navy,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Phòng Cảnh sát hình sự',
                    style: TextStyle(color: Colors.grey[600], fontSize: 13),
                  ),
                  const SizedBox(height: 40),
                  Semantics(
                    identifier: MaestroKeys.loginEmailField,
                    textField: true,
                    child: TextFormField(
                      controller: _emailCtrl,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        prefixIcon: Icon(Icons.email_outlined),
                        border: OutlineInputBorder(),
                      ),
                      validator: (v) =>
                          v == null || v.isEmpty ? 'Nhập email' : null,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Semantics(
                    identifier: MaestroKeys.loginPasswordField,
                    textField: true,
                    obscured: _obscure,
                    child: TextFormField(
                      controller: _passCtrl,
                      obscureText: _obscure,
                      decoration: InputDecoration(
                        labelText: 'Mật khẩu',
                        prefixIcon: const Icon(Icons.lock_outline),
                        border: const OutlineInputBorder(),
                        suffixIcon: IconButton(
                          icon: Icon(_obscure
                              ? Icons.visibility
                              : Icons.visibility_off),
                          onPressed: () =>
                              setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (v) =>
                          v == null || v.isEmpty ? 'Nhập mật khẩu' : null,
                      onFieldSubmitted: (_) => _submit(),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Semantics(
                      identifier: MaestroKeys.loginErrorText,
                      liveRegion: true,
                      child: Text(
                        _error!,
                        style:
                            const TextStyle(color: Colors.red, fontSize: 13),
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: Semantics(
                      identifier: MaestroKeys.loginSubmitButton,
                      button: true,
                      child: ElevatedButton(
                        onPressed: isLoading ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.navy,
                          foregroundColor: Colors.white,
                        ),
                        child: isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Đăng nhập',
                                style: TextStyle(fontSize: 16)),
                      ),
                    ),
                  ),
                  if (_showBioButton) ...[
                    const SizedBox(height: 16),
                    Semantics(
                      identifier: MaestroKeys.loginBiometricButton,
                      button: true,
                      child: OutlinedButton.icon(
                        onPressed: isLoading ? null : _loginWithBiometric,
                        icon: const Icon(Icons.fingerprint, size: 22),
                        label: const Text('Đăng nhập bằng sinh trắc học'),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(double.infinity, 48),
                          foregroundColor: AppColors.navy,
                          side: const BorderSide(color: AppColors.navy),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
