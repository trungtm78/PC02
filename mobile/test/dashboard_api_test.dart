import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:pc02_mobile/core/api/api_client.dart';
import 'package:pc02_mobile/core/api/dashboard_api.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockDio extends Mock implements Dio {}

void main() {
  late MockApiClient mockClient;
  late MockDio mockDio;
  late DashboardApi api;

  setUp(() {
    mockClient = MockApiClient();
    mockDio = MockDio();
    when(() => mockClient.dio).thenReturn(mockDio);
    api = DashboardApi(mockClient);
  });

  group('DashboardApi.getStats()', () {
    test('unwraps {success, data:{...}} envelope correctly', () async {
      when(() => mockDio.get('/dashboard/stats')).thenAnswer((_) async => Response(
            data: {
              'success': true,
              'data': {
                'totalCases': 18,
                'newCases': 1,
                'overdueCases': 10,
                'processedCases': 3,
              }
            },
            statusCode: 200,
            requestOptions: RequestOptions(path: '/dashboard/stats'),
          ));

      final stats = await api.getStats();

      expect(stats.totalCases, 18);
      expect(stats.newCases, 1);
      expect(stats.overdueCases, 10);
      expect(stats.resolvedCases, 3);
    });

    test('processedCases (API key) maps to resolvedCases (model field)', () async {
      when(() => mockDio.get('/dashboard/stats')).thenAnswer((_) async => Response(
            data: {'data': {'processedCases': 5}},
            statusCode: 200,
            requestOptions: RequestOptions(path: '/dashboard/stats'),
          ));

      final stats = await api.getStats();
      expect(stats.resolvedCases, 5,
          reason: 'processedCases in API JSON must map to resolvedCases field');
    });

    test('old key resolvedCases does NOT silently map (regression guard)', () async {
      when(() => mockDio.get('/dashboard/stats')).thenAnswer((_) async => Response(
            data: {'data': {'resolvedCases': 99, 'processedCases': 0}},
            statusCode: 200,
            requestOptions: RequestOptions(path: '/dashboard/stats'),
          ));

      final stats = await api.getStats();
      expect(stats.resolvedCases, 0,
          reason: 'Old field name resolvedCases should NOT map — use processedCases');
    });

    test('missing fields fall back to 0', () async {
      when(() => mockDio.get('/dashboard/stats')).thenAnswer((_) async => Response(
            data: {'data': {}},
            statusCode: 200,
            requestOptions: RequestOptions(path: '/dashboard/stats'),
          ));

      final stats = await api.getStats();
      expect(stats.totalCases, 0);
      expect(stats.newCases, 0);
      expect(stats.overdueCases, 0);
      expect(stats.resolvedCases, 0);
    });

    test('missing data key returns all-zero stats (no crash)', () async {
      when(() => mockDio.get('/dashboard/stats')).thenAnswer((_) async => Response(
            data: {'success': false, 'error': 'Unauthorized'},
            statusCode: 200,
            requestOptions: RequestOptions(path: '/dashboard/stats'),
          ));

      final stats = await api.getStats();
      expect(stats.totalCases, 0);
      expect(stats.resolvedCases, 0);
    });
  });
}
