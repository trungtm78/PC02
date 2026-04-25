import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

const _storage = FlutterSecureStorage();

const _kEnabled = 'bio_enabled';
const _kEmail = 'bio_email';
const _kPassword = 'bio_password';

class BiometricService {
  final LocalAuthentication _auth = LocalAuthentication();

  Future<bool> isAvailable() async {
    try {
      return await _auth.canCheckBiometrics || await _auth.isDeviceSupported();
    } catch (_) {
      return false;
    }
  }

  Future<bool> isEnabled() async {
    return await _storage.read(key: _kEnabled) == 'true';
  }

  Future<bool> authenticate() async {
    return _auth.authenticate(
      localizedReason: 'Xác thực để đăng nhập vào PC02 Quản lý',
      persistAcrossBackgrounding: true,
    );
  }

  Future<void> saveCredentials(String email, String password) async {
    await _storage.write(key: _kEnabled, value: 'true');
    await _storage.write(key: _kEmail, value: email);
    await _storage.write(key: _kPassword, value: password);
  }

  Future<({String email, String password})?> getCredentials() async {
    final email = await _storage.read(key: _kEmail);
    final password = await _storage.read(key: _kPassword);
    if (email == null || password == null) return null;
    return (email: email, password: password);
  }

  Future<void> clear() async {
    await _storage.deleteAll();
  }
}

final biometricServiceProvider = Provider((_) => BiometricService());
