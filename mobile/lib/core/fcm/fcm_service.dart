import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/devices_api.dart';
import '../auth/auth_provider.dart';

@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {}

class FcmService {
  final DevicesApi _devicesApi;
  String? _currentToken;

  FcmService(this._devicesApi);

  Future<void> init() async {
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    if (Platform.isIOS) {
      final settings =
          await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      if (settings.authorizationStatus != AuthorizationStatus.authorized) {
        return;
      }
    }

    final token = await FirebaseMessaging.instance.getToken();
    if (token != null) {
      _currentToken = token;
      await _register(token);
    }

    FirebaseMessaging.instance.onTokenRefresh.listen((newToken) async {
      _currentToken = newToken;
      await _register(newToken);
    });
  }

  String? get currentToken => _currentToken;

  Future<void> _register(String token) async {
    final platform = Platform.isIOS ? 'ios' : 'android';
    try {
      await _devicesApi.register(token, platform);
    } catch (_) {}
  }
}

final fcmServiceProvider = Provider((ref) {
  return FcmService(ref.read(devicesApiProvider));
});
