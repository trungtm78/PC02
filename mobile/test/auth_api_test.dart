import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:pc02_mobile/core/api/api_client.dart';
import 'package:pc02_mobile/core/api/auth_api.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockDio extends Mock implements Dio {}

void main() {
  late MockApiClient mockClient;
  late MockDio mockDio;
  late AuthApi api;

  setUpAll(() {
    registerFallbackValue(Options());
  });

  setUp(() {
    mockClient = MockApiClient();
    mockDio = MockDio();
    when(() => mockClient.dio).thenReturn(mockDio);
    api = AuthApi(mockClient);
  });

  group('AuthApi.firstLoginChangePassword()', () {
    test('POSTs to /auth/first-login-change-password with Bearer changePasswordToken', () async {
      when(() => mockDio.post(
            any(),
            data: any(named: 'data'),
            options: any(named: 'options'),
          )).thenAnswer((_) async => Response(
            data: {'accessToken': 'new-at', 'refreshToken': 'new-rt'},
            statusCode: 200,
            requestOptions: RequestOptions(path: '/auth/first-login-change-password'),
          ));

      final result = await api.firstLoginChangePassword('change-token', 'NewStrongPw1!');

      expect(result['accessToken'], 'new-at');
      expect(result['refreshToken'], 'new-rt');

      final captured = verify(() => mockDio.post(
            captureAny(),
            data: captureAny(named: 'data'),
            options: captureAny(named: 'options'),
          )).captured;
      expect(captured[0], '/auth/first-login-change-password');
      expect(captured[1], {'newPassword': 'NewStrongPw1!'});
      final options = captured[2] as Options;
      expect(options.headers?['Authorization'], 'Bearer change-token');
    });
  });
}
