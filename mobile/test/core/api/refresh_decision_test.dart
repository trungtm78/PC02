import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pc02_mobile/core/api/refresh_decision.dart';

DioException _401({dynamic body}) => DioException(
      requestOptions: RequestOptions(path: '/cases'),
      response: Response(
        statusCode: 401,
        data: body,
        requestOptions: RequestOptions(path: '/cases'),
      ),
      type: DioExceptionType.badResponse,
    );

void main() {
  group('shouldAttemptTokenRefresh', () {
    test('returns false when backend signals INVALID_TOKEN_VERSION (admin reset path)', () {
      // Backend bumps tokenVersion on admin reset → existing access token's
      // tokenVersion claim no longer matches user.tokenVersion → 401 with
      // a specific code. Trying to refresh would also fail because the
      // refresh token shares the same tokenVersion. Skip refresh, clear
      // tokens, force re-login.
      final err = _401(body: {'code': 'INVALID_TOKEN_VERSION', 'message': 'token superseded'});
      expect(shouldAttemptTokenRefresh(err), isFalse);
    });

    test('returns true for plain expired access-token 401 (refresh likely to succeed)', () {
      final err = _401(body: {'message': 'jwt expired'});
      expect(shouldAttemptTokenRefresh(err), isTrue);
    });

    test('returns true when body is null (be optimistic — try refresh)', () {
      final err = _401(body: null);
      expect(shouldAttemptTokenRefresh(err), isTrue);
    });

    test('returns true when body is a non-Map (string error)', () {
      final err = _401(body: 'Unauthorized');
      expect(shouldAttemptTokenRefresh(err), isTrue);
    });

    test('returns true when code field is not a string', () {
      final err = _401(body: {'code': 42});
      expect(shouldAttemptTokenRefresh(err), isTrue);
    });
  });
}
