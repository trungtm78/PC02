import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pc02_mobile/core/logging/log.dart';

void main() {
  group('logError', () {
    test('prefixes tag and writes to debugPrint in debug mode', () {
      // debugPrint is a top-level mutable function pointer in Flutter.
      // We replace it with our own collector and restore in tearDown.
      final captured = <String>[];
      final original = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        if (message != null) captured.add(message);
      };
      addTearDown(() {
        debugPrint = original;
      });

      logError('fcm.register', 'token rejected');

      expect(captured, hasLength(1));
      expect(captured.first, contains('[fcm.register]'));
      expect(captured.first, contains('token rejected'));
    });

    test('appends stack trace line when one is supplied', () {
      final captured = <String>[];
      final original = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        if (message != null) captured.add(message);
      };
      addTearDown(() {
        debugPrint = original;
      });

      final st = StackTrace.fromString('at fakeFn (foo.dart:1)');
      logError('api', Exception('boom'), st);

      expect(captured, hasLength(2));
      expect(captured[0], contains('[api]'));
      expect(captured[0], contains('boom'));
      expect(captured[1], contains('fakeFn'));
    });

    test('does NOT call debugPrint when stack is null', () {
      final captured = <String>[];
      final original = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        if (message != null) captured.add(message);
      };
      addTearDown(() {
        debugPrint = original;
      });

      logError('biom', 'permission denied');

      // Only the message line — no extra stack-trace line.
      expect(captured, hasLength(1));
    });
  });

  group('logDebug', () {
    test('prefixes tag in debug mode', () {
      final captured = <String>[];
      final original = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        if (message != null) captured.add(message);
      };
      addTearDown(() {
        debugPrint = original;
      });

      logDebug('cases.parse', 'recovered from unexpected shape');

      expect(captured, hasLength(1));
      expect(captured.first, '[cases.parse] recovered from unexpected shape');
    });
  });
}
