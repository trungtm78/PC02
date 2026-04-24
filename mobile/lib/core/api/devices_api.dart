import 'api_client.dart';

class DevicesApi {
  final ApiClient _client;
  DevicesApi(this._client);

  Future<void> register(String fcmToken, String platform) async {
    await _client.dio.post('/devices', data: {
      'fcmToken': fcmToken,
      'platform': platform,
    });
  }

  Future<void> unregister(String fcmToken) async {
    await _client.dio.delete('/devices/$fcmToken');
  }
}
