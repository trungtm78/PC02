import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_base_url.dart';

const _baseUrl = apiBaseUrl;

class ApiClient {
  late final Dio _dio;
  final FlutterSecureStorage _storage;

  bool _isRefreshing = false;
  Completer<void>? _refreshCompleter;

  ApiClient(this._storage) {
    _dio = Dio(BaseOptions(
      baseUrl: _baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      contentType: 'application/json',
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: _onRequest,
      onError: _onError,
    ));
  }

  Dio get dio => _dio;

  Future<void> _onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.read(key: 'access_token');
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  Future<void> _onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }

    if (_isRefreshing) {
      try {
        await _refreshCompleter!.future;
      } catch (_) {
        handler.next(err);
        return;
      }
      final token = await _storage.read(key: 'access_token');
      err.requestOptions.headers['Authorization'] = 'Bearer $token';
      try {
        final resp = await _dio.fetch(err.requestOptions);
        handler.resolve(resp);
      } catch (e) {
        handler.next(err);
      }
      return;
    }

    _isRefreshing = true;
    _refreshCompleter = Completer<void>();

    try {
      final refreshToken = await _storage.read(key: 'refresh_token');
      if (refreshToken == null) throw Exception('no refresh token');

      final resp = await Dio(BaseOptions(
        baseUrl: _baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        contentType: 'application/json',
      )).post(
        '/auth/refresh',
        data: {'refreshToken': refreshToken},
      );

      final newAccess = resp.data['accessToken'] as String;
      final newRefresh = resp.data['refreshToken'] as String?;
      await _storage.write(key: 'access_token', value: newAccess);
      if (newRefresh != null) {
        await _storage.write(key: 'refresh_token', value: newRefresh);
      }

      _refreshCompleter!.complete();
      err.requestOptions.headers['Authorization'] = 'Bearer $newAccess';
      final retried = await _dio.fetch(err.requestOptions);
      handler.resolve(retried);
    } catch (_) {
      _refreshCompleter!.completeError(Object());
      await Future.wait([
        _storage.delete(key: 'access_token'),
        _storage.delete(key: 'refresh_token'),
        _storage.delete(key: 'user_id'),
        _storage.delete(key: 'user_name'),
        _storage.delete(key: 'user_email'),
        _storage.delete(key: 'user_role'),
      ]);
      handler.next(err);
    } finally {
      _isRefreshing = false;
      _refreshCompleter = null;
    }
  }
}
