import '../models/dashboard_stats.dart';
import 'api_client.dart';

class DashboardApi {
  final ApiClient _client;
  DashboardApi(this._client);

  Future<DashboardStats> getStats() async {
    final resp = await _client.dio.get('/dashboard/stats');
    final body = resp.data as Map<String, dynamic>;
    return DashboardStats.fromJson(body['data'] as Map<String, dynamic>);
  }
}
