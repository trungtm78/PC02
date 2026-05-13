import 'package:dio/dio.dart';

/// Signal that v0.21 backend uses when a user's token version was bumped
/// (admin reset password, force-logout, etc.). When this code appears, the
/// refresh token is ALSO stale — refreshing would just produce another 401.
/// The right action is: clear tokens, navigate to /login.
const invalidTokenVersionCode = 'INVALID_TOKEN_VERSION';

/// Decide whether the refresh interceptor should attempt a token refresh in
/// response to a 401, or skip refresh and force a clean re-login.
///
/// Pure function — no side effects, no IO. Easy to test the matrix of body
/// shapes the backend (or a misconfigured gateway) might return.
bool shouldAttemptTokenRefresh(DioException err) {
  if (err.response?.statusCode != 401) return false;
  final body = err.response?.data;
  if (body is! Map) return true;
  final code = body['code'];
  if (code is! String) return true;
  return code != invalidTokenVersionCode;
}
