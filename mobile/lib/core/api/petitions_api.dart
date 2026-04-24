import '../models/petition.dart';
import 'api_client.dart';

class PetitionsApi {
  final ApiClient _client;
  PetitionsApi(this._client);

  Future<List<Petition>> getPetitions({
    bool? overdue,
    String? status,
    int skip = 0,
    int take = 20,
  }) async {
    final resp = await _client.dio.get('/petitions', queryParameters: {
      if (overdue == true) 'overdue': 'true',
      if (status != null) 'status': status,
      'skip': skip,
      'take': take,
    });
    final data = resp.data as Map<String, dynamic>;
    final items = data['data'] as List? ?? resp.data as List? ?? [];
    return items
        .map((e) => Petition.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<Map<String, dynamic>> getPetitionById(String id) async {
    final resp = await _client.dio.get('/petitions/$id');
    return resp.data as Map<String, dynamic>;
  }
}
