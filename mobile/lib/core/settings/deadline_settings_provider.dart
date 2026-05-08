import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/providers.dart';

final deadlineThresholdProvider = FutureProvider<int>((ref) async {
  final api = ref.read(settingsApiProvider);
  try {
    final settings = await api.fetchAll();
    return int.tryParse(settings['CANH_BAO_SAP_HAN'] ?? '7') ?? 7;
  } catch (_) {
    return 7;
  }
});
