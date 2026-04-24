import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:pc02_mobile/core/api/api_client.dart';
import 'package:pc02_mobile/core/api/petitions_api.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockDio extends Mock implements Dio {}

void main() {
  late MockApiClient mockClient;
  late MockDio mockDio;
  late PetitionsApi api;

  setUp(() {
    mockClient = MockApiClient();
    mockDio = MockDio();
    when(() => mockClient.dio).thenReturn(mockDio);
    api = PetitionsApi(mockClient);
  });

  group('PetitionsApi.getPetitions()', () {
    test('parses wrapped response {data: [...]}', () async {
      final raw = [
        {'id': 'p1', 'senderName': 'Nguyen Van A', 'status': 'CHO_XU_LY'},
      ];
      when(() => mockDio.get('/petitions',
              queryParameters: any(named: 'queryParameters')))
          .thenAnswer((_) async => Response(
                data: {'data': raw},
                statusCode: 200,
                requestOptions: RequestOptions(path: '/petitions'),
              ));

      final petitions = await api.getPetitions();

      expect(petitions.length, 1);
      expect(petitions[0].id, 'p1');
    });

    test('passes status filter', () async {
      when(() => mockDio.get('/petitions',
              queryParameters: {'status': 'CHO_XU_LY', 'offset': 0, 'limit': 20}))
          .thenAnswer((_) async => Response(
                data: {'data': []},
                statusCode: 200,
                requestOptions: RequestOptions(path: '/petitions'),
              ));

      final result = await api.getPetitions(status: 'CHO_XU_LY');
      expect(result, isEmpty);
    });
  });

  group('PetitionsApi.getPetitionById()', () {
    test('unwraps {data: {...}} envelope', () async {
      when(() => mockDio.get('/petitions/p99'))
          .thenAnswer((_) async => Response(
                data: {
                  'success': true,
                  'data': {
                    'id': 'p99',
                    'senderName': 'Tran Thi B',
                    'status': 'CHO_XU_LY'
                  }
                },
                statusCode: 200,
                requestOptions: RequestOptions(path: '/petitions/p99'),
              ));

      final result = await api.getPetitionById('p99');

      expect(result['id'], 'p99');
      expect(result['senderName'], 'Tran Thi B');
      expect(result.containsKey('success'), false);
    });

    test('falls back to raw body when no data wrapper', () async {
      when(() => mockDio.get('/petitions/p88'))
          .thenAnswer((_) async => Response(
                data: {
                  'id': 'p88',
                  'senderName': 'Le Van C',
                  'status': 'DA_GIAI_QUYET'
                },
                statusCode: 200,
                requestOptions: RequestOptions(path: '/petitions/p88'),
              ));

      final result = await api.getPetitionById('p88');

      expect(result['id'], 'p88');
    });
  });
}
