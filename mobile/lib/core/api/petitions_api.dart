import '../models/petition.dart';
import 'api_client.dart';

class PetitionsApi {
  final ApiClient _client;
  PetitionsApi(this._client);

  Future<List<Petition>> getPetitions({
    String? status,
    int offset = 0,
    int limit = 20,
  }) async {
    final resp = await _client.dio.get('/petitions', queryParameters: {
      if (status != null) 'status': status,
      'offset': offset,
      'limit': limit,
    });
    final data = resp.data as Map<String, dynamic>;
    final items = data['data'] as List? ?? resp.data as List? ?? [];
    return items
        .map((e) => Petition.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>> getPetitionById(String id) async {
    final resp = await _client.dio.get('/petitions/$id');
    final body = resp.data as Map<String, dynamic>;
    return (body['data'] as Map<String, dynamic>?) ?? body;
  }
}
