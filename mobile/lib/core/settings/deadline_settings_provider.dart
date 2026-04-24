import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/api_client.dart';
import '../api/settings_api.dart';
import '../auth/auth_provider.dart';

final settingsApiProvider =
    Provider((ref) => SettingsApi(ref.read(apiClientProvider)));

final deadlineThresholdProvider = FutureProvider<int>((ref) async {
  final api = ref.read(settingsApiProvider);
  try {
    final settings = await api.fetchAll();
    return int.tryParse(settings['CANH_BAO_SAP_HAN'] ?? '7') ?? 7;
  } catch (_) {
    return 7;
  }
});
