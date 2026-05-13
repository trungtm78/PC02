import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/providers.dart';
import '../logging/log.dart';

final deadlineThresholdProvider = FutureProvider<int>((ref) async {
  final api = ref.read(settingsApiProvider);
  try {
    final settings = await api.fetchAll();
    return int.tryParse(settings['CANH_BAO_SAP_HAN'] ?? '7') ?? 7;
  } catch (e, st) {
    // BUG-4: log fetch failure; fall back to 7-day default so UI stays usable.
    logError('settings.deadlineThreshold', e, st);
    return 7;
  }
});
