import '../models/dashboard_stats.dart';
import 'api_client.dart';

class DashboardApi {
  final ApiClient _client;
  DashboardApi(this._client);

  Future<DashboardStats> getStats() async {
    final resp = await _client.dio.get('/dashboard/stats');
    return DashboardStats.fromJson(resp.data as Map<String, dynamic>);
  }
}
