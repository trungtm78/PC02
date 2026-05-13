import 'package:flutter/foundation.dart';

/// Thin logging wrapper. In debug builds, writes to the debug console with a
/// consistent `[tag]` prefix. In release builds, returns immediately — no log
/// output ships to production users.
///
/// Use this in every `catch` block where the previous shape was
/// `catch (_) {}` — that pattern hid bugs by swallowing exceptions silently.
/// Now they surface during development without leaking PII / stack traces in
/// production builds.
void logError(String tag, Object error, [StackTrace? stack]) {
  if (!kDebugMode) return;
  debugPrint('[$tag] $error');
  if (stack != null) debugPrint(stack.toString());
}

/// Log a developer-debug message. Release-mode no-op.
void logDebug(String tag, String message) {
  if (!kDebugMode) return;
  debugPrint('[$tag] $message');
}
