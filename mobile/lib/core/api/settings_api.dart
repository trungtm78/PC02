import 'api_client.dart';

class SettingsApi {
  final ApiClient _client;
  SettingsApi(this._client);

  Future<Map<String, String>> fetchAll() async {
    final resp = await _client.dio.get('/settings');
    final list = resp.data as List;
    return {
      for (final item in list)
        (item['key'] as String): (item['value'] as String),
    };
  }
}
