import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:go_router/go_router.dart';

class NotificationRouter {
  static void init(GoRouter router) {
    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      final link = message.data['link'] as String?;
      if (link != null) {
        router.push(link);
      }
    });

    FirebaseMessaging.instance.getInitialMessage().then((message) {
      if (message != null) {
        final link = message.data['link'] as String?;
        if (link != null) {
          Future.delayed(const Duration(milliseconds: 300), () {
            router.push(link);
          });
        }
      }
    });
  }
}
