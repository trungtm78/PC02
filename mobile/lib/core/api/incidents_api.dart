import '../models/incident.dart';
import 'api_client.dart';

class IncidentsApi {
  final ApiClient _client;
  IncidentsApi(this._client);

  Future<List<Incident>> getIncidents({
    bool? overdue,
    int offset = 0,
    int limit = 20,
  }) async {
    final resp = await _client.dio.get('/incidents', queryParameters: {
      if (overdue == true) 'overdue': 'true',
      'offset': offset,
      'limit': limit,
    });
    final data = resp.data as Map<String, dynamic>;
    final items = data['data'] as List? ?? resp.data as List? ?? [];
    return items
        .map((e) => Incident.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>> getIncidentById(String id) async {
    final resp = await _client.dio.get('/incidents/$id');
    return resp.data as Map<String, dynamic>;
  }
}
