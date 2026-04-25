import '../models/dashboard_stats.dart';
import 'api_client.dart';

class DashboardApi {
  final ApiClient _client;
  DashboardApi(this._client);

  Future<DashboardStats> getStats() async {
    final resp = await _client.dio.get('/dashboard/stats');
    final body = resp.data as Map<String, dynamic>;
    final data = body['data'] as Map<String, dynamic>?;
    if (data == null) return const DashboardStats(totalCases: 0, newCases: 0, overdueCases: 0, resolvedCases: 0);
    return DashboardStats.fromJson(data);
  }
}
