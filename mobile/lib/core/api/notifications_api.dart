import '../models/notification.dart';
import 'api_client.dart';

class NotificationsApi {
  final ApiClient _client;
  NotificationsApi(this._client);

  Future<List<AppNotification>> getNotifications({
    int skip = 0,
    int take = 30,
  }) async {
    final resp = await _client.dio.get('/notifications', queryParameters: {
      'skip': skip,
      'take': take,
    });
    final data = resp.data as Map<String, dynamic>;
    final items = data['data'] as List? ?? resp.data as List? ?? [];
    return items
        .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<void> markRead(String id) async {
    await _client.dio.patch('/notifications/$id/read');
  }

  Future<int> getUnreadCount() async {
    final resp = await _client.dio.get('/notifications/unread-count');
    return (resp.data as Map<String, dynamic>)['count'] as int? ?? 0;
  }
}
