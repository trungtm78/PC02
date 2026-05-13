import 'package:flutter_test/flutter_test.dart';
import 'package:pc02_mobile/core/util/safe_json.dart';

void main() {
  group('readNestedString', () {
    test('returns the leaf string for a present path', () {
      final root = {
        'investigator': {'fullName': 'Nguyễn Văn A'},
      };
      expect(readNestedString(root, ['investigator', 'fullName']),
          'Nguyễn Văn A');
    });

    test('returns null when the root is null', () {
      expect(readNestedString(null, ['investigator', 'fullName']), isNull);
    });

    test('returns null when an intermediate key is missing', () {
      final root = {'foo': 'bar'};
      expect(readNestedString(root, ['investigator', 'fullName']), isNull);
    });

    test('returns null when an intermediate value is null (pre-fix crash)', () {
      // Pre-BUG-6 fix: `(c['investigator'] as Map)['fullName']` crashed with
      // TypeError when investigator was null. This is the exact scenario.
      final root = {'investigator': null};
      expect(readNestedString(root, ['investigator', 'fullName']), isNull);
    });

    test('returns null when leaf value is not a string', () {
      final root = {
        'investigator': {'fullName': 42},
      };
      expect(readNestedString(root, ['investigator', 'fullName']), isNull);
    });

    test('returns null when intermediate value is a string, not a map', () {
      final root = {'investigator': 'just a name'};
      expect(readNestedString(root, ['investigator', 'fullName']), isNull);
    });

    test('handles deeply nested path correctly', () {
      final root = {
        'a': {
          'b': {
            'c': 'leaf',
          },
        },
      };
      expect(readNestedString(root, ['a', 'b', 'c']), 'leaf');
    });

    test('empty path returns null', () {
      expect(readNestedString({'x': 'y'}, []), isNull);
    });
  });
}
