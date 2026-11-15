import 'dart:math';

/// A random key in the shape of a UUID v4. `Random.secure()` works on every
/// platform the app ships to; no package is needed for it.
String newIdempotencyKey() {
  final random = Random.secure();
  final bytes = List<int>.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// The idempotency key of ONE kind of write on one screen.
///
/// A write whose answer never arrived (lost connection, 5xx) may have reached
/// the server: sending it again with the SAME key lets the server answer the
/// first result instead of writing twice. So the key is kept until the server
/// gives a definite answer, and it is kept only for the same content: once the
/// person changes what they send, it is a new write with a new key (the
/// expected revision then protects against the first one having landed).
class IdempotencyKeys {
  final String Function() _generate;
  String? _pendingKey;
  String? _pendingContent;

  IdempotencyKeys({String Function()? generate})
      : _generate = generate ?? newIdempotencyKey;

  /// The key to send with [content] (any stable description of the body).
  String keyFor(String content) {
    final pending = _pendingKey;
    if (pending != null && _pendingContent == content) return pending;
    final key = _generate();
    _pendingKey = key;
    _pendingContent = content;
    return key;
  }

  /// The server answered (success or a refusal): the next write is a new one.
  void settle() {
    _pendingKey = null;
    _pendingContent = null;
  }
}
