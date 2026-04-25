import '../models/dashboard_stats.dart';
import 'api_client.dart';

class DashboardApi {
  final ApiClient _client;
  DashboardApi(this._client);

  Future<DashboardStats> getStats() async {
    final resp = await _client.dio.get('/dashboard/stats');
    if (resp.data is! Map) return const DashboardStats(totalCases: 0, newCases: 0, overdueCases: 0, resolvedCases: 0);
    final body = Map<String, dynamic>.from(resp.data as Map);
    final rawData = body['data'];
    if (rawData == null || rawData is! Map) return const DashboardStats(totalCases: 0, newCases: 0, overdueCases: 0, resolvedCases: 0);
    return DashboardStats.fromJson(Map<String, dynamic>.from(rawData));
  }
}
