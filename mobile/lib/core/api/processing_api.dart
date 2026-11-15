import 'package:dio/dio.dart';
import '../constants/processing_codes.dart';
import '../models/processing.dart';
import 'api_client.dart';

/// Why a write on a step did not go through.
enum ProcessingWriteFailureKind {
  /// 409 `REVISION_CONFLICT`: somebody changed the flow; reload, then send again.
  conflict,

  /// No answer, or a 5xx: the write may or may not have reached the server.
  /// Send it again with the SAME idempotency key.
  retryable,

  /// 403, or 404 (the feature is off / the record cannot be read).
  notAllowed,

  /// The server refused with a code (`code` says why).
  refused,
}

class ProcessingWriteFailure implements Exception {
  final ProcessingWriteFailureKind kind;
  final String? code;
  const ProcessingWriteFailure(this.kind, {this.code});

  bool get isRetryable => kind == ProcessingWriteFailureKind.retryable;
  bool get isConflict => kind == ProcessingWriteFailureKind.conflict;

  @override
  String toString() => 'ProcessingWriteFailure($kind, $code)';
}

/// The processing flow of records ("Quy trình & hạn xử lý").
///
/// The whole feature sits behind switches on the server. A read that answers
/// 404 (switch off) or 403 (no permission) returns `null`: the screens then
/// hide the feature instead of showing an error.
class ProcessingApi {
  final ApiClient _client;
  ProcessingApi(this._client);

  static bool _isHidden(DioException e) {
    final status = e.response?.statusCode;
    return status == 404 || status == 403;
  }

  static Map<String, dynamic>? _body(dynamic data, String marker) {
    if (data is! Map) return null;
    final body = Map<String, dynamic>.from(data);
    if (body.containsKey(marker)) return body;
    final inner = body['data'];
    if (inner is Map && inner.containsKey(marker)) {
      return Map<String, dynamic>.from(inner);
    }
    return null;
  }

  /// The four counts of my work; `null` when the feature is not available.
  Future<TrackingSummary?> getMySummary() async {
    try {
      final resp = await _client.dio.get(
        '/processing/tracking/summary',
        queryParameters: {'mine': 'true'},
      );
      final body = _body(resp.data, 'counts');
      if (body == null || body['asOf'] is! String) return null;
      return TrackingSummary.fromJson(body);
    } on DioException catch (e) {
      if (_isHidden(e)) return null;
      rethrow;
    }
  }

  /// One page of my work, at the clock the summary answered ([asOf]) so the
  /// rows are the ones the counts counted. `null` when not available.
  Future<TrackingPage?> getMyItems({
    required String asOf,
    String? band,
    int page = 1,
    int pageSize = 20,
  }) async {
    try {
      final resp = await _client.dio.get(
        '/processing/tracking/items',
        queryParameters: {
          'mine': 'true',
          if (band != null) 'band': band,
          'asOf': asOf,
          'page': page,
          'pageSize': pageSize,
        },
      );
      final body = _body(resp.data, 'items');
      return body == null ? null : TrackingPage.fromJson(body);
    } on DioException catch (e) {
      if (_isHidden(e)) return null;
      rethrow;
    }
  }

  /// The flow of a record; `null` when the feature is off, the person may not
  /// read it, or the record has no flow.
  Future<RecordFlow?> getRecordFlow(String kind, String recordId) async {
    try {
      final resp = await _client.dio.get('/processing/records/$kind/$recordId');
      final body = _body(resp.data, 'steps');
      return body == null ? null : RecordFlow.fromJson(body);
    } on DioException catch (e) {
      if (_isHidden(e)) return null;
      rethrow;
    }
  }

  /// Writes a report on a step. Throws [ProcessingWriteFailure].
  Future<RecordFlow?> submitReport({
    required String kind,
    required String recordId,
    required String stepKey,
    required int expectedRevision,
    required String idempotencyKey,
    required String reportKind,
    required String doneWork,
    String? findings,
    String? difficulties,
  }) =>
      _write('/processing/records/$kind/$recordId/steps/$stepKey/reports', {
        'expectedRevision': expectedRevision,
        'idempotencyKey': idempotencyKey,
        'kind': reportKind,
        'doneWork': doneWork,
        if (findings != null && findings.isNotEmpty) 'findings': findings,
        if (difficulties != null && difficulties.isNotEmpty)
          'difficulties': difficulties,
      });

  /// Marks a step done. Throws [ProcessingWriteFailure].
  Future<RecordFlow?> completeStep({
    required String kind,
    required String recordId,
    required String stepKey,
    required int expectedRevision,
    required String idempotencyKey,
  }) =>
      _write('/processing/records/$kind/$recordId/steps/$stepKey/complete', {
        'expectedRevision': expectedRevision,
        'idempotencyKey': idempotencyKey,
      });

  Future<RecordFlow?> _write(String path, Map<String, dynamic> body) async {
    try {
      final resp = await _client.dio.post(path, data: body);
      final flow = _body(resp.data, 'steps');
      return flow == null ? null : RecordFlow.fromJson(flow);
    } on DioException catch (e) {
      throw failureOf(e);
    }
  }

  /// What a failed write means for the person who typed it.
  static ProcessingWriteFailure failureOf(DioException e) {
    final status = e.response?.statusCode;
    if (status == null || status >= 500) {
      return const ProcessingWriteFailure(ProcessingWriteFailureKind.retryable);
    }
    final code = _errorCode(e.response?.data);
    if (status == 409 && code == ProcError.revisionConflict) {
      return ProcessingWriteFailure(ProcessingWriteFailureKind.conflict,
          code: code);
    }
    if (status == 403 || (status == 404 && code == null)) {
      return ProcessingWriteFailure(ProcessingWriteFailureKind.notAllowed,
          code: code);
    }
    return ProcessingWriteFailure(ProcessingWriteFailureKind.refused,
        code: code);
  }

  static String? _errorCode(dynamic data) {
    if (data is! Map) return null;
    for (final candidate in [data['code'], data['message'], data['error']]) {
      if (candidate is Map && candidate['code'] is String) {
        return candidate['code'] as String;
      }
    }
    final code = data['code'];
    return code is String ? code : null;
  }
}
