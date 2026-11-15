import 'dart:math';

/// The key of ONE write, in the shape of a UUID v4. The caller keeps it with
/// the request for as long as the outcome of that request is unknown, and
/// sends the same request with the same key again; a new action gets a new
/// key. `Random.secure()` works on every platform the app ships to; no package
/// is needed for it.
String newIdempotencyKey() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
