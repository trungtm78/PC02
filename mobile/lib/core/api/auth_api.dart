import 'package:dio/dio.dart';
import 'api_client.dart';

class AuthApi {
  final ApiClient _client;
  AuthApi(this._client);

  Future<Map<String, dynamic>> login(String username, String password) async {
    final resp = await _client.dio.post('/auth/login', data: {
      'username': username,
      'password': password,
    });
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

  Future<void> logout() async {
    try {
      await _client.dio.post('/auth/logout');
    } catch (_) {}
  }
}
