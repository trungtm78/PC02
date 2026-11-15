import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:go_router/go_router.dart';

class NotificationRouter {
  /// The `tab` of the web that means "the steps of the record".
  static const stepsTab = 'phan-cong-xu-ly';

  static const _recordSections = {'petitions', 'incidents', 'cases'};
  static const _plainSections = {'notifications', 'my-work'};

  /// The route of the app a notification link opens, or `null` for a link
  /// the app has no screen for (nothing is opened then).
  ///
  /// The server writes links as WEB paths: `/petitions/:id?tab=…`,
  /// `/incidents/:id?tab=…`, `/cases/:id/edit?tab=…`. The app has one detail
  /// screen per record, so the `/edit` of a case is dropped; the steps tab is
  /// kept so the detail opens on the steps.
  static String? resolve(Object? rawLink) {
    if (rawLink is! String) return null;
    final link = rawLink.trim();
    if (!link.startsWith('/') || link.startsWith('//')) return null;
    final uri = Uri.tryParse(link);
    if (uri == null || uri.hasScheme || uri.hasAuthority) return null;
    final segments = uri.pathSegments;
    if (segments.isEmpty) return '/';
    final section = segments.first;
    if (segments.length == 1) {
      return _recordSections.contains(section) ||
              _plainSections.contains(section)
          ? '/$section'
          : null;
    }
    if (!_recordSections.contains(section)) return null;
    final id = segments[1];
    if (id.isEmpty) return null;
    final isDetail = segments.length == 2 ||
        (segments.length == 3 && segments[2] == 'edit');
    if (!isDetail) return null;
    final target = '/$section/${Uri.encodeComponent(id)}';
    return uri.queryParameters['tab'] == stepsTab
        ? '$target?tab=$stepsTab'
        : target;
  }

  /// Opens the screen of a notification's `data`; returns the route opened.
  static String? open(GoRouter router, Map<String, dynamic> data) {
    final route = resolve(data['link']);
    if (route != null) router.push(route);
    return route;
  }

  static void init(GoRouter router) {
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      open(router, message.data);
    });

    // The app was terminated and the tap started it.
    FirebaseMessaging.instance.getInitialMessage().then((message) {
      if (message == null) return;
      if (resolve(message.data['link']) == null) return;
      Future.delayed(const Duration(milliseconds: 300), () {
        open(router, message.data);
      });
    });
  }
}
