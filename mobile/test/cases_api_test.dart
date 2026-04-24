import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:pc02_mobile/core/api/api_client.dart';
import 'package:pc02_mobile/core/api/cases_api.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockDio extends Mock implements Dio {}

void main() {
  late MockApiClient mockClient;
  late MockDio mockDio;
  late CasesApi api;

  setUp(() {
    mockClient = MockApiClient();
    mockDio = MockDio();
    when(() => mockClient.dio).thenReturn(mockDio);
    api = CasesApi(mockClient);
  });

  group('CasesApi.getCases()', () {
    test('parses wrapped response {data: [...]}', () async {
      final raw = [
        {'id': '1', 'name': 'Vụ A', 'status': 'DANG_XU_LY'},
        {'id': '2', 'name': 'Vụ B', 'status': 'DA_GIAI_QUYET'},
      ];
      when(() => mockDio.get('/cases', queryParameters: any(named: 'queryParameters')))
          .thenAnswer((_) async => Response(
                data: {'data': raw, 'total': 2},
                statusCode: 200,
                requestOptions: RequestOptions(path: '/cases'),
              ));

      final cases = await api.getCases();

      expect(cases.length, 2);
      expect(cases[0].id, '1');
      expect(cases[1].name, 'Vụ B');
    });

    test('returns empty list when data key is empty', () async {
      when(() => mockDio.get('/cases', queryParameters: any(named: 'queryParameters')))
          .thenAnswer((_) async => Response(
                data: {'data': [], 'total': 0},
                statusCode: 200,
                requestOptions: RequestOptions(path: '/cases'),
              ));

      final cases = await api.getCases();
      expect(cases, isEmpty);
    });

    test('passes overdue filter to query', () async {
      when(() => mockDio.get('/cases',
              queryParameters: {'overdue': 'true', 'offset': 0, 'limit': 20}))
          .thenAnswer((_) async => Response(
                data: {'data': []},
                statusCode: 200,
                requestOptions: RequestOptions(path: '/cases'),
              ));

      final cases = await api.getCases(overdue: true);
      expect(cases, isEmpty);
    });
  });

  group('CasesApi.getCaseById()', () {
    test('unwraps {data: {...}} envelope', () async {
      when(() => mockDio.get('/cases/abc123'))
          .thenAnswer((_) async => Response(
                data: {
                  'success': true,
                  'data': {'id': 'abc123', 'name': 'Vụ test', 'status': 'DANG_XU_LY'}
                },
                statusCode: 200,
                requestOptions: RequestOptions(path: '/cases/abc123'),
              ));

      final result = await api.getCaseById('abc123');

      expect(result['id'], 'abc123');
      expect(result['name'], 'Vụ test');
      expect(result.containsKey('success'), false);
    });

    test('falls back to raw body when no data wrapper', () async {
      when(() => mockDio.get('/cases/xyz'))
          .thenAnswer((_) async => Response(
                data: {'id': 'xyz', 'name': 'Vụ raw', 'status': 'MOI_TIEP_NHAN'},
                statusCode: 200,
                requestOptions: RequestOptions(path: '/cases/xyz'),
              ));

      final result = await api.getCaseById('xyz');

      expect(result['id'], 'xyz');
    });
  });
}
