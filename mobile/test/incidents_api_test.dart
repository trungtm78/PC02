import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:pc02_mobile/core/api/api_client.dart';
import 'package:pc02_mobile/core/api/incidents_api.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockDio extends Mock implements Dio {}

void main() {
  late MockApiClient mockClient;
  late MockDio mockDio;
  late IncidentsApi api;

  setUp(() {
    mockClient = MockApiClient();
    mockDio = MockDio();
    when(() => mockClient.dio).thenReturn(mockDio);
    api = IncidentsApi(mockClient);
  });

  group('IncidentsApi.getIncidents()', () {
    test('parses wrapped response {data: [...]}', () async {
      final raw = [
        {'id': 'i1', 'name': 'Sự cố A', 'status': 'DANG_XU_LY'},
      ];
      when(() => mockDio.get('/incidents',
              queryParameters: any(named: 'queryParameters')))
          .thenAnswer((_) async => Response(
                data: {'data': raw},
                statusCode: 200,
                requestOptions: RequestOptions(path: '/incidents'),
              ));

      final incidents = await api.getIncidents();

      expect(incidents.length, 1);
      expect(incidents[0].id, 'i1');
    });

    test('passes overdue filter', () async {
      when(() => mockDio.get('/incidents',
              queryParameters: {'overdue': 'true', 'offset': 0, 'limit': 20}))
          .thenAnswer((_) async => Response(
                data: {'data': []},
                statusCode: 200,
                requestOptions: RequestOptions(path: '/incidents'),
              ));

      final result = await api.getIncidents(overdue: true);
      expect(result, isEmpty);
    });
  });

  group('IncidentsApi.getIncidentById()', () {
    test('unwraps {data: {...}} envelope', () async {
      when(() => mockDio.get('/incidents/i99'))
          .thenAnswer((_) async => Response(
                data: {
                  'success': true,
                  'data': {'id': 'i99', 'name': 'Sự cố test', 'status': 'MOI_TIEP_NHAN'}
                },
                statusCode: 200,
                requestOptions: RequestOptions(path: '/incidents/i99'),
              ));

      final result = await api.getIncidentById('i99');

      expect(result['id'], 'i99');
      expect(result.containsKey('success'), false);
    });

    test('falls back to raw body when no data wrapper', () async {
      when(() => mockDio.get('/incidents/i88'))
          .thenAnswer((_) async => Response(
                data: {'id': 'i88', 'name': 'Sự cố raw', 'status': 'DA_GIAI_QUYET'},
                statusCode: 200,
                requestOptions: RequestOptions(path: '/incidents/i88'),
              ));

      final result = await api.getIncidentById('i88');

      expect(result['id'], 'i88');
    });
  });
}
