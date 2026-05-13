import 'package:flutter_test/flutter_test.dart';
import 'package:pc02_mobile/core/api/api_base_url.dart';

void main() {
  group('assertProductionApiUrl()', () {
    test('throws StateError in release mode when URL contains 10.0.2.2', () {
      expect(
        () => assertProductionApiUrl('http://10.0.2.2:3000/api/v1', isRelease: true),
        throwsA(isA<StateError>()),
      );
    });

    test('throws StateError in release mode when URL contains localhost', () {
      expect(
        () => assertProductionApiUrl('http://localhost:3000/api/v1', isRelease: true),
        throwsA(isA<StateError>()),
      );
    });

    test('throws StateError in release mode when URL contains 127.0.0.1', () {
      expect(
        () => assertProductionApiUrl('http://127.0.0.1:3000/api/v1', isRelease: true),
        throwsA(isA<StateError>()),
      );
    });

    test('does not throw in debug mode even with emulator URL', () {
      expect(
        () => assertProductionApiUrl('http://10.0.2.2:3000/api/v1', isRelease: false),
        returnsNormally,
      );
    });

    test('does not throw in release mode with production HTTP IP URL', () {
      expect(
        () => assertProductionApiUrl('http://171.244.40.245/api/v1', isRelease: true),
        returnsNormally,
      );
    });

    test('does not throw in release mode with production HTTPS URL', () {
      expect(
        () => assertProductionApiUrl('https://pc02.example.com/api/v1', isRelease: true),
        returnsNormally,
      );
    });
  });
}
