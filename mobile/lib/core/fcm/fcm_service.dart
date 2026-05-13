import 'dart:io';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/devices_api.dart';
import '../api/providers.dart';
import '../logging/log.dart';

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
    } catch (e, st) {
      // BUG-4: swallow no more — log so dev sees registration churn.
      logError('fcm.register', e, st);
    }
  }

  /// Called by AuthNotifier.onLogout (BUG-3 decouple). Deregister the current
  /// device on the backend so push targeting can be cleaned up; clear the
  /// in-memory token so a fresh login re-registers from scratch. Server
  /// failure is logged, not propagated — logout must not be blocked by it.
  Future<void> cleanup() async {
    final token = _currentToken;
    _currentToken = null;
    if (token == null) return;
    try {
      await _devicesApi.unregister(token);
    } catch (e, st) {
      logError('fcm.unregister', e, st);
    }
  }
}

final fcmServiceProvider = Provider((ref) {
  return FcmService(ref.read(devicesApiProvider));
});
