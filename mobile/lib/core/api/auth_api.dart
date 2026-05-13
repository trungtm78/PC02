import 'dart:convert';
import 'package:dio/dio.dart';
import 'api_client.dart';

class AuthApi {
  final ApiClient _client;
  AuthApi(this._client);

  Future<Map<String, dynamic>> login(String username, String password) async {
    final resp = await _client.dio.post(
      '/auth/login',
      data: jsonEncode({'username': username, 'password': password}),
      options: Options(contentType: 'application/json'),
    );
    return resp.data as Map<String, dynamic>;
  }

  // POST /auth/2fa/verify — requires { code, method } + Bearer twoFaToken
  Future<Map<String, dynamic>> verify2fa(
    String twoFaToken,
    String code, {
    String method = 'totp',
  }) async {
    final resp = await _client.dio.post(
      '/auth/2fa/verify',
      data: {'code': code, 'method': method},
      options: Options(headers: {'Authorization': 'Bearer $twoFaToken'}),
    );
    return resp.data as Map<String, dynamic>;
  }

  // POST /auth/first-login-change-password — requires { newPassword } + Bearer changePasswordToken
  Future<Map<String, dynamic>> firstLoginChangePassword(
    String changePasswordToken,
    String newPassword,
  ) async {
    final resp = await _client.dio.post(
      '/auth/first-login-change-password',
      data: {'newPassword': newPassword},
      options: Options(headers: {'Authorization': 'Bearer $changePasswordToken'}),
    );
    return resp.data as Map<String, dynamic>;
  }

  Future<void> logout() async {
    // BUG-4 + BUG-3: remote logout is best-effort. AuthNotifier.logout()
    // already wraps this with logError, so a bare try/catch here would be
    // redundant. We use Future.value() over `await ... catch` so the local
    // log call site stays the single source of truth.
    await _client.dio.post('/auth/logout');
  }
}
