import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenStorage {
  final FlutterSecureStorage _storage;
  TokenStorage(this._storage);

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await Future.wait([
      _storage.write(key: 'access_token', value: accessToken),
      _storage.write(key: 'refresh_token', value: refreshToken),
    ]);
  }

  Future<String?> getAccessToken() => _storage.read(key: 'access_token');
  Future<String?> getRefreshToken() => _storage.read(key: 'refresh_token');

  Future<void> saveUser(Map<String, dynamic> user) async {
    await Future.wait([
      _storage.write(key: 'user_id', value: user['id'] as String?),
      _storage.write(key: 'user_name', value: user['fullName'] as String?),
      _storage.write(key: 'user_email', value: user['email'] as String?),
      _storage.write(key: 'user_role', value: user['role'] as String?),
    ]);
  }

  Future<Map<String, String?>> getUser() async => {
        'id': await _storage.read(key: 'user_id'),
        'fullName': await _storage.read(key: 'user_name'),
        'email': await _storage.read(key: 'user_email'),
        'role': await _storage.read(key: 'user_role'),
      };

  Future<void> clear() => Future.wait([
        _storage.delete(key: 'access_token'),
        _storage.delete(key: 'refresh_token'),
        _storage.delete(key: 'user_id'),
        _storage.delete(key: 'user_name'),
        _storage.delete(key: 'user_email'),
        _storage.delete(key: 'user_role'),
      ]);
}
