import '../models/case.dart';
import 'api_client.dart';

class CasesApi {
  final ApiClient _client;
  CasesApi(this._client);

  Future<List<Case>> getCases({
    bool? overdue,
    String? sortBy,
    String? sortOrder,
    int offset = 0,
    int limit = 20,
  }) async {
    final resp = await _client.dio.get('/cases', queryParameters: {
      if (overdue == true) 'overdue': 'true',
      if (sortBy != null) 'sortBy': sortBy,
      if (sortOrder != null) 'sortOrder': sortOrder,
      'offset': offset,
      'limit': limit,
    });
    final data = resp.data as Map<String, dynamic>;
    final items = data['data'] as List? ?? resp.data as List? ?? [];
    return items.map((e) => Case.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Map<String, dynamic>> getCaseById(String id) async {
    final resp = await _client.dio.get('/cases/$id');
    return resp.data as Map<String, dynamic>;
  }
}
