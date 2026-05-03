import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../api/api_client.dart';
import '../api/auth_api.dart';
import '../api/devices_api.dart';
import '../constants/app_constants.dart';
import 'biometric_service.dart';
import 'token_storage.dart';

final _storageProvider = Provider((_) => const FlutterSecureStorage());

final apiClientProvider = Provider((ref) {
  final storage = ref.read(_storageProvider);
  return ApiClient(storage);
});

final tokenStorageProvider = Provider((ref) {
  final storage = ref.read(_storageProvider);
  return TokenStorage(storage);
});

final authApiProvider = Provider((ref) => AuthApi(ref.read(apiClientProvider)));
final devicesApiProvider =
    Provider((ref) => DevicesApi(ref.read(apiClientProvider)));

class AuthState {
  final bool isAuthenticated;
  final bool isLoading;
  final Map<String, String?>? user;
  final String? pendingTwoFaToken;

  const AuthState({
    this.isAuthenticated = false,
    this.isLoading = false,
    this.user,
    this.pendingTwoFaToken,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? isLoading,
    Map<String, String?>? user,
    String? pendingTwoFaToken,
    bool clearPending = false,
  }) =>
      AuthState(
        isAuthenticated: isAuthenticated ?? this.isAuthenticated,
        isLoading: isLoading ?? this.isLoading,
        user: user ?? this.user,
        pendingTwoFaToken:
            clearPending ? null : pendingTwoFaToken ?? this.pendingTwoFaToken,
      );
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthApi _authApi;
  final DevicesApi _devicesApi;
  final TokenStorage _tokenStorage;
  final BiometricService _biometricService;

  AuthNotifier(this._authApi, this._devicesApi, this._tokenStorage,
      [BiometricService? biometricService])
      : _biometricService = biometricService ?? BiometricService(),
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
        state = state.copyWith(
          isLoading: false,
          pendingTwoFaToken: data['twoFaToken'] as String?,
        );
        return AppAuthResult.pending2fa;
      }
      await _finalize(data);
      return AppAuthResult.success;
    } catch (_) {
      state = state.copyWith(isLoading: false);
      rethrow;
    }
  }

  Future<void> verify2fa(String code) async {
    state = state.copyWith(isLoading: true);
    try {
      final token = state.pendingTwoFaToken!;
      final data = await _authApi.verify2fa(token, code);
      await _finalize(data);
    } catch (_) {
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
  }

  Future<void> logout({String? fcmToken}) async {
    if (fcmToken != null) {
      try {
        await _devicesApi.unregister(fcmToken);
      } catch (_) {}
    }
    await _authApi.logout();
    await Future.wait([
      _tokenStorage.clear(),
      _biometricService.clear(),
    ]);
    state = const AuthState();
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(
    ref.read(authApiProvider),
    ref.read(devicesApiProvider),
    ref.read(tokenStorageProvider),
  );
});
