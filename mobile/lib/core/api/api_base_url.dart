import 'package:flutter/foundation.dart';

const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000/api/v1',
);

const _devHosts = ['10.0.2.2', 'localhost', '127.0.0.1'];

/// Startup guard: in release builds, refuse to run with an emulator/local-dev
/// API URL. Forces caller to pass `--dart-define=API_BASE_URL=...` at build
/// time. Prevents shipping an APK that silently fails all network calls (or
/// worse, points production users at a dev server).
void assertProductionApiUrl(String url, {bool? isRelease}) {
  final release = isRelease ?? kReleaseMode;
  if (!release) return;
  for (final host in _devHosts) {
    if (url.contains(host)) {
      throw StateError(
        'Release build started with dev API URL "$url". '
        'Build with --dart-define=API_BASE_URL=<production URL>.',
      );
    }
  }
}
