import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/auth_api.dart';
import '../api/providers.dart';
import '../constants/app_constants.dart';
import '../fcm/fcm_service.dart';
import '../logging/log.dart';
import 'biometric_service.dart';
import 'token_storage.dart';

class AuthState {
  final bool isAuthenticated;
  final bool isLoading;
  final Map<String, String?>? user;
  final String? pendingTwoFaToken;
  final String? pendingChangePasswordToken;

  const AuthState({
    this.isAuthenticated = false,
    this.isLoading = false,
    this.user,
    this.pendingTwoFaToken,
    this.pendingChangePasswordToken,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? isLoading,
    Map<String, String?>? user,
    String? pendingTwoFaToken,
    String? pendingChangePasswordToken,
    bool clearPending = false,
  }) =>
      AuthState(
        isAuthenticated: isAuthenticated ?? this.isAuthenticated,
        isLoading: isLoading ?? this.isLoading,
        user: user ?? this.user,
        pendingTwoFaToken:
            clearPending ? null : pendingTwoFaToken ?? this.pendingTwoFaToken,
        pendingChangePasswordToken: clearPending
            ? null
            : pendingChangePasswordToken ?? this.pendingChangePasswordToken,
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthApi _authApi;
  final TokenStorage _tokenStorage;
  final BiometricService _biometricService;

  // BUG-1: every login path (normal, post-2FA, post-forced-change) must run
  // the same side effects (FCM register, deep-link wiring). _finalize() is
  // the single funnel; this callback is invoked exactly once per finalize.
  final Future<void> Function()? _onLoginFinalized;

  // BUG-3: auth used to call _devicesApi.unregister directly, coupling auth
  // to push registration. This callback hands cleanup back to the caller
  // (typically FcmService.cleanup()) so AuthNotifier knows nothing about
  // push, devices, or FCM tokens.
  final Future<void> Function()? _onLogout;

  AuthNotifier({
    required AuthApi authApi,
    required TokenStorage tokenStorage,
    BiometricService? biometricService,
    Future<void> Function()? onLoginFinalized,
    Future<void> Function()? onLogout,
  })  : _authApi = authApi,
        _tokenStorage = tokenStorage,
        _biometricService = biometricService ?? BiometricService(),
        _onLoginFinalized = onLoginFinalized,
        _onLogout = onLogout,
        super(const AuthState());

  Future<void> init() async {
    final token = await _tokenStorage.getAccessToken();
    if (token != null) {
      final user = await _tokenStorage.getUser();
      state = AuthState(isAuthenticated: true, user: user);
    }
  }

  Future<String> login(String email, String password) async {
    state = state.copyWith(isLoading: true);
    try {
      final data = await _authApi.login(email, password);
      if (data['pending'] == true) {
        if (data['reason'] == 'MUST_CHANGE_PASSWORD') {
          state = state.copyWith(
            isLoading: false,
            pendingChangePasswordToken: data['changePasswordToken'] as String?,
          );
          return AppAuthResult.pendingChangePassword;
        }
        state = state.copyWith(
          isLoading: false,
          pendingTwoFaToken: data['twoFaToken'] as String?,
        );
        return AppAuthResult.pending2fa;
      }
      await _finalize(data);
      return AppAuthResult.success;
    } catch (e, st) {
      // BUG-4: log + rethrow. UI layer maps the error to user-facing copy
      // but the original stack trace would otherwise be invisible to devs.
      logError('auth.login', e, st);
      state = state.copyWith(isLoading: false);
      rethrow;
    }
  }

  Future<String> firstLoginChangePassword(String newPassword) async {
    state = state.copyWith(isLoading: true);
    final token = state.pendingChangePasswordToken!;
    try {
      final data = await _authApi.firstLoginChangePassword(token, newPassword);
      state = state.copyWith(clearPending: true);
      await _finalize(data);
      return AppAuthResult.success;
    } catch (e, st) {
      // BUG-4: log + clear pendingChangePasswordToken on ANY error so 401
      // (expired) and 409 (admin superseded) both route the user back to
      // login cleanly. Rethrow so the UI layer can show its toast.
      logError('auth.firstLoginChangePassword', e, st);
      state = AuthState(isAuthenticated: false, isLoading: false);
      rethrow;
    }
  }

  Future<String> verify2fa(String code) async {
    state = state.copyWith(isLoading: true);
    try {
      final token = state.pendingTwoFaToken!;
      final data = await _authApi.verify2fa(token, code);
      if (data['pending'] == true && data['reason'] == 'MUST_CHANGE_PASSWORD') {
        state = state.copyWith(
          isLoading: false,
          pendingChangePasswordToken: data['changePasswordToken'] as String?,
        );
        return AppAuthResult.pendingChangePassword;
      }
      await _finalize(data);
      return AppAuthResult.success;
    } catch (e, st) {
      // BUG-4: log + rethrow.
      logError('auth.verify2fa', e, st);
      state = state.copyWith(isLoading: false);
      rethrow;
    }
  }

  Future<void> _finalize(Map<String, dynamic> data) async {
    await _tokenStorage.saveTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
    );
    final user = data['user'] as Map<String, dynamic>?;
    if (user != null) await _tokenStorage.saveUser(user);
    final savedUser = await _tokenStorage.getUser();
    state = AuthState(isAuthenticated: true, user: savedUser);
    // BUG-1: hook fires on every successful finalize (normal / 2FA / forced
    // change). Failures here MUST NOT block login — log + continue. If FCM
    // register fails the next push round-trip retries via onTokenRefresh.
    if (_onLoginFinalized != null) {
      try {
        await _onLoginFinalized();
      } catch (e, st) {
        logError('auth.onLoginFinalized', e, st);
      }
    }
  }

  Future<void> logout() async {
    // BUG-3: hand cleanup back to the caller (FcmService.cleanup). Failures
    // here MUST NOT block logout — the user clicked logout, they expect to
    // be logged out even if a remote device-unregister fails.
    if (_onLogout != null) {
      try {
        await _onLogout();
      } catch (e, st) {
        logError('auth.onLogout', e, st);
      }
    }
    try {
      await _authApi.logout();
    } catch (e, st) {
      logError('auth.logout.remote', e, st);
    }
    await Future.wait([
      _tokenStorage.clear(),
      _biometricService.clear(),
    ]);
    state = const AuthState();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  // FcmService is read lazily inside the callbacks so AuthNotifier can be
  // constructed during app startup before Firebase has finished initializing.
  final fcm = ref.read(fcmServiceProvider);
  return AuthNotifier(
    authApi: ref.read(authApiProvider),
    tokenStorage: ref.read(tokenStorageProvider),
    onLoginFinalized: fcm.init,
    onLogout: fcm.cleanup,
  );
});
