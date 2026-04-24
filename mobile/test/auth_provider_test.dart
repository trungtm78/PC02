import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:pc02_mobile/core/api/auth_api.dart';
import 'package:pc02_mobile/core/api/devices_api.dart';
import 'package:pc02_mobile/core/auth/auth_provider.dart';
import 'package:pc02_mobile/core/auth/token_storage.dart';

class MockAuthApi extends Mock implements AuthApi {}

class MockDevicesApi extends Mock implements DevicesApi {}

class MockTokenStorage extends Mock implements TokenStorage {}

void main() {
  late MockAuthApi authApi;
  late MockDevicesApi devicesApi;
  late MockTokenStorage storage;

  setUp(() {
    authApi = MockAuthApi();
    devicesApi = MockDevicesApi();
    storage = MockTokenStorage();
  });

  AuthNotifier makeNotifier() =>
      AuthNotifier(authApi, devicesApi, storage);

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

    test('logout() clears tokens and deregisters FCM', () async {
      when(() => devicesApi.unregister(any())).thenAnswer((_) async {});
      when(() => authApi.logout()).thenAnswer((_) async {});
      when(() => storage.clear()).thenAnswer((_) async {});

      final notifier = makeNotifier();
      await notifier.logout(fcmToken: 'tok');

      verify(() => devicesApi.unregister('tok')).called(1);
      verify(() => storage.clear()).called(1);
      expect(notifier.state.isAuthenticated, false);
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
