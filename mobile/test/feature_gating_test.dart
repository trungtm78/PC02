import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pc02_mobile/core/api/feature_disabled.dart';
import 'package:pc02_mobile/core/api/feature_flags_api.dart';
import 'package:pc02_mobile/core/api/nav_visibility.dart';
import 'package:pc02_mobile/core/api/version_gate.dart';

/// PR-M1. Turning an API flag off without these produces
/// `Lỗi: DioException ... 404` on an installed app, and an installed app cannot
/// be fixed by a redeploy. That is why E4–E6 were blocked on this work.
DioException _err(int status, dynamic body) => DioException(
      requestOptions: RequestOptions(path: '/cases'),
      response: Response(
        requestOptions: RequestOptions(path: '/cases'),
        statusCode: status,
        data: body,
      ),
    );

void main() {
  group('readFeatureDisabled', () {
    test('reads the flat body shape', () {
      final res = readFeatureDisabled(_err(404, {
        'statusCode': 404,
        'error': kFeatureDisabledError,
        'feature': 'cases',
        'message': 'Tính năng "Vụ án" hiện đang tắt',
      }));

      expect(res, isNotNull);
      expect(res!.feature, 'cases');
      expect(res.message, contains('đang tắt'));
    });

    test('reads the shape Nest nests under message', () {
      // Nest produces both, depending on how the exception was constructed.
      // Handling only one is how this works in testing and fails in the field.
      final res = readFeatureDisabled(_err(404, {
        'message': {
          'error': kFeatureDisabledError,
          'feature': 'petitions',
          'message': 'Tính năng "Đơn thư" hiện đang tắt',
        },
      }));

      expect(res?.feature, 'petitions');
    });

    test('does not mistake a real not-found for a disabled feature', () {
      // The whole reason the body matters: the status code is deliberately the
      // same for both, so a missing record must not display "feature is off".
      expect(
        readFeatureDisabled(_err(404, {'message': 'Vụ án không tồn tại'})),
        isNull,
      );
    });

    test('ignores other statuses', () {
      expect(readFeatureDisabled(_err(403, {'error': kFeatureDisabledError})), isNull);
    });
  });

  group('FeatureFlagsApi', () {
    test('treats an unloaded flag as enabled, not disabled', () {
      // A network failure at start-up that hid every menu would look exactly
      // like the unit having its modules taken away. A temporary error must not
      // impersonate an administrative decision.
      final api = FeatureFlagsApi(Dio());

      expect(api.loaded, isFalse);
      expect(api.isEnabled('cases'), isTrue);
    });
  });

  group('compareVersions', () {
    test('compares numerically, not as strings', () {
      // "0.10.0" > "0.9.0" is only true numerically. Comparing as strings makes
      // a patched build look older than the one it replaced, and the update
      // prompt never fires.
      expect(compareVersions('0.10.0', '0.9.0'), greaterThan(0));
      expect(compareVersions('1.0.0', '1.0.1'), lessThan(0));
      expect(compareVersions('1.2.3', '1.2.3'), 0);
    });

    test('treats a missing segment as zero', () {
      expect(compareVersions('1.2', '1.2.0'), 0);
      expect(compareVersions('1.2', '1.2.1'), lessThan(0));
    });
  });

  group('VersionGate', () {
    test('lets the user in when the server does not answer', () async {
      // The server being unreachable is not a reason to lock somebody out of
      // the app they already have.
      final dio = Dio(BaseOptions(baseUrl: 'http://127.0.0.1:9'));
      final gate = VersionGate(dio, currentVersion: '0.1.0');

      final res = await gate.check();

      expect(res.mustUpdate, isFalse);
    });
  });
  group('visibleNavIndexes', () {
    test('keeps every tab when nothing is switched off', () {
      final flags = FeatureFlagsApi(Dio());

      expect(visibleNavIndexes(flags), [0, 1, 2, 3, 4]);
    });

    test('returns indexes into the original list, not a renumbered one', () {
      // The icons and labels live in a parallel static array. Handing back a
      // filtered list instead of indexes is the fastest way to make tapping one
      // tab open a different screen.
      final flags = FeatureFlagsApi(Dio());
      const tabs = [
        NavTab(route: '/', featureKey: null),
        NavTab(route: '/cases', featureKey: 'cases'),
        NavTab(route: '/incidents', featureKey: 'incidents'),
      ];

      final res = visibleNavIndexes(flags, tabs: tabs);

      expect(res, [0, 1, 2]);
      expect(tabs[res[1]].route, '/cases');
    });

    test('never hides the tabs that belong to the shell', () {
      // Overview and Notifications are not a module anyone can switch off;
      // hiding them would leave an app with no way back to anything.
      final flags = FeatureFlagsApi(Dio());

      final res = visibleNavIndexes(flags);

      expect(res, contains(0));
      expect(res, contains(4));
    });
  });
}
