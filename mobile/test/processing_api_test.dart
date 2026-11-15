import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:pc02_mobile/core/api/api_client.dart';
import 'package:pc02_mobile/core/api/processing_api.dart';
import 'package:pc02_mobile/core/models/case.dart';
import 'package:pc02_mobile/core/models/incident.dart';
import 'package:pc02_mobile/core/models/petition.dart';
import 'package:pc02_mobile/core/util/idempotency.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockDio extends Mock implements Dio {}

Response<dynamic> _ok(String path, dynamic data) => Response(
      data: data,
      statusCode: 200,
      requestOptions: RequestOptions(path: path),
    );

DioException _http(String path, int status, [dynamic data]) => DioException(
      requestOptions: RequestOptions(path: path),
      type: DioExceptionType.badResponse,
      response: Response(
        data: data,
        statusCode: status,
        requestOptions: RequestOptions(path: path),
      ),
    );

const _summaryPath = '/processing/tracking/summary';
const _itemsPath = '/processing/tracking/items';
const _flowPath = '/processing/records/PETITION/p1';
const _reportPath = '/processing/records/PETITION/p1/steps/s1/reports';
const _completePath = '/processing/records/PETITION/p1/steps/s1/complete';

void main() {
  late MockApiClient mockClient;
  late MockDio mockDio;
  late ProcessingApi api;

  setUp(() {
    mockClient = MockApiClient();
    mockDio = MockDio();
    when(() => mockClient.dio).thenReturn(mockDio);
    api = ProcessingApi(mockClient);
  });

  group('the feature is off (404) or not permitted (403): reads answer null',
      () {
    for (final status in [404, 403]) {
      test('summary, $status', () async {
        when(() => mockDio.get(_summaryPath,
                queryParameters: any(named: 'queryParameters')))
            .thenThrow(_http(_summaryPath, status));
        expect(await api.getMySummary(), isNull);
      });

      test('items, $status', () async {
        when(() => mockDio.get(_itemsPath,
                queryParameters: any(named: 'queryParameters')))
            .thenThrow(_http(_itemsPath, status));
        expect(await api.getMyItems(asOf: 'x'), isNull);
      });

      test('flow of a record, $status', () async {
        when(() => mockDio.get(_flowPath)).thenThrow(_http(_flowPath, status));
        expect(await api.getRecordFlow('PETITION', 'p1'), isNull);
      });
    }

    test('a 500 is NOT hidden: it is an error the screen may retry', () {
      when(() => mockDio.get(_summaryPath,
              queryParameters: any(named: 'queryParameters')))
          .thenThrow(_http(_summaryPath, 500));
      expect(api.getMySummary(), throwsA(isA<DioException>()));
    });
  });

  group('tracking', () {
    test('summary asks for my work and reads the four counts', () async {
      when(() => mockDio.get(_summaryPath, queryParameters: {'mine': 'true'}))
          .thenAnswer((_) async => _ok(_summaryPath, {
                'asOf': '2026-11-15T03:00:00.000Z',
                'counts': {'OVERDUE': 2, 'RED': 1, 'YELLOW': 0, 'GREEN': 5},
              }));

      final summary = await api.getMySummary();

      expect(summary!.asOf, '2026-11-15T03:00:00.000Z');
      expect(summary.countOf('OVERDUE'), 2);
      expect(summary.countOf('GREEN'), 5);
    });

    test('items sends back the asOf of the summary, the band and the page',
        () async {
      when(() => mockDio.get(_itemsPath, queryParameters: {
            'mine': 'true',
            'band': 'RED',
            'asOf': '2026-11-15T03:00:00.000Z',
            'page': 2,
            'pageSize': 20,
          })).thenAnswer((_) async => _ok(_itemsPath, {
            'asOf': '2026-11-15T03:00:00.000Z',
            'band': 'RED',
            'total': 21,
            'page': 2,
            'pageSize': 20,
            'items': [
              {
                'recordKind': 'INCIDENT',
                'recordId': 'i1',
                'recordCode': '2026-00012',
                'recordLabel': 'Vụ trộm',
                'stepKey': 's1',
                'stepName': 'Xác minh',
                'teamId': 't1',
                'teamName': 'Tổ 2',
                'assigneeUserId': null,
                'responsibleName': null,
                'dueAt': '2026-11-16T10:00:00.000Z',
                'band': 'RED',
                'remainingDays': 1,
              }
            ],
          }));

      final page = await api.getMyItems(
          asOf: '2026-11-15T03:00:00.000Z', band: 'RED', page: 2);

      expect(page!.total, 21);
      expect(page.items.single.stepName, 'Xác minh');
      expect(page.items.single.band, 'RED');
      expect(page.items.single.remainingDays, 1);
    });

    test('no band filter: the band key is not sent at all', () async {
      when(() => mockDio.get(_itemsPath, queryParameters: {
            'mine': 'true',
            'asOf': 'A',
            'page': 1,
            'pageSize': 20,
          })).thenAnswer((_) async => _ok(_itemsPath, {
            'asOf': 'A',
            'total': 0,
            'page': 1,
            'pageSize': 20,
            'items': [],
          }));

      expect((await api.getMyItems(asOf: 'A'))!.items, isEmpty);
    });
  });

  group('the flow of a record', () {
    test('reads revision, steps, the band the server gave and the main unit',
        () async {
      when(() => mockDio.get(_flowPath)).thenAnswer((_) async => _ok(_flowPath, {
            'id': 'f1',
            'recordKind': 'PETITION',
            'recordId': 'p1',
            'flowName': 'Tố cáo',
            'confirmed': true,
            'suspended': false,
            'revision': 7,
            'steps': [
              {
                'stepKey': 's1',
                'order': 1,
                'name': 'Xác minh',
                'status': 'OPEN',
                'band': 'YELLOW',
                'remainingDays': 3,
                'dueAt': '2026-11-18T10:00:00.000Z',
                'parties': [
                  {'partyKind': 'TEAM', 'teamName': 'Tổ 4', 'role': 'CHECK'},
                  {'partyKind': 'TEAM', 'teamName': 'Tổ 2', 'role': 'MAIN'},
                ],
                'latestReport': {
                  'kind': 'PROGRESS',
                  'summary': 'Đã gặp người tố cáo',
                  'at': '2026-11-14T02:00:00.000Z',
                  'revision': 1,
                },
              },
              {
                'stepKey': 's2',
                'order': 2,
                'name': 'Kết luận',
                'status': 'WAITING_ANCHOR',
                'band': 'NONE',
                'remainingDays': null,
                'dueAt': null,
                'parties': [],
                'latestReport': null,
              },
            ],
          }));

      final flow = await api.getRecordFlow('PETITION', 'p1');

      expect(flow!.revision, 7);
      expect(flow.steps.length, 2);
      expect(flow.steps[0].band, 'YELLOW');
      expect(flow.steps[0].mainTeamName, 'Tổ 2');
      expect(flow.steps[0].isBeingWorked, isTrue);
      expect(flow.steps[0].latestReportSummary, 'Đã gặp người tố cáo');
      expect(flow.steps[1].isBeingWorked, isFalse);
      expect(flow.steps[1].dueAt, isNull);
    });
  });

  group('writes', () {
    test('a report carries the revision, the key and only the filled fields',
        () async {
      when(() => mockDio.post(_reportPath, data: {
            'expectedRevision': 7,
            'idempotencyKey': 'k-1',
            'kind': 'RESULT',
            'doneWork': 'Đã xác minh xong',
            'findings': 'Có căn cứ',
          })).thenAnswer((_) async => _ok(_reportPath, {
            'recordKind': 'PETITION',
            'recordId': 'p1',
            'flowName': 'Tố cáo',
            'revision': 8,
            'steps': [],
          }));

      final flow = await api.submitReport(
        kind: 'PETITION',
        recordId: 'p1',
        stepKey: 's1',
        expectedRevision: 7,
        idempotencyKey: 'k-1',
        reportKind: 'RESULT',
        doneWork: 'Đã xác minh xong',
        findings: 'Có căn cứ',
        difficulties: '',
      );

      expect(flow!.revision, 8);
    });

    test('complete carries the revision and the key', () async {
      when(() => mockDio.post(_completePath, data: {
            'expectedRevision': 8,
            'idempotencyKey': 'k-2',
          })).thenAnswer((_) async => _ok(_completePath, {
            'revision': 9,
            'steps': [],
          }));

      final flow = await api.completeStep(
        kind: 'PETITION',
        recordId: 'p1',
        stepKey: 's1',
        expectedRevision: 8,
        idempotencyKey: 'k-2',
      );

      expect(flow!.revision, 9);
    });

    Future<ProcessingWriteFailure> failureOfComplete(DioException e) async {
      when(() => mockDio.post(_completePath, data: any(named: 'data')))
          .thenThrow(e);
      try {
        await api.completeStep(
          kind: 'PETITION',
          recordId: 'p1',
          stepKey: 's1',
          expectedRevision: 8,
          idempotencyKey: 'k',
        );
      } on ProcessingWriteFailure catch (failure) {
        return failure;
      }
      fail('the write did not fail');
    }

    test('409 REVISION_CONFLICT is a conflict', () async {
      final failure = await failureOfComplete(
          _http(_completePath, 409, {'code': 'REVISION_CONFLICT'}));
      expect(failure.kind, ProcessingWriteFailureKind.conflict);
      expect(failure.isRetryable, isFalse);
    });

    test('another 409 is a refusal with its code, not a conflict', () async {
      final failure = await failureOfComplete(
          _http(_completePath, 409, {'code': 'STEP_NOT_OPEN'}));
      expect(failure.kind, ProcessingWriteFailureKind.refused);
      expect(failure.code, 'STEP_NOT_OPEN');
    });

    test('a code nested under message is still read', () async {
      final failure = await failureOfComplete(_http(_completePath, 409, {
        'statusCode': 409,
        'message': {'code': 'REVISION_CONFLICT'},
      }));
      expect(failure.kind, ProcessingWriteFailureKind.conflict);
    });

    test('no answer and 5xx are retryable; 403 and a bare 404 are not',
        () async {
      final lost = await failureOfComplete(DioException(
        requestOptions: RequestOptions(path: _completePath),
        type: DioExceptionType.connectionError,
      ));
      expect(lost.isRetryable, isTrue);

      final timeout = await failureOfComplete(DioException(
        requestOptions: RequestOptions(path: _completePath),
        type: DioExceptionType.receiveTimeout,
      ));
      expect(timeout.isRetryable, isTrue);

      expect((await failureOfComplete(_http(_completePath, 503))).isRetryable,
          isTrue);
      expect((await failureOfComplete(_http(_completePath, 403))).kind,
          ProcessingWriteFailureKind.notAllowed);
      expect((await failureOfComplete(_http(_completePath, 404))).kind,
          ProcessingWriteFailureKind.notAllowed);
    });
  });

  group('IdempotencyKeys', () {
    test('the same content gets the same key until the server answers', () {
      var n = 0;
      final keys = IdempotencyKeys(generate: () => 'key-${++n}');

      expect(keys.keyFor('a'), 'key-1');
      expect(keys.keyFor('a'), 'key-1');
      keys.settle();
      expect(keys.keyFor('a'), 'key-2');
    });

    test('changed content is a new write with a new key', () {
      var n = 0;
      final keys = IdempotencyKeys(generate: () => 'key-${++n}');

      expect(keys.keyFor('a'), 'key-1');
      expect(keys.keyFor('b'), 'key-2');
      expect(keys.keyFor('b'), 'key-2');
    });

    test('generated keys are distinct and fit the server limit', () {
      final seen = {for (var i = 0; i < 200; i++) newIdempotencyKey()};
      expect(seen.length, 200);
      expect(seen.first.length, 36);
      expect(RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
          .hasMatch(seen.first), isTrue);
    });
  });

  group('the alert of a list row', () {
    const alert = {
      'source': 'FLOW',
      'band': 'RED',
      'remainingDays': 1,
      'stepName': 'Xác minh',
      'dueAt': '2026-11-16T10:00:00.000Z',
    };

    test('is read on the three record kinds', () {
      final p = Petition.fromJson(
          {'id': 'p', 'senderName': 'A', 'status': 'S', 'alert': alert});
      final i = Incident.fromJson(
          {'id': 'i', 'name': 'B', 'status': 'S', 'alert': alert});
      final c =
          Case.fromJson({'id': 'c', 'name': 'C', 'status': 'S', 'alert': alert});
      for (final a in [p.alert, i.alert, c.alert]) {
        expect(a!.band, 'RED');
        expect(a.remainingDays, 1);
        expect(a.stepName, 'Xác minh');
      }
    });

    test('is null when the row carries none (switch off) or null', () {
      expect(Petition.fromJson({'id': 'p', 'senderName': 'A', 'status': 'S'}).alert,
          isNull);
      expect(
          Case.fromJson({'id': 'c', 'name': 'C', 'status': 'S', 'alert': null})
              .alert,
          isNull);
    });
  });
}
