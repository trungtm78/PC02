import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:pc02_mobile/core/api/auth_api.dart';
import 'package:pc02_mobile/core/auth/auth_provider.dart';
import 'package:pc02_mobile/core/auth/biometric_service.dart';
import 'package:pc02_mobile/core/auth/token_storage.dart';

class MockAuthApi extends Mock implements AuthApi {}

class MockTokenStorage extends Mock implements TokenStorage {}

class MockBiometricService extends Mock implements BiometricService {}

void main() {
  late MockAuthApi authApi;
  late MockTokenStorage storage;
  late MockBiometricService biometricService;
  late int onLoginFinalizedCallCount;
  late int onLogoutCallCount;

  setUp(() {
    authApi = MockAuthApi();
    storage = MockTokenStorage();
    biometricService = MockBiometricService();
    onLoginFinalizedCallCount = 0;
    onLogoutCallCount = 0;
    when(() => biometricService.clear()).thenAnswer((_) async {});
  });

  AuthNotifier makeNotifier() => AuthNotifier(
        authApi: authApi,
        tokenStorage: storage,
        biometricService: biometricService,
        onLoginFinalized: () async => onLoginFinalizedCallCount++,
        onLogout: () async => onLogoutCallCount++,
      );

  group('AuthNotifier', () {
    test('login() stores tokens on success', () async {
      when(() => authApi.login(any(), any())).thenAnswer((_) async => {
            'accessToken': 'at',
            'refreshToken': 'rt',
            'user': {'id': 'u1', 'fullName': 'Test', 'email': 'a@b.c', 'role': 'ADMIN'},
          });
      when(() => storage.saveTokens(
            accessToken: any(named: 'accessToken'),
            refreshToken: any(named: 'refreshToken'),
          )).thenAnswer((_) async {});
      when(() => storage.saveUser(any())).thenAnswer((_) async {});
      when(() => storage.getUser()).thenAnswer((_) async =>
          {'id': 'u1', 'fullName': 'Test', 'email': 'a@b.c', 'role': 'ADMIN'});

      final notifier = makeNotifier();
      final result = await notifier.login('a@b.c', 'pass');

      expect(result, 'success');
      expect(notifier.state.isAuthenticated, true);
    });

    test('login() returns pending_2fa when 2FA required', () async {
      when(() => authApi.login(any(), any())).thenAnswer((_) async => {
            'pending': true,
            'twoFaToken': 'temp-token',
          });

      final notifier = makeNotifier();
      final result = await notifier.login('a@b.c', 'pass');

      expect(result, 'pending_2fa');
      expect(notifier.state.pendingTwoFaToken, 'temp-token');
      expect(notifier.state.isAuthenticated, false);
    });

    test('login() returns pending_change_password when reason is MUST_CHANGE_PASSWORD', () async {
      when(() => authApi.login(any(), any())).thenAnswer((_) async => {
            'pending': true,
            'changePasswordToken': 'change-pw-token',
            'reason': 'MUST_CHANGE_PASSWORD',
          });

      final notifier = makeNotifier();
      final result = await notifier.login('a@b.c', 'temp-pass');

      expect(result, 'pending_change_password');
      expect(notifier.state.pendingChangePasswordToken, 'change-pw-token');
      expect(notifier.state.pendingTwoFaToken, isNull);
      expect(notifier.state.isAuthenticated, false);
    });

    test('firstLoginChangePassword() success: stores tokens, clears pending state, returns success', () async {
      when(() => authApi.login(any(), any())).thenAnswer((_) async => {
            'pending': true,
            'changePasswordToken': 'change-tok',
            'reason': 'MUST_CHANGE_PASSWORD',
          });
      when(() => authApi.firstLoginChangePassword(any(), any())).thenAnswer((_) async => {
            'accessToken': 'at',
            'refreshToken': 'rt',
            'user': {'id': 'u1', 'fullName': 'Test', 'email': 'a@b.c', 'role': 'ADMIN'},
          });
      when(() => storage.saveTokens(
            accessToken: any(named: 'accessToken'),
            refreshToken: any(named: 'refreshToken'),
          )).thenAnswer((_) async {});
      when(() => storage.saveUser(any())).thenAnswer((_) async {});
      when(() => storage.getUser()).thenAnswer((_) async =>
          {'id': 'u1', 'fullName': 'Test', 'email': 'a@b.c', 'role': 'ADMIN'});

      final notifier = makeNotifier();
      await notifier.login('a@b.c', 'temp');
      final result = await notifier.firstLoginChangePassword('NewStrongPw1!');

      expect(result, 'success');
      expect(notifier.state.isAuthenticated, true);
      expect(notifier.state.pendingChangePasswordToken, isNull);
    });

    test('firstLoginChangePassword() on 401 clears pendingChangePasswordToken and rethrows', () async {
      when(() => authApi.login(any(), any())).thenAnswer((_) async => {
            'pending': true,
            'changePasswordToken': 'expired-tok',
            'reason': 'MUST_CHANGE_PASSWORD',
          });
      when(() => authApi.firstLoginChangePassword(any(), any())).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/first-login-change-password'),
          response: Response(
            statusCode: 401,
            requestOptions: RequestOptions(path: '/auth/first-login-change-password'),
          ),
          type: DioExceptionType.badResponse,
        ),
      );

      final notifier = makeNotifier();
      await notifier.login('a@b.c', 'temp');
      expect(notifier.state.pendingChangePasswordToken, 'expired-tok');

      await expectLater(
        notifier.firstLoginChangePassword('NewStrongPw1!'),
        throwsA(isA<DioException>()),
      );
      expect(notifier.state.pendingChangePasswordToken, isNull);
      expect(notifier.state.isAuthenticated, false);
    });

    test('firstLoginChangePassword() on 409 clears pendingChangePasswordToken and rethrows', () async {
      when(() => authApi.login(any(), any())).thenAnswer((_) async => {
            'pending': true,
            'changePasswordToken': 'superseded-tok',
            'reason': 'MUST_CHANGE_PASSWORD',
          });
      when(() => authApi.firstLoginChangePassword(any(), any())).thenThrow(
        DioException(
          requestOptions: RequestOptions(path: '/auth/first-login-change-password'),
          response: Response(
            statusCode: 409,
            requestOptions: RequestOptions(path: '/auth/first-login-change-password'),
          ),
          type: DioExceptionType.badResponse,
        ),
      );

      final notifier = makeNotifier();
      await notifier.login('a@b.c', 'temp');
      expect(notifier.state.pendingChangePasswordToken, 'superseded-tok');

      await expectLater(
        notifier.firstLoginChangePassword('NewStrongPw1!'),
        throwsA(isA<DioException>()),
      );
      expect(notifier.state.pendingChangePasswordToken, isNull);
      expect(notifier.state.isAuthenticated, false);
    });

    test('verify2fa() returns pending_change_password when post-OTP reason is MUST_CHANGE_PASSWORD', () async {
      // Setup: user already in 2FA pending state
      when(() => authApi.login(any(), any())).thenAnswer((_) async => {
            'pending': true,
            'twoFaToken': 'two-fa-token',
          });
      // Backend returns MUST_CHANGE_PASSWORD after OTP instead of accessToken
      when(() => authApi.verify2fa(any(), any())).thenAnswer((_) async => {
            'pending': true,
            'changePasswordToken': 'post-otp-change-token',
            'reason': 'MUST_CHANGE_PASSWORD',
          });

      final notifier = makeNotifier();
      await notifier.login('a@b.c', 'pass');
      final result = await notifier.verify2fa('123456');

      expect(result, 'pending_change_password');
      expect(notifier.state.pendingChangePasswordToken, 'post-otp-change-token');
      expect(notifier.state.isAuthenticated, false);
    });

    test('logout() clears tokens + biometric, fires onLogout callback (BUG-3: no DevicesApi reference)', () async {
      when(() => authApi.logout()).thenAnswer((_) async {});
      when(() => storage.clear()).thenAnswer((_) async {});

      final notifier = makeNotifier();
      await notifier.logout();

      // AuthNotifier no longer takes DevicesApi — onLogout callback is the
      // single decoupled hook for FCM cleanup + device deregister.
      expect(onLogoutCallCount, 1);
      verify(() => storage.clear()).called(1);
      verify(() => biometricService.clear()).called(1);
      expect(notifier.state.isAuthenticated, false);
    });

    test('login() success fires onLoginFinalized callback (BUG-1: FCM init for normal login)', () async {
      when(() => authApi.login(any(), any())).thenAnswer((_) async => {
            'accessToken': 'at',
            'refreshToken': 'rt',
            'user': {'id': 'u1', 'fullName': 'T', 'email': 'a@b.c', 'role': 'ADMIN'},
          });
      when(() => storage.saveTokens(
            accessToken: any(named: 'accessToken'),
            refreshToken: any(named: 'refreshToken'),
          )).thenAnswer((_) async {});
      when(() => storage.saveUser(any())).thenAnswer((_) async {});
      when(() => storage.getUser()).thenAnswer((_) async =>
          {'id': 'u1', 'fullName': 'T', 'email': 'a@b.c', 'role': 'ADMIN'});

      final notifier = makeNotifier();
      await notifier.login('a@b.c', 'p');

      expect(onLoginFinalizedCallCount, 1);
    });

    test('verify2fa() success fires onLoginFinalized callback (BUG-1: FCM init for 2FA login)', () async {
      when(() => authApi.login(any(), any())).thenAnswer((_) async => {
            'pending': true,
            'twoFaToken': 'tok',
          });
      when(() => authApi.verify2fa(any(), any())).thenAnswer((_) async => {
            'accessToken': 'at',
            'refreshToken': 'rt',
            'user': {'id': 'u1', 'fullName': 'T', 'email': 'a@b.c', 'role': 'ADMIN'},
          });
      when(() => storage.saveTokens(
            accessToken: any(named: 'accessToken'),
            refreshToken: any(named: 'refreshToken'),
          )).thenAnswer((_) async {});
      when(() => storage.saveUser(any())).thenAnswer((_) async {});
      when(() => storage.getUser()).thenAnswer((_) async =>
          {'id': 'u1', 'fullName': 'T', 'email': 'a@b.c', 'role': 'ADMIN'});

      final notifier = makeNotifier();
      await notifier.login('a@b.c', 'p');
      await notifier.verify2fa('123456');

      // Login itself returned pending → no finalize. verify2fa finalize → 1 call.
      expect(onLoginFinalizedCallCount, 1);
    });

    test('firstLoginChangePassword() success fires onLoginFinalized callback (BUG-1: FCM init for forced-change path)', () async {
      when(() => authApi.login(any(), any())).thenAnswer((_) async => {
            'pending': true,
            'changePasswordToken': 't',
            'reason': 'MUST_CHANGE_PASSWORD',
          });
      when(() => authApi.firstLoginChangePassword(any(), any())).thenAnswer((_) async => {
            'accessToken': 'at',
            'refreshToken': 'rt',
            'user': {'id': 'u1', 'fullName': 'T', 'email': 'a@b.c', 'role': 'ADMIN'},
          });
      when(() => storage.saveTokens(
            accessToken: any(named: 'accessToken'),
            refreshToken: any(named: 'refreshToken'),
          )).thenAnswer((_) async {});
      when(() => storage.saveUser(any())).thenAnswer((_) async {});
      when(() => storage.getUser()).thenAnswer((_) async =>
          {'id': 'u1', 'fullName': 'T', 'email': 'a@b.c', 'role': 'ADMIN'});

      final notifier = makeNotifier();
      await notifier.login('a@b.c', 'temp');
      await notifier.firstLoginChangePassword('NewStrong1!');

      expect(onLoginFinalizedCallCount, 1);
    });

    test('init() restores auth state from stored token', () async {
      when(() => storage.getAccessToken())
          .thenAnswer((_) async => 'stored-token');
      when(() => storage.getUser()).thenAnswer((_) async =>
          {'id': 'u1', 'fullName': 'Test', 'email': 'a@b.c', 'role': 'ADMIN'});

      final notifier = makeNotifier();
      await notifier.init();

      expect(notifier.state.isAuthenticated, true);
      expect(notifier.state.user?['fullName'], 'Test');
    });
  });
}
